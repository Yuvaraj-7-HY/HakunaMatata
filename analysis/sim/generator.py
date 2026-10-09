"""The simulator: turns a Scenario into sensor readings + ground truth.

One row per machine per 10 minutes. Deterministic given the scenario seed.
Sensor readings only -- ground truth (events) is returned separately and is
never fed to the detector.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from .machines import get_machine_type
from .scenarios import Degradation, Nuisance, Scenario, degradation_effects, progress

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
    """Job-driven load: piecewise-constant fractions in [0.2, 0.95], jobs 2-8h."""
    load = np.empty(n)
    i = 0
    while i < n:
        dur = int(rng.integers(12, 48))
        load[i:i + dur] = rng.uniform(0.20, 0.95)
        i += dur
    return load[:n]


def _apply_load_surge(load: np.ndarray, day: np.ndarray, nu: Nuisance) -> None:
    mask = (day >= nu.start_day) & (day < nu.end_day)
    if mask.any():
        # surge pushes load toward the top of the range, with a little variation
        load[mask] = np.clip(0.75 + 0.20 * nu.magnitude, 0.0, 0.98)


def simulate(scenario: Scenario) -> SimResult:
    mt = get_machine_type(scenario.machine_type)
    rng = np.random.default_rng(scenario.seed)
    n = int(round(scenario.days * STEPS_PER_DAY))

    ts = [START + timedelta(minutes=DT_MIN * i) for i in range(n)]
    t_min = np.arange(n) * DT_MIN
    day = t_min / (60 * 24)
    hour_of_day = (START.hour + t_min / 60.0) % 24.0

    # --- operating regime ---
    load = _piecewise_load(rng, n)
    for nu in scenario.nuisances:
        if nu.kind == "load_surge":
            _apply_load_surge(load, day, nu)
        elif nu.kind == "heat_wave":
            pass  # M2
        elif nu.kind == "startup_transient":
            pass  # M2
        elif nu.kind == "sensor_dropout":
            pass  # M2
        elif nu.kind == "maintenance_reset":
            pass  # M2
        else:
            raise KeyError(f"nuisance {nu.kind!r} not implemented yet (M2)")

    levels = np.array(mt.speed_levels, dtype=float)
    speed = levels[np.clip((load * len(levels)).astype(int), 0, len(levels) - 1)]
    speed_factor = (speed - levels.min()) / (levels.max() - levels.min())

    ambient = (
        mt.ambient_base
        + mt.daily_amp * np.sin(2 * np.pi * (hour_of_day - 9.0) / 24.0)
        + _ar1(rng, n, 0.95, 0.3)  # slow day-to-day wander
    )
    for nu in scenario.nuisances:
        if nu.kind == "heat_wave":
            mask = (day >= nu.start_day) & (day < nu.end_day)
            ambient[mask] += 5.0 * nu.magnitude

    # --- healthy signals ---
    vib_noise = _ar1(rng, n, 0.70, 0.12 * mt.base_vibration)
    vibration = mt.base_vibration * (1 + mt.load_vib_sens * load + mt.speed_vib_sens * speed_factor) + vib_noise

    kurtosis = 3.0 + _ar1(rng, n, 0.60, 0.06)

    thermal_alpha = DT_MIN / mt.thermal_tau_min
    temperature = np.empty(n)
    temperature[0] = ambient[0] + mt.base_temp_rise * load[0] * 0.5
    t_noise = rng.normal(0.0, 0.4, n)
    for i in range(1, n):
        target = ambient[i] + mt.base_temp_rise * load[i]
        temperature[i] = temperature[i - 1] + thermal_alpha * (target - temperature[i - 1]) + t_noise[i]

    current = mt.base_current * (1 + mt.load_current_sens * load) + _ar1(rng, n, 0.70, 0.06 * mt.base_current)

    # --- degradation (ground truth drives the physics, not the detector) ---
    for d in scenario.degradations:
        g = np.array([progress(x, d) for x in day])
        active = g > 0.0
        if not active.any():
            continue
        eff = [degradation_effects(d.mode, gi) for gi in g]
        kurtosis[active] += np.array([e.get("kurtosis_add", 0.0) for e in eff])[active]
        vibration = vibration * np.array([e.get("vibration_mul", 1.0) for e in eff])
        temperature = temperature + np.array([e.get("temperature_add", 0.0) for e in eff])

    # --- sensor dropouts (NaN) ---
    for nu in scenario.nuisances:
        if nu.kind == "sensor_dropout":
            mask = (day >= nu.start_day) & (day < nu.end_day)
            vibration[mask] = np.nan

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

    events = pd.DataFrame([
        {
            "machine_id": scenario.machine_id,
            "mode": d.mode,
            "component": d.component,
            "onset_ts": START + timedelta(days=d.onset_day),
            "failure_ts": START + timedelta(days=d.failure_day),
        }
        for d in scenario.degradations
    ])

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

    return SimResult(readings=readings, events=events, nuisances=nuisances)
