"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtHours, fmtShort, modeLabel } from "@/lib/format";
import type { ReplayResponse, Scenario } from "@/lib/types";

const MARKER_COLOR = {
  drift_begins: "#C98500",
  alert_ours: "#0F6B5C",
  alert_naive: "#7a7a7a",
  failure: "#B3261E",
} as const;

export default function ReplayExplorer({
  scenarios,
  replays,
}: {
  scenarios: Scenario[];
  replays: Record<string, ReplayResponse>;
}) {
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? "");
  const replay: ReplayResponse | undefined =
    replays[scenarioId] ?? replays[scenarios[0]?.id];
  const [reveal, setReveal] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!playing || !replay) return;
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last > 90) {
        last = now;
        setReveal((r) => {
          if (r >= replay.ts.length - 1) {
            setPlaying(false);
            return r;
          }
          return r + 1;
        });
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, replay]);

  const data = useMemo(() => {
    if (!replay) return [];
    const end = reveal + 1;
    return replay.ts.slice(0, end).map((t, i) => ({
      ts: t,
      ours: replay.health_ours[i],
      naive: replay.health_naive[i],
    }));
  }, [replay, reveal]);

  const cutoff = replay ? replay.ts[reveal] : "";
  const visibleMarkers = useMemo(() => {
    const entries: { key: string; ts: string; label: string; color: string }[] = [];
    if (!replay) return entries;
    const push = (key: keyof typeof replay.markers, label: string) => {
      const ts = replay.markers[key];
      if (ts && ts <= cutoff) {
        entries.push({ key, ts, label, color: MARKER_COLOR[key] });
      }
    };
    push("drift_begins", "drift begins");
    push("alert_ours", "our alert");
    push("alert_naive", "naive alert");
    push("failure", "failure");
    return entries;
  }, [replay, cutoff]);

  if (!replay) {
    return (
      <div className="rounded-lg border border-line bg-surface p-4 text-sm text-ink/55">
        No replay data for this scenario.
      </div>
    );
  }

  const scenario = scenarios.find((s) => s.id === scenarioId);

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Failure replay</h2>
          <p className="text-xs text-ink/50">
            {scenario
              ? `${scenario.machine} · ${modeLabel(scenario.mode)} — ${scenario.summary}`
              : ""}
          </p>
        </div>
        <div>
          <label
            htmlFor="scenario"
            className="block text-xs font-medium uppercase tracking-wide text-ink/50"
          >
            Scenario
          </label>
          <select
            id="scenario"
            value={scenarioId}
            onChange={(e) => {
              const id = e.target.value;
              const next = replays[id] ?? replays[scenarios[0]?.id];
              setScenarioId(id);
              setReveal(next ? next.ts.length - 1 : 0);
              setPlaying(false);
            }}
            className="mt-1 min-h-11 rounded-md border border-line bg-white px-3 text-sm text-ink"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.machine} · {modeLabel(s.mode)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 14, bottom: 4, left: -18 }}>
            <CartesianGrid stroke="rgba(20,32,28,0.08)" vertical={false} />
            <XAxis
              dataKey="ts"
              tickFormatter={fmtShort}
              minTickGap={40}
              tick={{ fontSize: 11, fill: "rgba(20,32,28,0.55)" }}
              stroke="rgba(20,32,28,0.2)"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "rgba(20,32,28,0.55)" }}
              stroke="rgba(20,32,28,0.2)"
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgba(20,32,28,0.12)",
                fontSize: 12,
              }}
              labelFormatter={(v) => fmtShort(String(v))}
              formatter={(v, name) => [
                Number(v).toFixed(1),
                name === "ours" ? "Ours" : "Naive",
              ]}
            />
            <ReferenceLine y={70} stroke="#C98500" strokeDasharray="4 4" />
            <ReferenceLine y={50} stroke="#B3261E" strokeDasharray="4 4" />
            {visibleMarkers.map((m) => (
              <ReferenceLine
                key={m.key}
                x={m.ts}
                stroke={m.color}
                strokeDasharray="3 3"
                label={{
                  value: m.label,
                  position: "top",
                  fill: m.color,
                  fontSize: 10,
                }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="ours"
              stroke="#0F6B5C"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="naive"
              stroke="#8a8f8c"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (reveal >= replay.ts.length - 1) setReveal(0);
            setPlaying((p) => !p);
          }}
          className="inline-flex min-h-11 items-center rounded-md bg-teal px-4 text-sm font-semibold text-white hover:bg-teal/90"
        >
          {playing ? "❚❚ Pause" : "▶ Replay"}
        </button>
        <div className="min-w-[220px] flex-1">
          <label
            htmlFor="scrub"
            className="block text-xs font-medium uppercase tracking-wide text-ink/50"
          >
            Scrub · {fmtShort(cutoff)}
          </label>
          <input
            id="scrub"
            type="range"
            min={0}
            max={replay.ts.length - 1}
            value={reveal}
            onChange={(e) => {
              setPlaying(false);
              setReveal(Number(e.target.value));
            }}
            className="mt-2 w-full"
          />
        </div>
        <div className="flex gap-2 text-xs">
          <Legend color="#0F6B5C" label="Our detector" />
          <Legend color="#8a8f8c" label="Naive threshold" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
        <Stat
          label="Lead time · ours"
          value={fmtHours(replay.lead_time_hours_ours)}
          accent="#0F6B5C"
        />
        <Stat
          label="Lead time · naive"
          value={fmtHours(replay.lead_time_hours_naive)}
          accent="#8a8f8c"
        />
        <Stat label="False alarms · ours" value={String(replay.false_alarms_ours)} />
        <Stat
          label="False alarms · naive"
          value={String(replay.false_alarms_naive)}
        />
      </div>
      <p className="mt-3 text-xs text-ink/50">
        Lead time = failure time − first alert inside the degradation window.
        Drift onset is ground truth and is never given to the detector.
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ink/60">
      <span className="h-2 w-4 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink/45">{label}</div>
      <div
        className="text-xl font-semibold tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
