"""The simulator: turns a Scenario into sensor readings + ground truth.

One row per machine per 10 minutes. Deterministic given the scenario seed.
Readings only -- ground truth (events) is returned separately and is never fed
to the detector.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from .machines import get_machine_type
from .scenarios import Nuisance, Scenario, degradation_effects, progress

DT_MIN = 10                      # sample interval, minutes
STEPS_PER_DAY = 24 * 60 // DT_MIN  # 144
START = datetime(2026, 3, 1, 8, 0, 0)

SIGNAL_COLUMNS = [
    "ts", "machine_id", "vibration_rms", "vibration_kurtosis",
    "temperature_c", "current_a", "load_pct", "speed_rpm", "ambient_c",
]


@dataclass
class SimResult:
    readings: pd.DataFrame
    events: pd.DataFrame
    nuisances: list[dict]


def _ar1(rng: np.random.Generator, n: int, phi: float, sigma: float) -> np.ndarray:
    e = rng.normal(0.0, sigma, n)
    x = np.empty(n)
    x[0] = e[0]
    for i in range(1, n):
        x[i] = phi * x[i - 1] + e[i]
    return x


def _piecewise_load(rng: np.random.Generator, n: int) -> np.ndarray:
    load = np.empty(n)
    i = 0
    while i < n:
        dur = int(rng.integers(12, 48))
        load[i:i + dur] = rng.uniform(0.20, 0.95)
        i += dur
    return load[:n]


def _shift_startup_kick(t_min: np.ndarray, start_hour: int) -> tuple[np.ndarray, np.ndarray]:
    """A short vibration/temperature kick for ~30 min after each shift start (6/14/22h)."""
    min_of_day = (start_hour * 60 + t_min) % 1440
    shift_min = (min_of_day - 6 * 60) % 480  # 8-hour shifts starting at 06:00
    active = shift_min < 30
    vib = np.where(active, 1.1 * np.exp(-shift_min / 8.0), 0.0)
    temp = np.where(active, 2.0 * np.exp(-shift_min / 10.0), 0.0)
    return vib, temp


def simulate(scenario: Scenario) -> SimResult:
    mt = get_machine_type(scenario.machine_type)
    rng = np.random.default_rng(scenario.seed)
    ns = scenario.noise_scale
    n = int(round(scenario.days * STEPS_PER_DAY))

    ts = [START + timedelta(minutes=DT_MIN * i) for i in range(n)]
    t_min = np.arange(n) * DT_MIN
    day = t_min / (60 * 24)
    hour_of_day = (START.hour + t_min / 60.0) % 24.0

    # --- operating regime ---
    load = _piecewise_load(rng, n)
    for nu in scenario.nuisances:
        if nu.kind == "load_surge":
            mask = (day >= nu.start_day) & (day < nu.end_day)
            load[mask] = np.clip(0.75 + 0.20 * nu.magnitude, 0.0, 0.98)
        elif nu.kind in ("heat_wave", "startup_transient", "sensor_dropout", "maintenance_reset"):
            pass  # applied below
        else:
            raise KeyError(f"nuisance {nu.kind!r} not implemented")

    levels = np.array(mt.speed_levels, dtype=float)
    speed = levels[np.clip((load * len(levels)).astype(int), 0, len(levels) - 1)]
    speed_factor = (speed - levels.min()) / (levels.max() - levels.min())

    ambient = (
        mt.ambient_base
        + mt.daily_amp * np.sin(2 * np.pi * (hour_of_day - 9.0) / 24.0)
        + _ar1(rng, n, 0.95, 0.3 * ns)
    )
    for nu in scenario.nuisances:
        if nu.kind == "heat_wave":
            mask = (day >= nu.start_day) & (day < nu.end_day)
            ambient[mask] += 5.0 * nu.magnitude

    # --- healthy signals ---
    vib_noise = _ar1(rng, n, 0.70, 0.12 * mt.base_vibration * ns)
    vibration = mt.base_vibration * (1 + mt.load_vib_sens * load + mt.speed_vib_sens * speed_factor) + vib_noise

    kurtosis = 3.0 + _ar1(rng, n, 0.60, 0.06 * ns)

    thermal_alpha = DT_MIN / mt.thermal_tau_min
    temperature = np.empty(n)
    temperature[0] = ambient[0] + mt.base_temp_rise * load[0] * 0.5
    t_noise = rng.normal(0.0, 0.4 * ns, n)
    for i in range(1, n):
        target = ambient[i] + mt.base_temp_rise * load[i]
        temperature[i] = temperature[i - 1] + thermal_alpha * (target - temperature[i - 1]) + t_noise[i]

    current = mt.base_current * (1 + mt.load_current_sens * load) + _ar1(rng, n, 0.70, 0.06 * mt.base_current * ns)

    # startup transients (inherent, every shift)
    vib_kick, temp_kick = _shift_startup_kick(t_min, START.hour)
    vibration = vibration + vib_kick
    temperature = temperature + temp_kick

    # --- degradation (ground truth drives the physics, not the detector) ---
    reset_days = [nu.start_day for nu in scenario.nuisances if nu.kind == "maintenance_reset"]
    event_rows = []
    for d in scenario.degradations:
        g = np.array([progress(x, d) for x in day])
        cancelled = False
        for R in reset_days:
            if d.onset_day < R < d.failure_day:
                g[day >= R] = 0.0
                cancelled = True
        eff = [degradation_effects(d.mode, gi) for gi in g]
        kurtosis = kurtosis + np.array([e.get("kurtosis_add", 0.0) for e in eff])
        vibration = vibration * np.array([e.get("vibration_mul", 1.0) for e in eff])
        temperature = temperature + np.array([e.get("temperature_add", 0.0) for e in eff])
        current = current * np.array([e.get("current_mul", 1.0) for e in eff])
        ripple = np.array([e.get("current_ripple_amp", 0.0) for e in eff])
        if ripple.any():
            current = current + ripple * mt.base_current * np.sin(2 * np.pi * t_min / 30.0)

        failed = (not cancelled) and (d.failure_day <= scenario.days)
        event_rows.append({
            "machine_id": scenario.machine_id,
            "mode": d.mode,
            "component": d.component_name(),
            "onset_ts": START + timedelta(days=d.onset_day),
            "failure_ts": START + timedelta(days=d.failure_day) if d.failure_day <= scenario.days else pd.NaT,
            "failed": bool(failed),
            "cancelled_by_reset": bool(cancelled),
        })

    # --- remaining nuisances ---
    for nu in scenario.nuisances:
        mask = (day >= nu.start_day) & (day < nu.end_day)
        if nu.kind == "sensor_dropout":
            vibration[mask] = np.nan
        elif nu.kind == "maintenance_reset":
            blip = (day >= nu.start_day) & (day < nu.start_day + 0.25)
            vibration[blip] += 0.8
            temperature[blip] += 3.0

    readings = pd.DataFrame({
        "ts": ts,
        "machine_id": scenario.machine_id,
        "vibration_rms": np.round(vibration, 3),
        "vibration_kurtosis": np.round(kurtosis, 3),
        "temperature_c": np.round(temperature, 2),
        "current_a": np.round(current, 3),
        "load_pct": np.round(load * 100.0, 1),
        "speed_rpm": speed.astype(int),
        "ambient_c": np.round(ambient, 2),
    })[SIGNAL_COLUMNS]

    nuisances = [
        {
            "machine_id": scenario.machine_id,
            "kind": nu.kind,
            "start_ts": START + timedelta(days=nu.start_day),
            "end_ts": START + timedelta(days=nu.end_day),
            "magnitude": nu.magnitude,
        }
        for nu in scenario.nuisances
    ]
    nuisance_json = json.dumps([
        {"kind": nu["kind"], "start_ts": nu["start_ts"].isoformat(), "end_ts": nu["end_ts"].isoformat()}
        for nu in nuisances
    ])

    if event_rows:
        events = pd.DataFrame(event_rows)
    else:
        events = pd.DataFrame([{
            "machine_id": scenario.machine_id, "mode": None, "component": None,
            "onset_ts": None, "failure_ts": None, "failed": False, "cancelled_by_reset": False,
        }])
    events["nuisance_events"] = nuisance_json

    return SimResult(readings=readings, events=events, nuisances=nuisances)
