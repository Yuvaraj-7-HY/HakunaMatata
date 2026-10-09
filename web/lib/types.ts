// Mirrors api/schemas.py. Keep in sync with the pydantic models.

export type Status = "healthy" | "watch" | "act_now";

export interface Kpis {
  monitored: number;
  healthy: number;
  watch: number;
  act_now: number;
  alerts_today: number;
}

export interface MachineSummary {
  id: string;
  name: string;
  type: string;
  health: number;
  status: Status;
  status_since: string;
  sparkline: number[];
  suspected_subsystem: string | null;
  load_pct: number;
  speed_rpm: number;
}

export interface Heatmap {
  machine_ids: string[];
  days: string[];
  values: number[][];
}

export interface AlertFeedItem {
  id: number;
  machine_id: string;
  level: Status;
  ts: string;
  reason: string;
}

export interface FleetResponse {
  sim_time: string;
  mode: "simulated_live";
  speed: number;
  playing: boolean;
  kpis: Kpis;
  machines: MachineSummary[];
  heatmap: Heatmap;
  alerts: AlertFeedItem[];
}

// --- GET /machine/{id} -----------------------------------------------------
export interface Regime {
  load_pct: number;
  speed_rpm: number;
  ambient_c: number;
}

export interface SignalPanel {
  name: string;
  unit: string;
  value: number;
  expected: number;
  band_low: number;
  band_high: number;
  z: number;
}

export interface Contributor {
  signal: string;
  z: number;
  share: number;
}

export interface WhyFlagged {
  contributors: Contributor[];
  drift_hours: number;
  signals_agreeing: number;
  signals_total: number;
}

export interface ContextItem {
  ts: string;
  text: string;
}

export interface Suspected {
  subsystem: string;
  basis: string;
  caveat: string;
}

export interface MachineResponse {
  id: string;
  name: string;
  type: string;
  regime: Regime;
  status: Status;
  health: number;
  status_since: string;
  signals: SignalPanel[];
  why_flagged: WhyFlagged;
  context: ContextItem[];
  suspected: Suspected | null;
  suggested_action: string;
}

// --- GET /machine/{id}/history --------------------------------------------
export interface SignalSeries {
  value: number[];
  expected: number[];
  band_low: number[];
  band_high: number[];
}

export type MarkerType = "alert" | "maintenance" | "regime_change";

export interface Marker {
  ts: string;
  type: MarkerType;
  label: string;
}

export interface Thresholds {
  watch: number;
  act_now: number;
}

export interface HistoryResponse {
  ts: string[];
  health: number[];
  signals: Record<string, SignalSeries>;
  thresholds: Thresholds;
  markers: Marker[];
}

export type HistoryRange = "24h" | "7d" | "30d";

// --- GET /replay/scenarios -------------------------------------------------
export interface Scenario {
  id: string;
  machine: string;
  mode: string;
  summary: string;
}

// --- GET /replay/{scenario_id} --------------------------------------------
export interface ReplayMarkers {
  drift_begins: string;
  alert_ours: string | null;
  alert_naive: string | null;
  failure: string;
}

export interface ReplayResponse {
  ts: string[];
  health_ours: number[];
  health_naive: number[];
  markers: ReplayMarkers;
  lead_time_hours_ours: number | null;
  lead_time_hours_naive: number | null;
  false_alarms_ours: number;
  false_alarms_naive: number;
}

// --- GET /scoreboard -------------------------------------------------------
export interface MethodScore {
  median_lead_h: number;
  fa_per_week: number;
  missed: number;
}

export interface LeadTimeHist {
  bins: number[];
  ours: number[];
  naive: number[];
}

export interface SweepPoint {
  threshold: number;
  fa_per_week: number;
  median_lead_h: number;
}

export interface ScoreboardResponse {
  n_failures: number;
  methods: Record<string, MethodScore>;
  lead_time_hist: LeadTimeHist;
  sweep: SweepPoint[];
}

// --- POST /agent/ask -------------------------------------------------------
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface Citation {
  machine_id: string;
  window: string;
}

export interface AgentAskResponse {
  answer: string;
  tool_calls: ToolCall[];
  citations: Citation[];
  chart: Record<string, unknown> | null;
}
