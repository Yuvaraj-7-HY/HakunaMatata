// Client-side live mock stream for the fleet screen.
//
// Every machine gets a small deterministic model (seeded from its static
// health) plus randomized noise, so the chart looks like real telemetry:
// healthy units hover, degrading ones walk down through the watch (70) and
// act-now (50) lines, sit there for a while, then get "maintained" back up.

import { statusFromHealth, THRESHOLD } from "./format";
import type { MachineSummary, Status } from "./types";

export const TICK_MS = 1000;
export const SEED_SAMPLES = 45;
export const MAX_SAMPLES = 120;

export interface SimState {
  base: number;
  mode: "stable" | "degrade";
  /** Tick at which a stable machine starts degrading (Infinity = never). */
  resumeAt: number;
  belowSince: number | null;
  noise: number;
  decay: number;
  pull: number;
}

// Who degrades, and when. 0 = already degrading at first paint.
const DEGRADE_ONSET: Record<string, number | null> = {
  "M-01": null,
  "M-02": 0,
  "M-03": null,
  "M-04": 0,
  "M-05": 14,
  "M-06": 55,
  "M-07": 0,
  "M-08": 85,
};

export function initialSim(m: MachineSummary): SimState {
  const onset = DEGRADE_ONSET[m.id] ?? null;
  return {
    base: m.health,
    mode: onset === 0 ? "degrade" : "stable",
    resumeAt: onset ?? Infinity,
    belowSince: null,
    noise: 1.15,
    decay: 1.4,
    pull: 0.14,
  };
}

function clamp(v: number): number {
  return Math.max(8, Math.min(99, v));
}

export function stepValue(v: number, s: SimState, tick: number): number {
  if (s.mode === "stable" && tick >= s.resumeAt) s.mode = "degrade";

  if (s.mode === "degrade") {
    s.base = Math.max(38, s.base - s.decay);
    if (v < 45) {
      if (s.belowSince == null) s.belowSince = tick;
      else if (tick - s.belowSince >= 15) {
        // Simulated maintenance: health restored, next degradation scheduled.
        s.mode = "stable";
        s.base = 93;
        s.belowSince = null;
        s.resumeAt = tick + 30 + Math.floor(Math.random() * 25);
      }
    } else {
      s.belowSince = null;
    }
  }

  const noise = (Math.random() - 0.5) * 2 * s.noise;
  return clamp(v + noise + (s.base - v) * s.pull);
}

/** Mean-reverting history so the chart is populated on first paint. */
export function seedSeries(m: MachineSummary): number[] {
  let v = m.health;
  const out: number[] = [];
  for (let i = 0; i < SEED_SAMPLES; i++) {
    v = clamp(
      v + (Math.random() - 0.5) * 2.4 + (m.health - v) * 0.16
    );
    out.push(v);
  }
  return out;
}

export interface LiveStats {
  id: string;
  name: string;
  type: string;
  health: number;
  status: Status;
  /** Health change over the last 10 samples. */
  trend: number;
  suspected: string | null;
  samples: number;
  /** Samples since the line was last crossed from above, or null. */
  watchAgo: number | null;
  actAgo: number | null;
}

function samplesSinceCross(vals: number[], level: number): number | null {
  for (let i = vals.length - 1; i > 0; i--) {
    if (vals[i] < level && vals[i - 1] >= level) return vals.length - 1 - i;
  }
  return null;
}

export function computeStats(
  machines: MachineSummary[],
  series: Record<string, number[]>
): LiveStats[] {
  return machines.map((m) => {
    const vals = series[m.id] ?? [];
    const health = vals.length ? vals[vals.length - 1] : m.health;
    const prev =
      vals.length > 10 ? vals[vals.length - 11] : (vals[0] ?? m.health);
    return {
      id: m.id,
      name: m.name,
      type: m.type,
      health,
      status: statusFromHealth(health),
      trend: health - prev,
      suspected: m.suspected_subsystem,
      samples: vals.length,
      watchAgo: samplesSinceCross(vals, THRESHOLD.watch),
      actAgo: samplesSinceCross(vals, THRESHOLD.act_now),
    };
  });
}

export function fmtHealth(v: number): string {
  return v.toFixed(1);
}

export function trendLabel(trend: number): string {
  if (trend < -0.5) return `falling ${Math.abs(trend).toFixed(1)}`;
  if (trend > 0.5) return `rising ${trend.toFixed(1)}`;
  return "holding steady";
}
