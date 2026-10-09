"""Degradation modes, nuisance events, and named scenarios.

A degradation event is a window [onset_day, failure_day) over which progress g
goes from 0 to 1. A nuisance event looks like trouble but is not (load surge,
heat wave, ...). M1 implements the bearing_wear mode and the load_surge nuisance;
M2 adds cooling_fault, drive_load_issue, sudden_fault, and the other nuisances.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Degradation:
    mode: str            # bearing_wear | cooling_fault | drive_load_issue | sudden_fault
    component: str
    onset_day: float
    failure_day: float
    shape: str = "linear"   # linear | exponential


@dataclass(frozen=True)
class Nuisance:
    kind: str            # load_surge | heat_wave | startup_transient | sensor_dropout | maintenance_reset
    start_day: float
    end_day: float
    magnitude: float = 1.0


@dataclass
class Scenario:
    name: str
    machine_id: str
    machine_type: str
    days: float
    seed: int
    degradations: list[Degradation] = field(default_factory=list)
    nuisances: list[Nuisance] = field(default_factory=list)


def progress(day: float, d: Degradation) -> float:
    """g(t): 0 before onset, 1 at/after failure."""
    if day <= d.onset_day:
        return 0.0
    if day >= d.failure_day:
        return 1.0
    p = (day - d.onset_day) / (d.failure_day - d.onset_day)
    if d.shape == "exponential":
        return (math.exp(3.0 * p) - 1.0) / (math.exp(3.0) - 1.0)
    return p


def degradation_effects(mode: str, g: float) -> dict[str, float]:
    """Additive/multiplicative effect of a mode at progress g on the signals.

    bearing_wear: kurtosis rises EARLY (sqrt), RMS rises MID (g), temperature
    rises LATE (g^3) -- three separable shapes so a plot shows the ordering.
    """
    if g <= 0.0:
        return {}
    if mode == "bearing_wear":
        return {
            "kurtosis_add": 3.0 * math.sqrt(g),
            "vibration_mul": 1.0 + 0.9 * (g ** 1.5),
            "temperature_add": 12.0 * (g ** 3),
        }
    raise KeyError(f"mode {mode!r} not implemented yet (M2)")


# --- Named scenarios --------------------------------------------------------
def demo_scenario(days: float = 60.0) -> Scenario:
    """M1 demo: 60 days, a load surge (days 18-22), then bearing wear from
    day 35 to failure on day 55."""
    return Scenario(
        name="m1_bearing_wear",
        machine_id="M-04",
        machine_type="cnc_spindle",
        days=days,
        seed=7,
        degradations=[Degradation("bearing_wear", "Rotating assembly (bearings)", 35.0, 55.0, "exponential")],
        nuisances=[Nuisance("load_surge", 18.0, 22.0, magnitude=0.95)],
    )
