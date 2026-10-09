"""M2 tests: full simulator (5 types, 4 modes, all nuisances, datasets).

Run: pytest -q
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from analysis.sim.generator import STEPS_PER_DAY, simulate
from analysis.sim.machines import MACHINE_TYPES
from analysis.sim.make_datasets import DEV, HIDDEN, build_dataset, eval_dev, eval_hidden
from analysis.sim.scenarios import (
    DEGRADATION_MODES, NUISANCE_KINDS, Degradation, Nuisance, Scenario,
)


def _day(df: pd.DataFrame) -> np.ndarray:
    return np.arange(len(df)) / STEPS_PER_DAY


def _mean(df: pd.DataFrame, col: str, lo: float, hi: float) -> float:
    d = _day(df)
    m = (d >= lo) & (d < hi)
    return float(np.nanmean(df[col].to_numpy()[m]))


def test_all_five_machine_types_simulate() -> None:
    assert len(MACHINE_TYPES) == 5
    for key in MACHINE_TYPES:
        sc = Scenario(f"t-{key}", f"M-{key}", key, 10.0, 1,
                      [Degradation("bearing_wear", 3.0, 9.0)])
        df = simulate(sc).readings
        assert len(df) == 10 * STEPS_PER_DAY
        assert df["vibration_rms"].notna().all()
        assert df["speed_rpm"].nunique() >= 1


def test_each_degradation_mode_has_expected_signature() -> None:
    baseline = (0.0, 8.0)
    # mode -> (signal, minimum rise, window to measure the rise in)
    checks = {
        "bearing_wear": ("vibration_kurtosis", 1.0, (40.0, 45.0), 30.0),
        "cooling_fault": ("temperature_c", 5.0, (40.0, 45.0), 30.0),
        "drive_load_issue": ("current_a", 1.5, (40.0, 45.0), 30.0),
        "sudden_fault": ("vibration_rms", 1.0, (44.9, 45.0), 44.9),  # short window by design
    }
    for mode, (col, delta, late, onset) in checks.items():
        sc = Scenario(f"m-{mode}", "M-x", "cnc_spindle", 45.5, 3,
                      [Degradation(mode, onset, 45.0)])
        df = simulate(sc).readings
        base = _mean(df, col, *baseline)
        drift = _mean(df, col, *late)
        assert drift > base + delta, f"{mode}: {col} {base:.2f} -> {drift:.2f}"


def test_all_nuisances_run() -> None:
    for kind in NUISANCE_KINDS:
        sc = Scenario(f"n-{kind}", "M-n", "hydraulic_pump", 40.0, 5,
                      [Degradation("bearing_wear", 10.0, 30.0)],
                      [Nuisance(kind, 18.0, 20.0, 1.0)])
        df = simulate(sc).readings
        assert len(df) == 40 * STEPS_PER_DAY


def test_maintenance_reset_returns_to_baseline() -> None:
    sc = Scenario("reset", "M-r", "cnc_spindle", 60.0, 9,
                  [Degradation("bearing_wear", 20.0, 55.0, "exponential")],
                  [Nuisance("maintenance_reset", 38.0, 38.2, 1.0)])
    res = simulate(sc)
    df = res.readings
    before = _mean(df, "vibration_kurtosis", 30.0, 37.0)
    after = _mean(df, "vibration_kurtosis", 42.0, 58.0)
    assert before > 3.3            # was degrading before the reset
    assert abs(after - 3.0) < 0.25  # returned to baseline after replacement
    assert bool(res.events.iloc[0]["cancelled_by_reset"]) is True
    assert bool(res.events.iloc[0]["failed"]) is False


def test_datasets_are_deterministic() -> None:
    a_r, a_e = build_dataset(eval_dev()[:5])
    b_r, b_e = build_dataset(eval_dev()[:5])
    pd.testing.assert_frame_equal(a_r, b_r)
    pd.testing.assert_frame_equal(a_e, b_e)


def test_eval_splits_are_disjoint_and_shaped() -> None:
    dev, hid = eval_dev(), eval_hidden()
    dev_seeds = {s.seed for s in dev}
    hid_seeds = {s.seed for s in hid}
    assert dev_seeds.isdisjoint(hid_seeds)          # no leakage by seed
    assert len(dev) == 40 and len(hid) == 40
    assert DEV.noise_scale == 1.0 and HIDDEN.noise_scale == 1.2
    # hidden onset range extends beyond dev
    assert HIDDEN.onset_range[0] < DEV.onset_range[0]
    assert HIDDEN.onset_range[1] > DEV.onset_range[1]


def test_event_windows_valid_and_after_commissioning() -> None:
    readings, events = build_dataset(eval_dev())
    real = events[events["mode"].notna()]
    onset = pd.to_datetime(real["onset_ts"])
    failure = pd.to_datetime(real["failure_ts"])
    assert (onset < failure).all()
    start = readings["ts"].min()
    assert (onset - start).dt.days.min() >= 14
