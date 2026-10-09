"""The main model M (docs/BRIEF.md 9.4): anomaly detection on rolling residual
features.

Default is a PCA **reconstruction error** model on standardized rolling
features; an Isolation Forest variant is available but is imported lazily
because some host environments block scikit-learn's compiled tree extension.
If neither is usable the honest fallback is to keep B1 (see the report).

The model is fit only on *healthy commissioning* features, so its scores are
directly comparable to the calibration percentiles.

Output convention: an anomaly score where **higher means more anomalous**.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

from .config import DetectorConfig
from .features import feature_columns


@dataclass
class AnomalyModel:
    cfg: DetectorConfig
    _model: object = None
    _scaler: object = None
    _cols: list[str] | None = field(default=None)

    def _matrix(self, X: pd.DataFrame) -> np.ndarray:
        assert self._cols is not None
        return X.reindex(columns=self._cols).astype(float).fillna(0.0).to_numpy()

    def fit(self, X: pd.DataFrame) -> "AnomalyModel":
        cfg = self.cfg
        self._cols = feature_columns(cfg)
        Xm = self._matrix(X)

        if cfg.standardize:
            self._scaler = StandardScaler().fit(Xm)
            Xm = self._scaler.transform(Xm)
        else:
            self._scaler = None

        if cfg.model_kind == "iforest":
            try:
                from sklearn.ensemble import IsolationForest  # lazy: may be blocked
            except Exception as exc:  # pragma: no cover - host-policy dependent
                raise RuntimeError(
                    "IsolationForest is unavailable in this environment; "
                    "set DetectorConfig.model_kind='pca'."
                ) from exc
            self._model = IsolationForest(
                n_estimators=cfg.iforest_estimators,
                max_samples=min(cfg.iforest_max_samples, max(len(Xm), 2)),
                random_state=cfg.random_state,
                contamination="auto",
            )
            self._model.fit(Xm)
        else:
            self._model = PCA(n_components=cfg.pca_components, random_state=cfg.random_state)
            self._model.fit(Xm)
        return self

    def score(self, X: pd.DataFrame) -> np.ndarray:
        assert self._model is not None and self._cols is not None
        Xm = self._matrix(X)
        if self._scaler is not None:
            Xm = self._scaler.transform(Xm)
        if isinstance(self._model, PCA):
            rec = self._model.inverse_transform(self._model.transform(Xm))
            return np.sqrt(((Xm - rec) ** 2).sum(axis=1))
        return -self._model.score_samples(Xm)
