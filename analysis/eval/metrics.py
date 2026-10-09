"""Evaluation metrics (docs/BRIEF.md 10, docs/DEFINITIONS.md).

Definitions used here:
  lead_time       = failure_ts - first_alert_ts, for the first alert in [onset, failure)
  detection_delay = first_alert_ts - onset_ts
  missed          = no alert inside [onset, failure)
  false alarm     = an alert outside every degradation window (episodes merged
                    within 6h); on a healthy machine every alert is false.
  fa_per_week     = false-alarm episodes / total machine-weeks observed

Alerts of either level (watch or act_now) count. Windows for false-alarm
exclusion use every event that has a valid onset/failure (including ones later
cancelled by a maintenance reset), so legitimate pre-reset warnings are not
punished.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

MERGE_GAP_HOURS = 6.0


@dataclass
class FailureOutcome:
    machine_id: str
    mode: str
    lead_h: float | None
    delay_h: float | None
    missed: bool


@dataclass
class MethodMetrics:
    name: str
    n_failures: int = 0
    n_detected: int = 0
    missed: int = 0
    median_lead_h: float = float("nan")
    mean_lead_h: float = float("nan")
    fa_episodes: int = 0
    machine_weeks: float = 0.0
    fa_per_week: float = float("nan")
    lead_times: list[float] = field(default_factory=list)
    outcomes: list[FailureOutcome] = field(default_factory=list)
    per_mode: dict[str, dict] = field(default_factory=dict)


def merge_episodes(times: list[pd.Timestamp], gap_hours: float = MERGE_GAP_HOURS) -> int:
    if not times:
        return 0
    ts = sorted(pd.Timestamp(t) for t in times)
    episodes = 1
    for prev, cur in zip(ts, ts[1:]):
        if (cur - prev).total_seconds() / 3600.0 > gap_hours:
            episodes += 1
    return episodes


def _valid_windows(ev: pd.DataFrame) -> list[tuple[pd.Timestamp, pd.Timestamp]]:
    out = []
    for _, row in ev.iterrows():
        onset, failure = row.get("onset_ts"), row.get("failure_ts")
        if pd.notna(onset) and pd.notna(failure):
            out.append((pd.Timestamp(onset), pd.Timestamp(failure)))
    return out


def _in_any_window(ts: pd.Timestamp, windows: list[tuple]) -> bool:
    return any(o <= ts < f for o, f in windows)


def aggregate(lead_times: list[float]) -> tuple[float, float]:
    if not lead_times:
        return float("nan"), float("nan")
    return float(np.median(lead_times)), float(np.mean(lead_times))


def compute_metrics(name: str, alerts_by_machine: dict[str, list],
                    events: pd.DataFrame, readings: pd.DataFrame) -> MethodMetrics:
    """alerts_by_machine: machine_id -> list with .ts and .level."""
    m = MethodMetrics(name=name)
    events_by_machine = {mid: df for mid, df in events.groupby("machine_id")}
    start = readings.groupby("machine_id")["ts"].min()
    end = readings.groupby("machine_id")["ts"].max()
    machine_weeks = float(((end - start).dt.total_seconds() / (3600 * 24 * 7)).sum())
    m.machine_weeks = machine_weeks

    mode_lead: dict[str, list[float]] = {}
    mode_total: dict[str, int] = {}
    mode_detected: dict[str, int] = {}

    for mid, ev in events_by_machine.items():
        alerts = sorted(alerts_by_machine.get(mid, []), key=lambda a: a.ts)
        windows = _valid_windows(ev)

        false = [a.ts for a in alerts if not _in_any_window(pd.Timestamp(a.ts), windows)]
        m.fa_episodes += merge_episodes(false)

        for _, row in ev.iterrows():
            if not bool(row.get("failed", False)):
                continue
            mode = row.get("mode")
            onset, failure = pd.Timestamp(row["onset_ts"]), pd.Timestamp(row["failure_ts"])
            in_win = [a.ts for a in alerts if onset <= pd.Timestamp(a.ts) < failure]
            mode_total[mode] = mode_total.get(mode, 0) + 1
            m.n_failures += 1
            if in_win:
                first = min(in_win)
                lead = (failure - first).total_seconds() / 3600.0
                delay = (first - onset).total_seconds() / 3600.0
                m.lead_times.append(lead)
                m.n_detected += 1
                mode_lead.setdefault(mode, []).append(lead)
                mode_detected[mode] = mode_detected.get(mode, 0) + 1
                m.outcomes.append(FailureOutcome(mid, mode, lead, delay, False))
            else:
                m.missed += 1
                m.outcomes.append(FailureOutcome(mid, mode, None, None, True))

    m.median_lead_h, m.mean_lead_h = aggregate(m.lead_times)
    m.fa_per_week = m.fa_episodes / machine_weeks if machine_weeks > 0 else float("nan")
    for mode, total in mode_total.items():
        leads = mode_lead.get(mode, [])
        med, mean = aggregate(leads)
        m.per_mode[mode] = {
            "n": total,
            "detected": mode_detected.get(mode, 0),
            "missed": total - mode_detected.get(mode, 0),
            "median_lead_h": med,
            "mean_lead_h": mean,
        }
    return m


def to_dict(m: MethodMetrics) -> dict:
    return {
        "name": m.name,
        "n_failures": m.n_failures,
        "n_detected": m.n_detected,
        "missed": m.missed,
        "median_lead_h": None if np.isnan(m.median_lead_h) else round(m.median_lead_h, 2),
        "mean_lead_h": None if np.isnan(m.mean_lead_h) else round(m.mean_lead_h, 2),
        "fa_episodes": m.fa_episodes,
        "machine_weeks": round(m.machine_weeks, 2),
        "fa_per_week": None if np.isnan(m.fa_per_week) else round(m.fa_per_week, 3),
        "per_mode": {
            k: {kk: (None if isinstance(vv, float) and np.isnan(vv) else (round(vv, 2) if isinstance(vv, float) else vv))
                for kk, vv in v.items()}
            for k, v in m.per_mode.items()
        },
    }
