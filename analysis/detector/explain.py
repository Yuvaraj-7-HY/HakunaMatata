"""Explainability and *suspected* subsystem attribution (docs/BRIEF.md 9.7).

Contributors are signals ranked by |z| with shares. A small rule table maps the
pattern of drifted signals to a suspected subsystem. Everything here is
deliberately hedged: we never claim a confirmed fault.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import SIGNALS

CAVEAT = "Suspected, not a confirmed fault."

SIGNAL_LABELS = {
    "vibration_rms": "vibration RMS",
    "vibration_kurtosis": "vibration kurtosis",
    "temperature_c": "temperature",
    "current_a": "current",
}

SUBSYSTEM_GENERAL = "General degradation: inspect"
SUBSYSTEM_BEARING = "Rotating assembly (bearings)"
SUBSYSTEM_COOLING = "Cooling and lubrication"
SUBSYSTEM_DRIVE = "Drive and load path"


def contributors(z_row: pd.Series | dict, top_n: int = 4) -> list[dict]:
    vals = {s: float(z_row.get(s, np.nan)) for s in SIGNALS}
    items = [(s, v) for s, v in vals.items() if np.isfinite(v)]
    total = sum(abs(v) for _, v in items) or 1.0
    items.sort(key=lambda kv: abs(kv[1]), reverse=True)
    return [
        {"signal": s, "z": round(v, 3), "share": round(abs(v) / total, 3)}
        for s, v in items[:top_n]
    ]


def suspected_subsystem(z_row: pd.Series | dict) -> tuple[str, str] | None:
    """Map a residual-z pattern to (subsystem, basis). None if nothing stands out."""
    g = lambda s: float(z_row.get(s, 0.0))
    vib, kurt = g("vibration_rms"), g("vibration_kurtosis")
    temp, cur = g("temperature_c"), g("current_a")
    hi = lambda x: x > 2.0

    if hi(vib) or hi(kurt):
        if hi(temp) and hi(cur):
            return SUBSYSTEM_GENERAL, "vibration, temperature and current all drifted"
        if hi(temp):
            return SUBSYSTEM_BEARING, "vibration and kurtosis drifted, with temperature rising late"
        return SUBSYSTEM_BEARING, "vibration and kurtosis drifted"
    if hi(temp) and not hi(cur):
        return SUBSYSTEM_COOLING, "temperature rose relative to the load-expected value"
    if hi(cur):
        return SUBSYSTEM_DRIVE, "current drifted with only modest vibration change"
    return None


def context_items(regime_row: pd.Series, regime_ref: dict) -> list[dict]:
    """Short, honest notes on regime conditions that explain part of a deviation."""
    out: list[dict] = []
    load = float(regime_row.get("load_pct", 0.0))
    ambient = float(regime_row.get("ambient_c", 0.0))
    load_ref = float(regime_ref.get("load_pct", load))
    amb_ref = float(regime_ref.get("ambient_c", ambient))
    if load - load_ref >= 10.0:
        out.append({"text": f"Load is {load - load_ref:.0f} points above the commissioning average; "
                            "part of the vibration/current rise may be explained by load."})
    if ambient - amb_ref >= 3.0:
        out.append({"text": f"Ambient is {ambient - amb_ref:.1f} C above the commissioning average; "
                            "part of the temperature rise may be explained by ambient."})
    if not out:
        out.append({"text": "No unusual load or ambient excursion; the deviation is not explained by regime."})
    return out
