"""Detector configuration.

Every tunable lives here. Per docs/BRIEF.md Section 9.5 all thresholds and
persistence parameters are chosen on eval_dev only; eval_hidden is never used
to pick anything. The values below are the defaults; the evaluation harness
overrides them when a sweep is required.

Nothing in this package may import from analysis.sim (docs/DEFINITIONS.md 6).
"""
from __future__ import annotations

from dataclasses import dataclass, field

DT_MINUTES = 10
STEPS_PER_HOUR = 60 // DT_MINUTES          # 6
STEPS_PER_DAY = 24 * STEPS_PER_HOUR        # 144

# The four signals the detector reasons about (regime-normalized).
SIGNALS = ("vibration_rms", "vibration_kurtosis", "temperature_c", "current_a")

# Human-readable units, used by explainability / report output.
SIGNAL_UNITS = {
    "vibration_rms": "mm/s",
    "vibration_kurtosis": "-",
    "temperature_c": "C",
    "current_a": "A",
}


@dataclass
class DetectorConfig:
    # --- regime model -------------------------------------------------------
    poly_degree: int = 2                # degree-2 polynomial with interactions
    ridge_alpha: float = 1.0
    ewma_taus_min: tuple[float, ...] = (45.0, 180.0)   # thermal-lag load features
    min_resid_std: float = 1e-6         # floor so z is always finite

    # --- rolling residual features -----------------------------------------
    windows_h: tuple[float, ...] = (6.0, 24.0)
    slope_windows_h: tuple[float, ...] = (24.0, 72.0)
    ewma_tau_h: float = 12.0
    min_periods_frac: float = 0.5       # a window needs half its points

    # --- control-chart statistic (B1) --------------------------------------
    cusum_k: float = 0.5                # slack, in z units
    cusum_h: float = 5.0                # decision threshold, in z units

    # --- corroboration ------------------------------------------------------
    z_soft: float = 2.0
    z_hard: float = 4.0

    # --- calibration (healthy percentiles) ---------------------------------
    p_watch: float = 99.0
    p_act: float = 99.9

    # --- health map (docs/BRIEF.md 9.5) ------------------------------------
    health_watch: float = 70.0
    health_act: float = 50.0
    health_floor_mult: float = 2.0      # 2 * p99.9 maps to health 0

    # --- alert persistence --------------------------------------------------
    watch_min_h: float = 6.0
    act_min_h: float = 3.0
    resolve_min_h: float = 12.0
    resolve_health: float = 75.0

    # --- main model (M) -----------------------------------------------------
    # "pca" is the default because it is dependency-light and always available;
    # "iforest" is attempted lazily and may be blocked by host policy.
    model_kind: str = "pca"             # "pca" | "iforest"
    standardize: bool = True            # scale features before PCA/iforest
    iforest_estimators: int = 200
    iforest_max_samples: int = 512
    pca_components: float | int = 0.9   # explained-variance if 0 < x <= 1
    random_state: int = 0


DEFAULT_CONFIG = DetectorConfig()
