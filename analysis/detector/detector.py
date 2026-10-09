"""The detector orchestrator (docs/BRIEF.md 9.1).

    det = Detector()
    det.fit_baseline(commissioning_df)     # first 14 healthy days, all machines
    states = det.update(batch_df)          # incremental; never sees the future

`update` returns one MachineState per reading in the batch. Every downstream
computation is causal: the regime model and residual scales are fit on
commissioning only, rolling windows are trailing, EWMA/CUSUM are recursive, and
the alert logic is a forward state machine. This is what
tests/test_detector.py::test_causality verifies.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .config import SIGNALS, DetectorConfig, DEFAULT_CONFIG
from .explain import contributors, suspected_subsystem
from .features import build_features
from .health import Calibration, derive_status
from .model import AnomalyModel
from .regime import MachineRegimeModel

STATUS_HEALTHY = "healthy"


@dataclass
class MachineState:
    machine_id: str
    ts: pd.Timestamp
    health: float
    status: str
    status_since: pd.Timestamp
    contributors: list[dict] = field(default_factory=list)
    suspected_subsystem: str | None = None
    basis: str | None = None
    drift_hours: float = 0.0
    signals_agreeing: int = 0
    signals_total: int = len(SIGNALS)
    z: dict = field(default_factory=dict)


def _status_since(status: np.ndarray, ts: pd.Index) -> list:
    out = []
    cur = None
    since = None
    for s, t in zip(status, ts):
        if s != cur:
            cur, since = s, t
        out.append(since)
    return out


def _consecutive_below(health: np.ndarray, threshold: float) -> np.ndarray:
    run = np.zeros(len(health), dtype=int)
    c = 0
    for i, h in enumerate(health):
        c = c + 1 if h < threshold else 0
        run[i] = c
    return run


class Detector:
    def __init__(self, config: DetectorConfig | None = None) -> None:
        self.cfg = config or DEFAULT_CONFIG
        self.model = AnomalyModel(self.cfg)
        self.calib: Calibration | None = None
        self.regimes: dict[str, MachineRegimeModel] = {}
        self.history: dict[str, pd.DataFrame] = {}
        self.alerts_by_machine: dict[str, list] = {}
        self._fitted = False

    # --- offline fit --------------------------------------------------------
    def fit_baseline(self, commissioning_df: pd.DataFrame) -> "Detector":
        self.model = AnomalyModel(self.cfg)
        self.regimes, self.history = {}, {}
        self.alerts_by_machine = {}
        for mid, df in commissioning_df.groupby("machine_id"):
            df = df.sort_values("ts").reset_index(drop=True)
            self.regimes[mid] = MachineRegimeModel(self.cfg).fit(df)
            self.history[mid] = df

        feats = []
        for mid, rm in self.regimes.items():
            z = rm.residual_z(self.history[mid])
            feats.append(build_features(z, self.cfg))
        X = pd.concat(feats, ignore_index=True)
        self.model.fit(X)
        self.calib = Calibration.from_scores(self.model.score(X), self.cfg)
        self._fitted = True
        return self

    # --- streaming update ---------------------------------------------------
    def update(self, batch_df: pd.DataFrame) -> list[MachineState]:
        if not self._fitted or self.calib is None:
            raise RuntimeError("call fit_baseline() before update()")
        states: list[MachineState] = []
        for mid, new in batch_df.groupby("machine_id"):
            if mid not in self.regimes:
                # Unseen machine: fit a provisional regime model on this batch
                # rather than crash; a real deployment would refuse.
                new = new.sort_values("ts").reset_index(drop=True)
                self.regimes[mid] = MachineRegimeModel(self.cfg).fit(new)
                self.history[mid] = new.iloc[0:0]
            new = new.sort_values("ts").reset_index(drop=True)
            hist = pd.concat([self.history[mid], new], ignore_index=True)
            self.history[mid] = hist

            z = self.regimes[mid].residual_z(hist)
            feats = build_features(z, self.cfg)
            scores = self.model.score(feats)
            health = self.calib.health(scores, self.cfg)
            status, alerts_full = derive_status(health, hist["ts"], z, self.cfg)

            n_new = len(new)
            lo = len(hist) - n_new
            new_ts = set(pd.Timestamp(t) for t in new["ts"])
            bucket = self.alerts_by_machine.setdefault(mid, [])
            for a in alerts_full:
                if pd.Timestamp(a.ts) in new_ts:
                    bucket.append(a)
            since = _status_since(status, hist["ts"])
            below = _consecutive_below(health, self.cfg.health_watch)

            for j in range(lo, len(hist)):
                z_row = {s: float(z[s].iloc[j]) for s in SIGNALS}
                n_soft = int(sum(1 for s in SIGNALS if np.isfinite(z_row[s]) and abs(z_row[s]) > self.cfg.z_soft))
                sus = suspected_subsystem(z_row)
                states.append(MachineState(
                    machine_id=mid,
                    ts=hist["ts"].iloc[j],
                    health=float(health[j]),
                    status=str(status[j]),
                    status_since=since[j],
                    contributors=contributors(z_row),
                    suspected_subsystem=sus[0] if sus else None,
                    basis=sus[1] if sus else None,
                    drift_hours=float(below[j]) / 6.0,   # steps -> hours
                    signals_agreeing=n_soft,
                    signals_total=len(SIGNALS),
                    z=z_row,
                ))
        return states
