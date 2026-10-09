"""Degradation modes, nuisance events, and named scenarios.

A degradation event is a window [onset_day, failure_day) over which progress g
goes from 0 to 1. A nuisance event looks like trouble but is not (load surge,
heat wave, startup transient, sensor dropout, maintenance reset).

degradation_effects() is the single place that maps (mode, g) to signal effects.
The detector never imports this module.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

DEGRADATION_MODES = ("bearing_wear", "cooling_fault", "drive_load_issue", "sudden_fault")
NUISANCE_KINDS = ("load_surge", "heat_wave", "startup_transient", "sensor_dropout", "maintenance_reset")

COMPONENT_BY_MODE = {
    "bearing_wear": "Rotating assembly (bearings)",
    "cooling_fault": "Cooling and lubrication",
    "drive_load_issue": "Drive and load path",
    "sudden_fault": "General degradation: inspect",
}


@dataclass(frozen=True)
class Degradation:
    mode: str            # one of DEGRADATION_MODES
    onset_day: float
    failure_day: float
    shape: str = "linear"   # linear | exponential
    component: str | None = None

    def component_name(self) -> str:
        return self.component or COMPONENT_BY_MODE.get(self.mode, "General degradation: inspect")


@dataclass(frozen=True)
class Nuisance:
    kind: str
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
    noise_scale: float = 1.0   # 1.0 for dev; ~1.2 for the hidden fleet


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
    """Signal effects of a mode at progress g.

    Keys:
      kurtosis_add        additive to vibration kurtosis
      vibration_mul       multiplicative on vibration RMS
      temperature_add     additive (C) on temperature after the thermal model
      current_mul         multiplicative on current
      current_ripple_amp  added ripple amplitude (relative to base current)

    Ordering per mode is deliberate (see analysis/sim/README.md).
    """
    if g <= 0.0:
        return {}
    if mode == "bearing_wear":
        # kurtosis early, RMS mid, temperature late
        return {
            "kurtosis_add": 3.0 * math.sqrt(g),
            "vibration_mul": 1.0 + 0.9 * (g ** 1.5),
            "temperature_add": 12.0 * (g ** 3),
        }
    if mode == "cooling_fault":
        # temperature rises relative to load-expected; vibration unchanged
        return {"temperature_add": 16.0 * (g ** 0.7)}
    if mode == "drive_load_issue":
        # current rises with ripple; vibration modest
        return {
            "current_mul": 1.0 + 0.40 * g,
            "current_ripple_amp": 0.12 * g,
            "vibration_mul": 1.0 + 0.18 * g,
        }
    if mode == "sudden_fault":
        # step change within a few hours: everything jumps at once
        return {
            "kurtosis_add": 2.5 * g,
            "vibration_mul": 1.0 + 1.4 * g,
            "temperature_add": 10.0 * g,
            "current_mul": 1.0 + 0.5 * g,
        }
    raise KeyError(f"mode {mode!r} not implemented; have {DEGRADATION_MODES}")


# --- Named scenario (M1 demo, kept intact) ----------------------------------
def demo_scenario(days: float = 60.0) -> Scenario:
    """One machine, one degradation (bearing wear), one nuisance (load surge)."""
    return Scenario(
        name="m1_bearing_wear",
        machine_id="M-04",
        machine_type="cnc_spindle",
        days=days,
        seed=7,
        degradations=[Degradation("bearing_wear", 35.0, 55.0, "exponential")],
        nuisances=[Nuisance("load_surge", 18.0, 22.0, magnitude=0.95)],
    )
