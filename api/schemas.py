"""Pydantic models for every API response shape in docs/BRIEF.md Section 11.3.

These are the single source of truth for what the frontend may expect. The mock
JSON in web/public/mock/ is validated against them by tests/test_schemas.py, and
the real API (M6) will return the same shapes.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field

Status = Literal["healthy", "watch", "act_now"]
Caveat = "Suspected, not a confirmed fault."
MOCK_DIR = Path(__file__).resolve().parent.parent / "web" / "public" / "mock"


# --- GET /fleet ------------------------------------------------------------
class Kpis(BaseModel):
    monitored: int
    healthy: int
    watch: int
    act_now: int
    alerts_today: int


class MachineSummary(BaseModel):
    id: str
    name: str
    type: str
    health: float
    status: Status
    status_since: str
    sparkline: list[float] = Field(default_factory=list, description="14 values")
    suspected_subsystem: Optional[str] = None
    load_pct: float
    speed_rpm: float


class Heatmap(BaseModel):
    machine_ids: list[str]
    days: list[str]
    values: list[list[float]]


class AlertFeedItem(BaseModel):
    id: int
    machine_id: str
    level: Status
    ts: str
    reason: str


class FleetResponse(BaseModel):
    sim_time: str
    mode: Literal["simulated_live"] = "simulated_live"
    speed: float
    playing: bool
    kpis: Kpis
    machines: list[MachineSummary]
    heatmap: Heatmap
    alerts: list[AlertFeedItem]


# --- GET /machine/{id} -----------------------------------------------------
class Regime(BaseModel):
    load_pct: float
    speed_rpm: float
    ambient_c: float


class SignalPanel(BaseModel):
    name: str
    unit: str
    value: float
    expected: float
    band_low: float
    band_high: float
    z: float


class Contributor(BaseModel):
    signal: str
    z: float
    share: float


class WhyFlagged(BaseModel):
    contributors: list[Contributor]
    drift_hours: float
    signals_agreeing: int
    signals_total: int


class ContextItem(BaseModel):
    ts: str
    text: str


class Suspected(BaseModel):
    subsystem: str
    basis: str
    caveat: str = Caveat


class MachineResponse(BaseModel):
    id: str
    name: str
    type: str
    regime: Regime
    status: Status
    health: float
    status_since: str
    signals: list[SignalPanel]
    why_flagged: WhyFlagged
    context: list[ContextItem]
    suspected: Optional[Suspected] = None
    suggested_action: str


# --- GET /machine/{id}/history --------------------------------------------
class SignalSeries(BaseModel):
    value: list[float]
    expected: list[float]
    band_low: list[float]
    band_high: list[float]


class Marker(BaseModel):
    ts: str
    type: Literal["alert", "maintenance", "regime_change"]
    label: str


class Thresholds(BaseModel):
    watch: float = 70
    act_now: float = 50


class HistoryResponse(BaseModel):
    ts: list[str]
    health: list[float]
    signals: dict[str, SignalSeries]
    thresholds: Thresholds = Thresholds()
    markers: list[Marker]


# --- GET /replay/scenarios -------------------------------------------------
class Scenario(BaseModel):
    id: str
    machine: str
    mode: str
    summary: str


# --- GET /replay/{scenario_id} --------------------------------------------
class ReplayMarkers(BaseModel):
    drift_begins: str
    alert_ours: Optional[str] = None
    alert_naive: Optional[str] = None
    failure: str


class ReplayResponse(BaseModel):
    ts: list[str]
    health_ours: list[float]
    health_naive: list[float]
    markers: ReplayMarkers
    lead_time_hours_ours: Optional[float] = None
    lead_time_hours_naive: Optional[float] = None
    false_alarms_ours: int
    false_alarms_naive: int


# --- GET /scoreboard -------------------------------------------------------
class MethodScore(BaseModel):
    median_lead_h: float
    fa_per_week: float
    missed: int


class LeadTimeHist(BaseModel):
    bins: list[float]
    ours: list[int]
    naive: list[int]


class SweepPoint(BaseModel):
    threshold: float
    fa_per_week: float
    median_lead_h: float


class ScoreboardResponse(BaseModel):
    n_failures: int
    methods: dict[str, MethodScore]
    lead_time_hist: LeadTimeHist
    sweep: list[SweepPoint]


# --- POST /sim/control -----------------------------------------------------
class SimControlRequest(BaseModel):
    action: Literal["play", "pause", "speed", "jump"]
    speed: Optional[float] = None
    scenario: Optional[str] = None
    machine_id: Optional[str] = None
    target: Optional[str] = None


class SimControlResponse(BaseModel):
    ok: bool = True
    state: dict


# --- POST /agent/ask -------------------------------------------------------
class ToolCall(BaseModel):
    name: str
    args: dict = Field(default_factory=dict)


class Citation(BaseModel):
    machine_id: str
    window: str


class AgentAskRequest(BaseModel):
    question: str


class AgentAskResponse(BaseModel):
    answer: str
    tool_calls: list[ToolCall] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    chart: Optional[dict] = None


# --- mock file map (used by tests and, later, by the web mock loader) ------
# name -> (mock file, schema). A bare list schema is given as a tuple.
MOCK_FILES: dict[str, object] = {
    "fleet": FleetResponse,
    "machine_M-04": MachineResponse,
    "machine_M-04_history": HistoryResponse,
    "replay_scenarios": list[Scenario],
    "replay": ReplayResponse,
    "scoreboard": ScoreboardResponse,
    "agent_ask": AgentAskResponse,
    "sim_control": SimControlResponse,
}


def load_mock(name: str) -> dict:
    """Load a mock JSON file by endpoint name (without .json)."""
    path = MOCK_DIR / f"{name}.json"
    return json.loads(path.read_text(encoding="utf-8"))
