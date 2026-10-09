"""Regime normalization: the crux of the detector (docs/BRIEF.md 9.2).

Fit, per machine, an expected-value model of each signal given the operating
regime (load, lagged/EWMA load for thermal lag, speed, ambient). Residuals are
standardized with the machine's *commissioning-period* residual standard
deviation to get z-scores. Without this step the detector is just a load
detector.

Causality: the model and the residual scales are fit once on the first healthy
days (commissioning) and then only ever *applied*. EWMA load features are
recursive (past-only), so the transform is streaming-safe.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import PolynomialFeatures

from .config import DT_MINUTES, SIGNALS, DetectorConfig


def _ewma_alpha(tau_min: float) -> float:
    return 1.0 - float(np.exp(-DT_MINUTES / max(tau_min, DT_MINUTES)))


def _speed_factor(speed: pd.Series, lo: float, hi: float) -> pd.Series:
    if hi <= lo:
        return pd.Series(0.0, index=speed.index)
    return (speed.astype(float) - lo) / (hi - lo)


def base_features(df: pd.DataFrame, speed_lo: float, speed_hi: float,
                  cfg: DetectorConfig) -> pd.DataFrame:
    """Raw (pre-polynomial) regime features, all causal."""
    out = pd.DataFrame(index=df.index)
    out["load"] = df["load_pct"].astype(float) / 100.0
    out["ambient"] = df["ambient_c"].astype(float)
    out["speed"] = _speed_factor(df["speed_rpm"], speed_lo, speed_hi)
    for tau in cfg.ewma_taus_min:
        col = f"ewma_load_{int(tau)}"
        out[col] = (df["load_pct"].astype(float) / 100.0).ewm(
            alpha=_ewma_alpha(tau), adjust=False).mean()
    return out


@dataclass
class MachineRegimeModel:
    """Expected-value model + residual scaling for one machine."""

    cfg: DetectorConfig
    speed_lo: float = 0.0
    speed_hi: float = 1.0
    _poly: PolynomialFeatures | None = None
    # signal -> ("ridge", Ridge) | ("const", mean)
    _models: dict[str, tuple] | None = None
    _resid_std: dict[str, float] | None = None
    _feature_names: list[str] | None = None

    def fit(self, df: pd.DataFrame) -> "MachineRegimeModel":
        cfg = self.cfg
        self.speed_lo = float(df["speed_rpm"].min())
        self.speed_hi = float(df["speed_rpm"].max())
        feats = base_features(df, self.speed_lo, self.speed_hi, cfg)

        self._poly = PolynomialFeatures(degree=cfg.poly_degree, include_bias=False)
        X = self._poly.fit_transform(feats.to_numpy())
        self._feature_names = list(self._poly.get_feature_names_out(feats.columns))

        self._models = {}
        self._resid_std = {}
        for sig in SIGNALS:
            y = df[sig].to_numpy(dtype=float)
            mask = np.isfinite(y) & np.isfinite(X).all(axis=1)
            if mask.sum() < cfg.poly_degree + 2:
                # Degenerate machine: fall back to a constant predictor.
                mu = float(np.nanmean(y)) if np.isfinite(y).any() else 0.0
                self._models[sig] = ("const", mu)
                self._resid_std[sig] = max(float(np.nanstd(y)), cfg.min_resid_std)
                continue
            m = Ridge(alpha=cfg.ridge_alpha)
            m.fit(X[mask], y[mask])
            resid = y[mask] - m.predict(X[mask])
            self._models[sig] = ("ridge", m)
            self._resid_std[sig] = max(float(np.std(resid)), cfg.min_resid_std)
        return self

    def _predict(self, feats: pd.DataFrame) -> dict[str, np.ndarray]:
        assert self._poly is not None and self._models is not None
        X = self._poly.transform(feats.to_numpy())
        out: dict[str, np.ndarray] = {}
        for sig, entry in self._models.items():
            kind = entry[0]
            if kind == "const":
                out[sig] = np.full(len(feats), entry[1])
            else:
                out[sig] = entry[1].predict(X)
        return out

    def expected_and_z(self, df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
        """Return (expected, z) frames aligned to df.index."""
        feats = base_features(df, self.speed_lo, self.speed_hi, self.cfg)
        preds = self._predict(feats)
        expected = pd.DataFrame(preds, index=df.index)
        z = pd.DataFrame(index=df.index)
        assert self._resid_std is not None
        for sig in SIGNALS:
            resid = df[sig].to_numpy(dtype=float) - preds[sig]
            z[sig] = resid / self._resid_std[sig]
            # Sensor dropout -> unknown, not anomalous.
            z.loc[~np.isfinite(df[sig].to_numpy(dtype=float)), sig] = np.nan
        return expected, z

    def expected(self, df: pd.DataFrame) -> pd.DataFrame:
        return self.expected_and_z(df)[0]

    def residual_z(self, df: pd.DataFrame) -> pd.DataFrame:
        return self.expected_and_z(df)[1]
