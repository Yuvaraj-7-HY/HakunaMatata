"""Baselines to compare against (docs/BRIEF.md 9.4).

B0 naive   : fixed threshold on raw vibration RMS, standardized by the machine's
             commissioning mean/std. No regime adjustment.
B1 control : EWMA + CUSUM on regime-adjusted residual z, combined per machine.

Both expose fit_commissioning/score so the harness and the scoreboard treat all
methods the same way (anomaly score in, health map + alert logic out).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .config import SIGNALS, STEPS_PER_HOUR, DetectorConfig
from .features import cusum_statistic

MIN_STD = 1e-9


@dataclass
class NaiveVibrationBaseline:
    """B0: raw vibration threshold, blind to operating regime."""

    mean: float = 0.0
    std: float = 1.0

    def fit(self, commissioning_df: pd.DataFrame) -> "NaiveVibrationBaseline":
        v = commissioning_df["vibration_rms"].to_numpy(dtype=float)
        v = v[np.isfinite(v)]
        self.mean = float(np.mean(v)) if v.size else 0.0
        self.std = max(float(np.std(v)), MIN_STD) if v.size else 1.0
        return self

    def score(self, df: pd.DataFrame) -> pd.Series:
        z = (df["vibration_rms"].astype(float) - self.mean) / self.std
        return z.rename("score")


@dataclass
class EwmaCusumBaseline:
    """B1: MEWMA norm + max normalized CUSUM on residual z."""

    cfg: DetectorConfig

    def fit(self, commissioning_df: pd.DataFrame) -> "EwmaCusumBaseline":
        return self

    def score(self, z_df: pd.DataFrame) -> pd.Series:
        cfg = self.cfg
        alpha = 1.0 - float(np.exp(-1.0 / max(cfg.ewma_tau_h * STEPS_PER_HOUR, 1.0)))
        z = z_df.reindex(columns=list(SIGNALS)).astype(float).fillna(0.0)
        ewma = np.stack([z[s].ewm(alpha=alpha, adjust=False).mean().to_numpy() for s in SIGNALS])
        cusum = np.stack([cusum_statistic(z[s].to_numpy(), cfg.cusum_k) for s in SIGNALS])
        mewma_norm = np.sqrt((ewma ** 2).sum(axis=0))
        cusum_norm = cusum.max(axis=0) / max(cfg.cusum_h, 1e-9)
        return pd.Series(np.maximum(mewma_norm, cusum_norm), index=z_df.index, name="score")
