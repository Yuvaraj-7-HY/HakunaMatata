"""Machine-type parameters for the simulator.

Every value is ILLUSTRATIVE, not a real plant measurement. Units are documented
in analysis/sim/README.md. M1 defines one type (CNC spindle); M2 adds the rest.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MachineType:
    name: str
    base_vibration: float      # mm/s RMS at zero load, zero speed
    base_current: float        # A at zero load
    base_temp_rise: float      # degrees C above ambient at full load (steady state)
    load_vib_sens: float       # relative vibration gain per unit load fraction
    speed_vib_sens: float      # relative vibration gain per unit normalized speed
    load_current_sens: float   # relative current gain per unit load fraction
    thermal_tau_min: float     # first-order thermal time constant (minutes)
    speed_levels: tuple[int, ...]  # discrete rpm levels
    ambient_base: float        # mean ambient temperature (C)
    daily_amp: float           # daily ambient sinusoid amplitude (C)
    notes: str = ""


CNC_SPINDLE = MachineType(
    name="CNC spindle motor",
    base_vibration=2.2,
    base_current=14.0,
    base_temp_rise=28.0,
    load_vib_sens=0.70,
    speed_vib_sens=0.50,
    load_current_sens=0.60,
    thermal_tau_min=45.0,
    speed_levels=(1200, 1500, 1800),
    ambient_base=26.0,
    daily_amp=4.0,
    notes="Handle-belt-like spindle; illustrative only.",
)

MACHINE_TYPES: dict[str, MachineType] = {
    "cnc_spindle": CNC_SPINDLE,
}


def get_machine_type(key: str) -> MachineType:
    if key not in MACHINE_TYPES:
        raise KeyError(f"unknown machine type {key!r}; have {sorted(MACHINE_TYPES)}")
    return MACHINE_TYPES[key]
