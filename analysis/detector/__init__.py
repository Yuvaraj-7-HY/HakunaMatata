"""Causal, streaming-safe predictive-maintenance detector.

Boundary rule (docs/DEFINITIONS.md 6): nothing in this package imports from
analysis.sim. The detector sees sensor readings only; ground truth lives in
events_*.parquet and is read only by the evaluation harness and tests.
"""
from .config import DEFAULT_CONFIG, SIGNALS, DetectorConfig
from .detector import Detector, MachineState

__all__ = ["Detector", "MachineState", "DetectorConfig", "DEFAULT_CONFIG", "SIGNALS"]
