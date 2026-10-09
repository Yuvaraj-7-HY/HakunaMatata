"""Calibration, health score, and alert logic (docs/BRIEF.md 9.5).

The anomaly score `a` is calibrated on *healthy commissioning* data only, so the
percentile knots describe "this machine's own healthy behaviour" without ever
looking at held-out failures. The health map is piecewise linear:

    a = p50    -> 100
    a = p99    ->  70   (Watch boundary)
    a = p99.9  ->  50   (Act-now boundary)
    a = 2*p99.9 -> 0
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .config import SIGNALS, STEPS_PER_HOUR, DetectorConfig

STATUS_HEALTHY = "healthy"
STATUS_WATCH = "watch"
STATUS_ACT = "act_now"
_SEVERITY = {STATUS_HEALTHY: 0, STATUS_WATCH: 1, STATUS_ACT: 2}


@dataclass
class Calibration:
    p50: float
    p99: float
    p999: float

    @classmethod
    def from_scores(cls, scores: np.ndarray | pd.Series, cfg: DetectorConfig) -> "Calibration":
        a = np.asarray(scores, dtype=float)
        a = a[np.isfinite(a)]
        if a.size == 0:
            return cls(0.0, 1.0, 2.0)
        return cls(
            p50=float(np.percentile(a, 50)),
            p99=float(np.percentile(a, cfg.p_watch)),
            p999=float(np.percentile(a, cfg.p_act)),
        )

    def health(self, scores: np.ndarray | pd.Series, cfg: DetectorConfig) -> np.ndarray:
        a = np.asarray(scores, dtype=float)
        # Enforce a strictly increasing knot axis (degenerate scores -> flat 100).
        eps = 1e-9
        x1 = self.p99 if self.p99 > self.p50 + eps else self.p50 + eps
        x2 = self.p999 if self.p999 > x1 + eps else x1 + eps
        x3 = cfg.health_floor_mult * self.p999 if cfg.health_floor_mult * self.p999 > x2 + eps else x2 + eps
        xp = np.array([self.p50 - eps, x1, x2, x3])
        fp = np.array([100.0, cfg.health_watch, cfg.health_act, 0.0])
        return np.clip(np.interp(a, xp, fp), 0.0, 100.0)


@dataclass
class AlertEvent:
    ts: pd.Timestamp
    level: str


def corroboration_mask(z: pd.DataFrame | None, cfg: DetectorConfig) -> np.ndarray:
    """True where at least 2 signals |z|>soft OR any signal |z|>hard."""
    if z is None:
        return np.ones(0, dtype=bool)
    zz = z.reindex(columns=list(SIGNALS)).astype(float).to_numpy()
    n_soft = (np.abs(zz) > cfg.z_soft).sum(axis=1)
    n_hard = (np.abs(zz) > cfg.z_hard).sum(axis=1)
    return (n_soft >= 2) | (n_hard >= 1)


def derive_status(health: np.ndarray, timestamps: pd.Index,
                  z: pd.DataFrame | None, cfg: DetectorConfig
                  ) -> tuple[np.ndarray, list[AlertEvent]]:
    """Run the hysteresis state machine. Returns (status array, alerts on rise)."""
    health = np.asarray(health, dtype=float)
    n = len(health)
    if z is None:
        corr = np.ones(n, dtype=bool)
    else:
        corr = corroboration_mask(z, cfg)
        if len(corr) != n:
            corr = np.ones(n, dtype=bool)

    watch_steps = max(1, int(round(cfg.watch_min_h * STEPS_PER_HOUR)))
    act_steps = max(1, int(round(cfg.act_min_h * STEPS_PER_HOUR)))
    resolve_steps = max(1, int(round(cfg.resolve_min_h * STEPS_PER_HOUR)))

    status = STATUS_HEALTHY
    low_w = low_a = high = 0
    out = np.empty(n, dtype=object)
    alerts: list[AlertEvent] = []
    ts = pd.Index(timestamps)

    for i in range(n):
        h = health[i]
        low_w = low_w + 1 if h < cfg.health_watch else 0
        low_a = low_a + 1 if h < cfg.health_act else 0
        high = high + 1 if h > cfg.resolve_health else 0

        new = status
        if status == STATUS_HEALTHY:
            if low_a >= act_steps:
                new = STATUS_ACT
            elif low_w >= watch_steps and corr[i]:
                new = STATUS_WATCH
        elif status == STATUS_WATCH:
            if low_a >= act_steps:
                new = STATUS_ACT
            elif high >= resolve_steps:
                new = STATUS_HEALTHY
        else:  # act_now
            if high >= resolve_steps:
                new = STATUS_HEALTHY

        if new != status and _SEVERITY[new] > _SEVERITY[status]:
            alerts.append(AlertEvent(ts[i], new))
        status = new
        out[i] = status

    return out, alerts
