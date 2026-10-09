import type { Status } from "./types";

// ISO strings from the simulator are naive local timestamps. We format them by
// string slicing so server and client always agree (no timezone drift).

export function fmtDateTime(iso: string): string {
  // "2026-03-01T08:00:00" -> "2026-03-01 08:00"
  return iso.slice(0, 16).replace("T", " ");
}

export function fmtTime(iso: string): string {
  return iso.slice(11, 16);
}

export function fmtDay(iso: string): string {
  return iso.slice(5, 10);
}

export function fmtShort(iso: string): string {
  return iso.slice(5, 16).replace("T", " ");
}

export function fmtDuration(hoursFromNow: number, nowIso: string): string {
  const now = Date.parse(nowIso);
  const then = now - hoursFromNow * 3600_000;
  const h = Math.round((now - then) / 3600_000);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

// Relative "time in status" between two naive ISO timestamps.
export function timeInStatus(sinceIso: string, nowIso: string): string {
  const ms = Date.parse(nowIso) - Date.parse(sinceIso);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const h = Math.round(ms / 3600_000);
  if (h < 1) return "<1 h";
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

export function fmtHours(h: number | null): string {
  if (h == null) return "—";
  if (h < 48) return `${Math.round(h)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

export function fmtSpeed(hoursPerSecond: number): string {
  if (hoursPerSecond >= 24) {
    const days = hoursPerSecond / 24;
    return days === 1 ? "1 day / s" : `${days} days / s`;
  }
  return `${hoursPerSecond} h / s`;
}

// Global palette: #C90027 / #000000 / #FFFFFF. Only these three colors (plus
// alpha of them) are used anywhere in the app.

/** Full-opacity status color, for text, dots and badges. */
export const STATUS_COLOR: Record<Status, string> = {
  healthy: "#000000",
  watch: "#C90027",
  act_now: "#C90027",
};

/** Status fill for bars/lines/cells where watch and act now must stay distinct. */
export const STATUS_FILL: Record<Status, string> = {
  healthy: "#000000",
  watch: "#C90027A6",
  act_now: "#C90027",
};

/** Badge treatment per status: solid black, red outline, solid red. */
export const STATUS_BADGE: Record<Status, { box: string; dot: string }> = {
  healthy: { box: "bg-ink/10 text-ink border-transparent", dot: "bg-ink" },
  watch: {
    box: "border-[#C90027]/45 bg-white text-[#C90027]",
    dot: "bg-[#C90027]",
  },
  act_now: { box: "bg-[#C90027] text-white border-transparent", dot: "bg-white" },
};

export const THRESHOLD = { watch: 70, act_now: 50 } as const;

export const STATUS_LABEL: Record<Status, string> = {
  healthy: "Healthy",
  watch: "Watch",
  act_now: "Act now",
};

// Health (0-100) -> status fill, using the brief's watch/act-now lines.
export function healthColor(health: number): string {
  if (health < THRESHOLD.act_now) return STATUS_FILL.act_now;
  if (health < THRESHOLD.watch) return STATUS_FILL.watch;
  return STATUS_FILL.healthy;
}

export function statusFromHealth(health: number): Status {
  if (health < THRESHOLD.act_now) return "act_now";
  if (health < THRESHOLD.watch) return "watch";
  return "healthy";
}

const SIGNAL_LABEL: Record<string, string> = {
  vibration_rms: "Vibration RMS",
  vibration_kurtosis: "Vibration kurtosis",
  temperature_c: "Temperature",
  current_a: "Current",
  load_pct: "Load",
  speed_rpm: "Speed",
  ambient_c: "Ambient",
};

export function signalLabel(name: string): string {
  if (SIGNAL_LABEL[name]) return SIGNAL_LABEL[name];
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const MODE_LABEL: Record<string, string> = {
  bearing_wear: "Bearing wear",
  cooling_fault: "Cooling fault",
  drive_load_issue: "Drive / load issue",
  sudden_fault: "Sudden fault",
};

export function modeLabel(mode: string): string {
  return MODE_LABEL[mode] ?? mode.replace(/_/g, " ");
}
