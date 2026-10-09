"""Causal rolling features on regime-adjusted residual z-scores (docs/BRIEF.md 9.3).

Everything here uses only the current sample and samples before it: rolling
windows are trailing, EWMA and CUSUM are recursive. A feature frame computed on
data truncated at time T therefore equals the full-data frame at every ts <= T
(this is asserted by tests/test_detector.py::test_causality).

A sample is 10 minutes: 6h = 36 steps, 24h = 144 steps, 72h = 432 steps.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import SIGNALS, STEPS_PER_HOUR, DetectorConfig


def _steps(hours: float) -> int:
    return max(2, int(round(hours * STEPS_PER_HOUR)))


def cusum_statistic(x: np.ndarray, k: float) -> np.ndarray:
    """Two-sided CUSUM statistic max(pos, neg), causal by construction."""
    pos = np.zeros(len(x))
    neg = np.zeros(len(x))
    cp = cn = 0.0
    for i in range(len(x)):
        cp = max(0.0, cp + x[i] - k)
        cn = max(0.0, cn - x[i] - k)
        pos[i] = cp
        neg[i] = cn
    return np.maximum(pos, neg)


def build_features(z: pd.DataFrame, cfg: DetectorConfig) -> pd.DataFrame:
    """Rolling features from a residual-z frame (columns = SIGNALS).

    Causal: each output row depends only on that row and earlier rows.
    """
    zc = z.reindex(columns=list(SIGNALS)).astype(float).fillna(0.0)
    out = pd.DataFrame(index=z.index)

    for sig in SIGNALS:
        s = zc[sig]
        for w in cfg.windows_h:
            n = _steps(w)
            mp = max(2, int(n * cfg.min_periods_frac))
            out[f"{sig}__mean_{int(w)}h"] = s.rolling(n, min_periods=mp).mean()
            out[f"{sig}__std_{int(w)}h"] = s.rolling(n, min_periods=mp).std()
            out[f"{sig}__absmax_{int(w)}h"] = s.abs().rolling(n, min_periods=mp).max()

        # EWMA of z (recursive, past-only).
        alpha = 1.0 - float(np.exp(-1.0 / max(cfg.ewma_tau_h * STEPS_PER_HOUR, 1.0)))
        out[f"{sig}__ewma_{int(cfg.ewma_tau_h)}h"] = s.ewm(alpha=alpha, adjust=False).mean()

        # Two-sided CUSUM (recursive, past-only).
        out[f"{sig}__cusum"] = cusum_statistic(s.to_numpy(), cfg.cusum_k)

        # Trailing trend: change in mean over the second half of the window.
        for w in cfg.slope_windows_h:
            n = _steps(w)
            mp = max(2, int(n * cfg.min_periods_frac))
            half = max(1, n // 2)
            rm = s.rolling(n, min_periods=mp).mean()
            out[f"{sig}__trend_{int(w)}h"] = (rm - rm.shift(half)) / float(half)

    # Cross-signal corroboration counters (instantaneous, past-only is trivially true).
    absz = zc.abs()
    out["n_soft"] = (absz > cfg.z_soft).sum(axis=1).astype(float)
    out["n_hard"] = (absz > cfg.z_hard).sum(axis=1).astype(float)
    out["sum_abs_z"] = absz.sum(axis=1)

    return out


def feature_columns(cfg: DetectorConfig) -> list[str]:
    """Deterministic ordering of build_features output (for the model)."""
    cols: list[str] = []
    for sig in SIGNALS:
        for w in cfg.windows_h:
            cols += [f"{sig}__mean_{int(w)}h", f"{sig}__std_{int(w)}h", f"{sig}__absmax_{int(w)}h"]
        cols.append(f"{sig}__ewma_{int(cfg.ewma_tau_h)}h")
        cols.append(f"{sig}__cusum")
        for w in cfg.slope_windows_h:
            cols.append(f"{sig}__trend_{int(w)}h")
    cols += ["n_soft", "n_hard", "sum_abs_z"]
    return cols
