"use client";

import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { signalLabel } from "@/lib/format";
import type { SignalSeries } from "@/lib/types";

function inBand(value: number, low: number, high: number): boolean {
  return value >= low && value <= high;
}

export default function SignalPanel({
  name,
  unit,
  series,
  current,
  expected,
  bandLow,
  bandHigh,
  z,
}: {
  name: string;
  unit: string;
  series: SignalSeries;
  current: number;
  expected: number;
  bandLow: number;
  bandHigh: number;
  z: number;
}) {
  const data = series.value.map((v, i) => ({
    ts: `p${i}`,
    value: v,
    expected: series.expected[i] ?? expected,
    band_low: series.band_low[i] ?? bandLow,
    band_high: series.band_high[i] ?? bandHigh,
  }));

  const ok = inBand(current, bandLow, bandHigh);
  const absZ = Math.abs(z);
  const zColor = absZ > 4 ? "#B3261E" : absZ > 2 ? "#C98500" : "#0F6B5C";

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {signalLabel(name)}
          </h3>
          <p className="text-xs text-ink/45">
            expected {expected.toFixed(1)} {unit || ""}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold tabular-nums text-ink">
            {current.toFixed(1)}
            <span className="ml-1 text-xs font-normal text-ink/45">
              {unit || ""}
            </span>
          </div>
          <div className="text-xs font-medium tabular-nums" style={{ color: zColor }}>
            z {z >= 0 ? "+" : ""}
            {z.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="mt-3 h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -28 }}>
            <XAxis dataKey="ts" hide />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(20,32,28,0.5)" }}
              stroke="rgba(20,32,28,0.2)"
              width={38}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgba(20,32,28,0.12)",
                fontSize: 11,
              }}
              formatter={(v) => Number(v).toFixed(2)}
            />
            {/* Expected band (value +/- residual sigma). */}
            <Area
              type="monotone"
              dataKey="band_high"
              stroke="none"
              fill="#0F6B5C"
              fillOpacity={0.1}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="band_low"
              stroke="none"
              fill="#F6F7F5"
              fillOpacity={1}
              isAnimationActive={false}
            />
            <ReferenceLine
              y={expected}
              stroke="rgba(20,32,28,0.35)"
              strokeDasharray="4 4"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={ok ? "#0F6B5C" : zColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 text-xs text-ink/45">
        Band shows recent normal ≈ {bandLow.toFixed(1)}–{bandHigh.toFixed(1)}{" "}
        {unit || ""} {ok ? "· within band" : "· outside band"}
      </p>
    </div>
  );
}
