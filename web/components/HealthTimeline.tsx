"use client";

import { useMemo, useState } from "react";
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
import { fmtShort } from "@/lib/format";
import type { HistoryRange, HistoryResponse, Marker } from "@/lib/types";

const RANGES: { key: HistoryRange; label: string; points: number }[] = [
  { key: "24h", label: "24 h", points: 24 },
  { key: "7d", label: "7 d", points: 168 },
  { key: "30d", label: "30 d", points: 720 },
];

const MARKER_COLOR: Record<Marker["type"], string> = {
  alert: "#B3261E",
  maintenance: "#0F6B5C",
  regime_change: "#C98500",
};

function MarkerLabel(m: Marker) {
  return `${m.label}`;
}

export default function HealthTimeline({
  history,
}: {
  history: HistoryResponse;
}) {
  const [range, setRange] = useState<HistoryRange>("24h");
  const cfg = RANGES.find((r) => r.key === range) ?? RANGES[0];

  const { data, markers } = useMemo(() => {
    const start = Math.max(0, history.ts.length - cfg.points);
    const rows = history.ts.slice(start).map((t, i) => ({
      ts: t,
      health: history.health[start + i],
    }));
    const windowStart = history.ts[start];
    const inWindow = history.markers.filter((m) => m.ts >= windowStart);
    return { data: rows, markers: inWindow };
  }, [history, cfg.points]);

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Health timeline</h2>
          <p className="text-xs text-ink/50">
            Watch &lt; 70 · Act now &lt; 50 · normal band above 70
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Time range"
          className="inline-flex rounded-md border border-line p-0.5"
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={
                "min-h-9 rounded px-3 text-xs font-medium " +
                (range === r.key
                  ? "bg-teal text-white"
                  : "text-ink/60 hover:text-ink")
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
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
              ticks={[0, 25, 50, 70, 100]}
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
              formatter={(v) => [Number(v).toFixed(1), "health"]}
            />
            <ReferenceLine
              y={70}
              stroke="#C98500"
              strokeDasharray="4 4"
              label={{ value: "watch 70", position: "insideTopRight", fill: "#C98500", fontSize: 10 }}
            />
            <ReferenceLine
              y={50}
              stroke="#B3261E"
              strokeDasharray="4 4"
              label={{ value: "act 50", position: "insideBottomRight", fill: "#B3261E", fontSize: 10 }}
            />
            {markers.map((m) => (
              <ReferenceLine
                key={`${m.ts}-${m.type}`}
                x={m.ts}
                stroke={MARKER_COLOR[m.type]}
                strokeOpacity={0.55}
                strokeDasharray="2 3"
                label={{
                  value: MarkerLabel(m),
                  position: "top",
                  fill: MARKER_COLOR[m.type],
                  fontSize: 10,
                }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="health"
              stroke="#0F6B5C"
              strokeWidth={2.25}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink/55">
        {(["alert", "regime_change", "maintenance"] as Marker["type"][]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: MARKER_COLOR[t] }}
            />
            {t.replace("_", " ")}
          </span>
        ))}
        <span className="text-ink/40">Showing last {cfg.label}.</span>
      </div>
    </div>
  );
}
