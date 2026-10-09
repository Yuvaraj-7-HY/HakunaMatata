"""M1 demo: simulate 60 days for one machine and plot the signals.

Run from the repo root:  python -m analysis.sim.plot_demo
Writes data/m1_signals.png and prints numeric evidence separating the
load surge (a regime effect) from the bearing drift (a degradation effect).
"""
from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from .scenarios import demo_scenario
from .generator import simulate, STEPS_PER_DAY

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "m1_signals.png"


def main() -> None:
    sc = demo_scenario(days=60.0)
    res = simulate(sc)
    df = res.readings
    day = np.arange(len(df)) / STEPS_PER_DAY
    surge = sc.nuisances[0]
    deg = sc.degradations[0]

    panels = [
        ("load_pct", "Load (%)"),
        ("vibration_rms", "Vibration RMS (mm/s)"),
        ("vibration_kurtosis", "Vibration kurtosis"),
        ("temperature_c", "Temperature (C)"),
        ("current_a", "Current (A)"),
    ]
    fig, axes = plt.subplots(len(panels), 1, figsize=(11, 12), sharex=True)
    for ax, (col, label) in zip(axes, panels):
        ax.plot(day, df[col], lw=0.6, color="#14201C")
        ax.axvspan(surge.start_day, surge.end_day, color="#C98500", alpha=0.18)
        ax.axvline(deg.onset_day, color="#0F6B5C", ls="--", lw=1)
        ax.axvline(deg.failure_day, color="#B3261E", ls="--", lw=1)
        ax.set_ylabel(label, fontsize=9)
        ax.grid(alpha=0.15)
    axes[0].annotate("load surge (nuisance)", xy=(surge.start_day, 1.0), xytext=(surge.start_day, 1.15),
                     xycoords=("data", "axes fraction"), fontsize=9, color="#C98500", ha="left")
    axes[0].annotate("bearing onset", xy=(deg.onset_day, 1.0), xytext=(deg.onset_day, 1.15),
                     xycoords=("data", "axes fraction"), fontsize=9, color="#0F6B5C", ha="left")
    axes[0].annotate("failure", xy=(deg.failure_day, 1.0), xytext=(deg.failure_day, 1.15),
                     xycoords=("data", "axes fraction"), fontsize=9, color="#B3261E", ha="left")
    axes[-1].set_xlabel("days")
    fig.suptitle("M-04 CNC spindle - simulated (60 days, 10-min samples)", fontsize=12)
    fig.tight_layout(rect=(0, 0, 1, 0.98))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT, dpi=110)
    print(f"wrote {OUT}")

    # --- numeric evidence ---
    healthy = (day < 14) | ((day >= 23) & (day < 34))
    during_surge = (day >= surge.start_day) & (day < surge.end_day)
    during_drift = (day >= deg.onset_day + 8) & (day < deg.failure_day)

    def m(col, mask):
        return float(np.nanmean(df[col].to_numpy()[mask]))

    print("\n-- evidence --")
    print(f"load    healthy={m('load_pct', healthy):6.1f}  surge={m('load_pct', during_surge):6.1f}  drift={m('load_pct', during_drift):6.1f}")
    print(f"kurt    healthy={m('vibration_kurtosis', healthy):6.2f}  surge={m('vibration_kurtosis', during_surge):6.2f}  drift={m('vibration_kurtosis', during_drift):6.2f}")
    print(f"vib rms healthy={m('vibration_rms', healthy):6.2f}  surge={m('vibration_rms', during_surge):6.2f}  drift={m('vibration_rms', during_drift):6.2f}")
    print(f"temp    healthy={m('temperature_c', healthy):6.1f}  surge={m('temperature_c', during_surge):6.1f}  drift={m('temperature_c', during_drift):6.1f}")
    corr_load_vib = np.corrcoef(df["load_pct"], df["vibration_rms"])[0, 1]
    corr_load_kurt = np.corrcoef(df["load_pct"], df["vibration_kurtosis"])[0, 1]
    print(f"corr(load, vibration) = {corr_load_vib:+.2f}  (regime-driven)")
    print(f"corr(load, kurtosis)  = {corr_load_kurt:+.2f}  (near 0: kurtosis marks the drift, not load)")


if __name__ == "__main__":
    main()
