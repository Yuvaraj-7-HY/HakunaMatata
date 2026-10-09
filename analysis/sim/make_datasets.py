"""Build the three datasets from one command.

    python -m analysis.sim.make_datasets            # full (90 days, dev + hidden)
    python -m analysis.sim.make_datasets --quick     # small, for a fast local check

Outputs (in data/):
    fleet_demo.parquet        events_fleet_demo.parquet
    eval_dev.parquet          events_eval_dev.parquet
    eval_hidden.parquet       events_eval_hidden.parquet

Splits are by machine and seed, never random rows. Deterministic given the seed.
Hidden fleet uses noise x1.2 and degradation ranges shifted ~30% beyond dev.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from .generator import simulate
from .scenarios import DEGRADATION_MODES, NUISANCE_KINDS, Degradation, Nuisance, Scenario

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"

_MODE_WEIGHTS = {"bearing_wear": 0.45, "cooling_fault": 0.25, "drive_load_issue": 0.20, "sudden_fault": 0.10}


@dataclass(frozen=True)
class Profile:
    noise_scale: float
    onset_range: tuple[float, float]
    duration_range: tuple[float, float]


DEV = Profile(noise_scale=1.0, onset_range=(20.0, 75.0), duration_range=(10.0, 25.0))
HIDDEN = Profile(noise_scale=1.2, onset_range=(12.0, 86.0), duration_range=(6.0, 32.0))  # shifted ~30% beyond dev

COMMISSIONING_DAYS = 14.0


def sample_degradation(rng: np.random.Generator, profile: Profile, days: float) -> Degradation:
    modes = list(_MODE_WEIGHTS)
    weights = np.array([_MODE_WEIGHTS[m] for m in modes])
    mode = str(rng.choice(modes, p=weights / weights.sum()))
    if mode == "sudden_fault":
        dur = float(rng.uniform(0.08, 0.25))  # a few hours
    else:
        dur = float(rng.uniform(*profile.duration_range))
    onset = max(float(rng.uniform(*profile.onset_range)), COMMISSIONING_DAYS)
    failure = min(onset + dur, days - 2.0)
    if failure <= onset:
        failure = onset + 0.5
    shape = str(rng.choice(["linear", "exponential"]))
    return Degradation(mode, round(onset, 2), round(failure, 2), shape)


def sample_nuisances(rng: np.random.Generator, days: float, count: int | None = None) -> list[Nuisance]:
    k = count if count is not None else int(rng.integers(1, 3))
    kinds = list(rng.choice(NUISANCE_KINDS, size=min(k, len(NUISANCE_KINDS)), replace=False))
    out: list[Nuisance] = []
    for kind in kinds:
        start = float(rng.uniform(COMMISSIONING_DAYS + 3, days - 12))
        if kind == "load_surge":
            end = start + float(rng.uniform(1.0, 3.0))
        elif kind == "heat_wave":
            end = start + float(rng.uniform(2.0, 6.0))
        elif kind == "sensor_dropout":
            end = start + float(rng.uniform(0.1, 0.5))
        elif kind == "startup_transient":
            end = start + float(rng.uniform(0.2, 0.5))
        else:  # maintenance_reset
            end = start + 0.2
        out.append(Nuisance(str(kind), round(start, 2), round(end, 2), round(float(rng.uniform(0.6, 1.0)), 2)))
    return out


def build_dataset(scenarios: list[Scenario]) -> tuple[pd.DataFrame, pd.DataFrame]:
    readings_parts, events_parts = [], []
    for sc in scenarios:
        res = simulate(sc)
        readings_parts.append(res.readings)
        events_parts.append(res.events)
    readings = pd.concat(readings_parts, ignore_index=True)
    events = pd.concat(events_parts, ignore_index=True)
    return readings, events


# --- fleet demo -------------------------------------------------------------
def fleet_demo() -> list[Scenario]:
    d = 90.0
    return [
        Scenario("demo-healthy-cnc", "M-01", "cnc_spindle", d, 101, [], [Nuisance("load_surge", 40.0, 42.0, 0.8)]),
        Scenario("demo-healthy-pump", "M-02", "hydraulic_pump", d, 102, [], [Nuisance("heat_wave", 55.0, 60.0, 0.9)]),
        Scenario("demo-healthy-lathe", "M-03", "lathe_drive", d, 103, [], []),
        Scenario("demo-slow-bearing", "M-04", "cnc_spindle", d, 104,
                 [Degradation("bearing_wear", 30.0, 85.0, "exponential")],
                 [Nuisance("load_surge", 46.0, 48.0, 0.9)]),
        Scenario("demo-slow-cooling", "M-05", "air_compressor", d, 105,
                 [Degradation("cooling_fault", 25.0, 80.0, "linear")], []),
        Scenario("demo-near-failure", "M-06", "hydraulic_pump", d, 106,
                 [Degradation("bearing_wear", 70.0, 88.0, "exponential")], []),
        Scenario("demo-nuisance", "M-07", "coolant_pump", d, 107, [],
                 [Nuisance("load_surge", 30.0, 32.0, 1.0), Nuisance("heat_wave", 50.0, 55.0, 1.0),
                  Nuisance("maintenance_reset", 65.0, 65.2, 1.0)]),
        Scenario("demo-sudden", "M-08", "air_compressor", d, 108,
                 [Degradation("sudden_fault", 60.0, 60.2, "linear")], []),
    ]


def _eval_set(prefix: str, seeds: list[int], profile: Profile, days: float,
              n_failures: int, n_nuisance: int) -> list[Scenario]:
    out: list[Scenario] = []
    rng = np.random.default_rng(1000 + seeds[0])
    for i, seed in enumerate(seeds):
        r = np.random.default_rng(seed)
        mid = f"{prefix}-{i:03d}"
        mtype = str(r.choice(["cnc_spindle", "air_compressor", "hydraulic_pump", "lathe_drive", "coolant_pump"]))
        deps: list[Degradation] = []
        if i < n_failures:
            deps.append(sample_degradation(r, profile, days))
            nus = sample_nuisances(r, days, count=int(r.integers(0, 2)))
        else:
            nus = sample_nuisances(r, days, count=int(r.integers(1, 3)))
        out.append(Scenario(mid, mid, mtype, days, seed, deps, nus, noise_scale=profile.noise_scale))
    return out


def eval_dev() -> list[Scenario]:
    return _eval_set("DEV", list(range(0, 40)), DEV, 90.0, n_failures=30, n_nuisance=10)


def eval_hidden() -> list[Scenario]:
    return _eval_set("HID", list(range(1000, 1040)), HIDDEN, 90.0, n_failures=30, n_nuisance=10)


def _report(name: str, readings: pd.DataFrame, events: pd.DataFrame) -> None:
    n_machines = readings["machine_id"].nunique()
    n_fail = int(events["failed"].fillna(False).sum())
    print(f"{name:14s} machines={n_machines:3d} rows={len(readings):7d} failures={n_fail:3d}")


def write_dataset(name: str, scenarios: list[Scenario]) -> None:
    readings, events = build_dataset(scenarios)
    DATA.mkdir(parents=True, exist_ok=True)
    readings.to_parquet(DATA / f"{name}.parquet", index=False)
    events.to_parquet(DATA / f"events_{name}.parquet", index=False)
    _report(name, readings, events)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true", help="fewer machines / shorter horizon")
    args = ap.parse_args()

    if args.quick:
        demo = fleet_demo()
        for s in demo:
            s.days = 30.0
        write_dataset("fleet_demo", demo)
        write_dataset("eval_dev", eval_dev()[:6])
        write_dataset("eval_hidden", eval_hidden()[:6])
    else:
        write_dataset("fleet_demo", fleet_demo())
        write_dataset("eval_dev", eval_dev())
        write_dataset("eval_hidden", eval_hidden())
    print(f"\nwrote parquet files to {DATA}")


if __name__ == "__main__":
    main()
