"""Evaluation harness command line.

    python -m analysis.eval.harness --dataset eval_dev

Fits B0 (naive), B1 (EWMA/CUSUM) and M (main model) on the commissioning period
of every machine, scores the rest, applies the shared health/alert logic, and
reports lead time, false alarms per machine-week and missed failures against the
ground-truth events. Thresholds/persistence come from config.py and are chosen
on eval_dev only.

Writes:
    data/<dataset>_scoreboard.json   (machine-readable metrics)
    docs/REPORT.md                   (human-readable skeleton, filled in)
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from analysis.detector.baselines import EwmaCusumBaseline, NaiveVibrationBaseline
from analysis.detector.config import DEFAULT_CONFIG, DetectorConfig
from analysis.detector.detector import Detector
from analysis.detector.health import Calibration, derive_status

from .metrics import MethodMetrics, compute_metrics, to_dict
from .report import render_report

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
DOCS = ROOT / "docs"
COMMISSIONING_DAYS = 14.0

FA_BUDGET_PER_WEEK = 0.5


def load_dataset(name: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    readings = pd.read_parquet(DATA / f"{name}.parquet")
    events = pd.read_parquet(DATA / f"events_{name}.parquet")
    return readings.sort_values(["machine_id", "ts"]).reset_index(drop=True), events


def commission_ends(readings: pd.DataFrame, days: float = COMMISSIONING_DAYS) -> pd.Series:
    return readings.groupby("machine_id")["ts"].min() + pd.Timedelta(days=days)


def split_commissioning(readings: pd.DataFrame, days: float = COMMISSIONING_DAYS):
    ends = commission_ends(readings, days)
    is_comm = readings["ts"] < readings["machine_id"].map(ends)
    return readings[is_comm].copy(), readings[~is_comm].copy()


# --- methods ----------------------------------------------------------------
def run_b0(readings: pd.DataFrame, events: pd.DataFrame, cfg: DetectorConfig):
    comm, _ = split_commissioning(readings)
    fitted, comm_scores = {}, []
    for mid, g in readings.groupby("machine_id"):
        b = NaiveVibrationBaseline().fit(comm[comm["machine_id"] == mid])
        fitted[mid] = b
        comm_scores.append(b.score(comm[comm["machine_id"] == mid]))
    calib = Calibration.from_scores(pd.concat(comm_scores).to_numpy(), cfg)

    alerts_by_machine = {}
    for mid, g in readings.groupby("machine_id"):
        g = g.sort_values("ts")
        health = calib.health(fitted[mid].score(g), cfg)
        _, alerts = derive_status(health, g["ts"], None, cfg)   # B0 does not corroborate
        alerts_by_machine[mid] = alerts
    return compute_metrics("B0_naive", alerts_by_machine, events, readings), alerts_by_machine


def _regime_frames(readings: pd.DataFrame, comm: pd.DataFrame, cfg: DetectorConfig):
    from analysis.detector.features import build_features
    from analysis.detector.regime import MachineRegimeModel

    ends = commission_ends(readings)
    out = {}
    for mid, g in readings.groupby("machine_id"):
        g = g.sort_values("ts").reset_index(drop=True)
        cm = comm[comm["machine_id"] == mid].sort_values("ts").reset_index(drop=True)
        rm = MachineRegimeModel(cfg).fit(cm)
        z = rm.residual_z(g)
        feats = build_features(z, cfg)
        is_comm = (g["ts"] < ends[mid]).to_numpy()
        out[mid] = (g, z, feats, is_comm)
    return out


def run_b1(readings: pd.DataFrame, events: pd.DataFrame, cfg: DetectorConfig):
    comm, _ = split_commissioning(readings)
    frames = _regime_frames(readings, comm, cfg)
    base = EwmaCusumBaseline(cfg)

    comm_scores = pd.concat([base.score(z)[mask] for (_, z, _, mask) in frames.values()])
    calib = Calibration.from_scores(comm_scores.to_numpy(), cfg)

    alerts_by_machine = {}
    for mid, (g, z, _, _) in frames.items():
        health = calib.health(base.score(z), cfg)
        _, alerts = derive_status(health, g["ts"], z, cfg)
        alerts_by_machine[mid] = alerts
    return compute_metrics("B1_ewma_cusum", alerts_by_machine, events, readings), alerts_by_machine


def run_m(readings: pd.DataFrame, events: pd.DataFrame, cfg: DetectorConfig):
    comm, stream = split_commissioning(readings)
    det = Detector(cfg).fit_baseline(comm)
    det.update(stream)
    alerts_by_machine = det.alerts_by_machine
    return compute_metrics("M_model", alerts_by_machine, events, readings), alerts_by_machine


# --- selection --------------------------------------------------------------
def select_best(results: list[MethodMetrics]) -> str:
    """Fewest missed, then highest median lead among methods under the FA budget,
    then lowest false-alarm rate. Reported honestly in the report."""
    def key(m: MethodMetrics):
        import math
        med = 0.0 if math.isnan(m.median_lead_h) else m.median_lead_h
        fa = float("inf") if (m.fa_per_week is None or math.isnan(m.fa_per_week)) else m.fa_per_week
        under = fa <= FA_BUDGET_PER_WEEK
        return (-int(under), m.missed, -med, fa)
    return sorted(results, key=key)[0].name


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Run the detector evaluation harness.")
    ap.add_argument("--dataset", default="eval_dev", help="eval_dev | eval_hidden | fleet_demo")
    ap.add_argument("--json-out", default=None)
    args = ap.parse_args(argv)

    readings, events = load_dataset(args.dataset)
    cfg = DEFAULT_CONFIG

    results, alerts_all = [], {}
    for runner in (run_b0, run_b1, run_m):
        m, alerts = runner(readings, events, cfg)
        results.append(m)
        alerts_all[m.name] = alerts
        print(f"  {m.name:16s} median_lead={m.median_lead_h:6.1f}h  "
              f"detected={m.n_detected}/{m.n_failures}  "
              f"fa/week={m.fa_per_week:5.2f}  missed={m.missed}")

    best = select_best(results)
    print(f"\nselected: {best}  (fa budget {FA_BUDGET_PER_WEEK}/week)")

    payload = {
        "dataset": args.dataset,
        "fa_budget_per_week": FA_BUDGET_PER_WEEK,
        "selected": best,
        "methods": {m.name: to_dict(m) for m in results},
    }
    DATA.mkdir(parents=True, exist_ok=True)
    out = Path(args.json_out) if args.json_out else DATA / f"{args.dataset}_scoreboard.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"wrote {out}")

    if args.dataset == "eval_dev":
        (DOCS / "REPORT.md").write_text(render_report(payload), encoding="utf-8")
        print(f"wrote {DOCS / 'REPORT.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
