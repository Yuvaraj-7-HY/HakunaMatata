"""M3/M4 tests: causality, metrics on handmade series, detector smoke.

Run: pytest -q
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from analysis.detector.config import DEFAULT_CONFIG
from analysis.detector.detector import Detector
from analysis.detector.features import build_features
from analysis.detector.health import AlertEvent, Calibration, derive_status
from analysis.eval.metrics import compute_metrics, merge_episodes
from analysis.sim.generator import STEPS_PER_DAY, simulate
from analysis.sim.scenarios import Degradation, Nuisance, Scenario


# --- causality --------------------------------------------------------------
def _causality_readings():
    sc = Scenario("cx", "M-cx", "cnc_spindle", 40.0, 3,
                  [Degradation("bearing_wear", 20.0, 38.0, "exponential")],
                  [Nuisance("load_surge", 26.0, 28.0, 0.9)])
    return simulate(sc).readings


def test_features_are_causal() -> None:
    df = _causality_readings()
    z = pd.DataFrame({
        "vibration_rms": np.sin(np.arange(len(df)) / 50.0),
        "vibration_kurtosis": np.cos(np.arange(len(df)) / 70.0),
        "temperature_c": np.sin(np.arange(len(df)) / 90.0),
        "current_a": np.cos(np.arange(len(df)) / 110.0),
    }, index=df["ts"].to_numpy())
    full = build_features(z, DEFAULT_CONFIG)
    cutoff = len(df) // 2
    trunc = build_features(z.iloc[:cutoff], DEFAULT_CONFIG)
    pd.testing.assert_frame_equal(full.iloc[:cutoff], trunc, check_exact=False, atol=1e-9)


def test_detector_scores_are_causal() -> None:
    df = _causality_readings()
    cutoff = df["ts"].min() + pd.Timedelta(days=14)
    comm = df[df["ts"] < cutoff]
    stream = df[df["ts"] >= cutoff].reset_index(drop=True)
    T = stream["ts"].iloc[int(len(stream) * 0.6)]

    det_full = Detector(DEFAULT_CONFIG).fit_baseline(comm)
    full = {s.ts: s for s in det_full.update(stream)}

    det_trunc = Detector(DEFAULT_CONFIG).fit_baseline(comm)
    trunc = {s.ts: s for s in det_trunc.update(stream[stream["ts"] <= T])}

    assert len(trunc) > 100
    for ts, s in trunc.items():
        assert s.health == pytest.approx(full[ts].health, abs=1e-9)
        assert s.status == full[ts].status


# --- metrics on handmade series --------------------------------------------
def _handmade_events():
    onset = pd.Timestamp("2026-03-20 00:00:00")
    failure = pd.Timestamp("2026-03-25 00:00:00")   # 5-day window
    ev = pd.DataFrame([{
        "machine_id": "X", "mode": "bearing_wear", "component": "bearings",
        "onset_ts": onset, "failure_ts": failure, "failed": True,
        "cancelled_by_reset": False, "nuisance_events": "[]",
    }])
    return ev, onset, failure


def _handmade_readings():
    ts = pd.date_range("2026-03-01", periods=40 * STEPS_PER_DAY, freq="10min")
    return pd.DataFrame({"machine_id": "X", "ts": ts})


def test_lead_time_and_missed() -> None:
    ev, onset, failure = _handmade_events()
    readings = _handmade_readings()

    # alert 48h before failure, inside the window -> lead 48h
    first = failure - pd.Timedelta(hours=48)
    alerts = {"X": [AlertEvent(first, "watch")]}
    m = compute_metrics("t", alerts, ev, readings)
    assert m.n_failures == 1 and m.n_detected == 1 and m.missed == 0
    assert m.median_lead_h == pytest.approx(48.0)

    # alert before onset -> missed + false alarm
    alerts = {"X": [AlertEvent(onset - pd.Timedelta(days=5), "watch")]}
    m = compute_metrics("t", alerts, ev, readings)
    assert m.missed == 1 and m.fa_episodes == 1


def test_false_alarm_episodes_merge_within_6h() -> None:
    ev, onset, failure = _handmade_events()
    readings = _handmade_readings()
    base = onset - pd.Timedelta(days=10)
    times = [base, base + pd.Timedelta(hours=2), base + pd.Timedelta(hours=4),
             base + pd.Timedelta(hours=20)]  # last one starts a new episode
    m = compute_metrics("t", {"X": [AlertEvent(t, "watch") for t in times]}, ev, readings)
    assert m.fa_episodes == 2


def test_merge_episodes_helper() -> None:
    t0 = pd.Timestamp("2026-03-01")
    times = [t0, t0 + pd.Timedelta(hours=5, minutes=59), t0 + pd.Timedelta(hours=12)]
    assert merge_episodes(times, gap_hours=6.0) == 2


# --- health map -------------------------------------------------------------
def test_health_map_hits_knots() -> None:
    calib = Calibration(p50=1.0, p99=2.0, p999=3.0)
    cfg = DEFAULT_CONFIG
    h = calib.health(np.array([1.0, 2.0, 3.0, 6.0]), cfg)
    assert h[0] == pytest.approx(100.0)
    assert h[1] == pytest.approx(cfg.health_watch)
    assert h[2] == pytest.approx(cfg.health_act)
    assert h[3] == pytest.approx(0.0)


def test_alert_logic_requires_persistence_and_corroboration() -> None:
    cfg = DEFAULT_CONFIG
    n = 60
    ts = pd.date_range("2026-03-01", periods=n, freq="10min")
    health = np.full(n, 100.0)
    health[10:40] = 60.0            # low for 30 steps = 5h (< 6h watch requirement)
    status, alerts = derive_status(health, ts, None, cfg)
    assert not alerts                # not sustained long enough

    health[10:50] = 60.0            # 40 steps ~ 6.7h
    z = pd.DataFrame({s: np.zeros(n) for s in ("vibration_rms", "vibration_kurtosis",
                                               "temperature_c", "current_a")}, index=ts)
    z.loc[ts[10:50], "vibration_rms"] = 3.0     # one soft signal -> no corroboration
    status, alerts = derive_status(health, ts, z, cfg)
    assert not alerts

    z.loc[ts[10:50], "temperature_c"] = 3.0     # two soft signals -> corroborated
    status, alerts = derive_status(health, ts, z, cfg)
    assert len(alerts) == 1 and alerts[0].level == "watch"


# --- smoke on real dev data -------------------------------------------------
def test_detector_runs_on_dev_subset() -> None:
    from analysis.sim.make_datasets import eval_dev
    parts = []
    for sc in eval_dev()[:3]:
        parts.append(simulate(sc).readings)
    readings = pd.concat(parts, ignore_index=True)
    cutoff = readings.groupby("machine_id")["ts"].transform("min") + pd.Timedelta(days=14)
    comm, stream = readings[readings["ts"] < cutoff], readings[readings["ts"] >= cutoff]
    states = Detector(DEFAULT_CONFIG).fit_baseline(comm).update(stream)
    assert states
    assert all(0.0 <= s.health <= 100.0 for s in states)
    assert {s.status for s in states} <= {"healthy", "watch", "act_now"}
