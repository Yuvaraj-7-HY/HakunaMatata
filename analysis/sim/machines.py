"""Machine-type parameters for the simulator.

Every value is ILLUSTRATIVE, not a real plant measurement. Units are documented
in analysis/sim/README.md.

The five types mirror the facility reference in
data/Machines_in_a_Manufacturing_Facility.pdf: the CNC spindle (item 1) is the
most Mysuru-relevant, and motors/pumps/compressors (items 5, 6, 7) share a
bearing-driven failure pattern.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MachineType:
    key: str
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
    key="cnc_spindle", name="CNC spindle motor",
    base_vibration=2.2, base_current=14.0, base_temp_rise=28.0,
    load_vib_sens=0.70, speed_vib_sens=0.50, load_current_sens=0.60,
    thermal_tau_min=45.0, speed_levels=(1200, 1500, 1800),
    ambient_base=26.0, daily_amp=4.0,
    notes="Handle-belt spindle; kurtosis-sensitive bearing wear.",
)

AIR_COMPRESSOR = MachineType(
    key="air_compressor", name="Air compressor",
    base_vibration=3.0, base_current=22.0, base_temp_rise=35.0,
    load_vib_sens=0.50, speed_vib_sens=0.30, load_current_sens=0.50,
    thermal_tau_min=60.0, speed_levels=(600, 900, 1200),
    ambient_base=26.0, daily_amp=4.0,
    notes="High thermal mass; cooling faults show as temperature drift.",
)

HYDRAULIC_PUMP = MachineType(
    key="hydraulic_pump", name="Hydraulic pump",
    base_vibration=2.6, base_current=18.0, base_temp_rise=30.0,
    load_vib_sens=0.60, speed_vib_sens=0.35, load_current_sens=0.70,
    thermal_tau_min=50.0, speed_levels=(1000, 1200, 1450),
    ambient_base=27.0, daily_amp=3.5,
    notes="Load-heavy; current rises before vibration in drive issues.",
)

LATHE_DRIVE = MachineType(
    key="lathe_drive", name="Lathe drive",
    base_vibration=2.0, base_current=12.0, base_temp_rise=25.0,
    load_vib_sens=0.65, speed_vib_sens=0.55, load_current_sens=0.55,
    thermal_tau_min=40.0, speed_levels=(600, 900, 1200),
    ambient_base=26.0, daily_amp=4.0,
    notes="Headstock bearing wear; chuck run-out raises kurtosis.",
)

COOLANT_PUMP = MachineType(
    key="coolant_pump", name="Coolant pump",
    base_vibration=1.8, base_current=6.0, base_temp_rise=18.0,
    load_vib_sens=0.50, speed_vib_sens=0.40, load_current_sens=0.45,
    thermal_tau_min=35.0, speed_levels=(1450, 2900),
    ambient_base=25.0, daily_amp=3.0,
    notes="Low power; cavitation shows as vibration and current variance.",
)

MACHINE_TYPES: dict[str, MachineType] = {
    m.key: m for m in (CNC_SPINDLE, AIR_COMPRESSOR, HYDRAULIC_PUMP, LATHE_DRIVE, COOLANT_PUMP)
}


def get_machine_type(key: str) -> MachineType:
    if key not in MACHINE_TYPES:
        raise KeyError(f"unknown machine type {key!r}; have {sorted(MACHINE_TYPES)}")
    return MACHINE_TYPES[key]
