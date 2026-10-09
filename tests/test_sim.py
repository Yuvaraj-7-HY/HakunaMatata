"""M1 tests: simulator determinism and that the signals behave as designed.

Run: pytest -q
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from analysis.sim.generator import STEPS_PER_DAY, simulate
from analysis.sim.scenarios import demo_scenario


def _day_index(df: pd.DataFrame) -> np.ndarray:
    return np.arange(len(df)) / STEPS_PER_DAY


def test_same_seed_is_identical() -> None:
    a = simulate(demo_scenario(days=15.0))
    b = simulate(demo_scenario(days=15.0))
    pd.testing.assert_frame_equal(a.readings, b.readings)


def test_different_seed_differs() -> None:
    a = demo_scenario(days=15.0)
    b = demo_scenario(days=15.0)
    b.seed = a.seed + 1
    ra, rb = simulate(a).readings, simulate(b).readings
    assert not np.allclose(ra["vibration_rms"], rb["vibration_rms"])


def test_ground_truth_window_is_valid() -> None:
    res = simulate(demo_scenario(days=60.0))
    assert len(res.events) == 1
    ev = res.events.iloc[0]
    assert ev["mode"] == "bearing_wear"
    assert ev["onset_ts"] < ev["failure_ts"]


def test_load_surge_raises_load_but_not_kurtosis() -> None:
    sc = demo_scenario(days=60.0)
    df = simulate(sc).readings
    day = _day_index(df)
    surge = sc.nuisances[0]
    healthy = (day < 14) | ((day >= 23) & (day < 34))
    during = (day >= surge.start_day) & (day < surge.end_day)

    load_healthy = df["load_pct"].to_numpy()[healthy].mean()
    load_surge = df["load_pct"].to_numpy()[during].mean()
    assert load_surge > load_healthy + 20.0  # surge clearly raises load

    kurt_healthy = df["vibration_kurtosis"].to_numpy()[healthy].mean()
    kurt_surge = df["vibration_kurtosis"].to_numpy()[during].mean()
    assert abs(kurt_surge - kurt_healthy) < 0.15  # kurtosis ignores load


def test_bearing_wear_raises_kurtosis_before_load_does() -> None:
    sc = demo_scenario(days=60.0)
    df = simulate(sc).readings
    day = _day_index(df)
    healthy = (day >= 23) & (day < 34)
    drift = (day >= sc.degradations[0].onset_day + 8) & (day < sc.degradations[0].failure_day)

    kurt_healthy = df["vibration_kurtosis"].to_numpy()[healthy].mean()
    kurt_drift = df["vibration_kurtosis"].to_numpy()[drift].mean()
    assert kurt_drift > kurt_healthy + 1.0

    # load is NOT elevated during the drift (so the drift is not a load effect)
    load_healthy = df["load_pct"].to_numpy()[healthy].mean()
    load_drift = df["load_pct"].to_numpy()[drift].mean()
    assert load_drift < load_healthy + 15.0
