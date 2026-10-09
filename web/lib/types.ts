// Mirrors api/schemas.py. Keep in sync with the pydantic models (M6 will codegen if needed).

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
