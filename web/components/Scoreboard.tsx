"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend as RLegend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScoreboardResponse } from "@/lib/types";

const METHOD_LABEL: Record<string, string> = {
  naive: "Naive threshold (B0)",
  ewma: "EWMA / CUSUM (B1)",
  ours: "Our model (M)",
};

export default function Scoreboard({
  scoreboard,
}: {
  scoreboard: ScoreboardResponse;
}) {
  const { bins, ours, naive } = scoreboard.lead_time_hist;
  const hist = useMemo(
    () =>
      bins.slice(0, -1).map((b, i) => ({
        range: `${b}–${bins[i + 1]}h`,
        ours: ours[i] ?? 0,
        naive: naive[i] ?? 0,
      })),
    [bins, ours, naive]
  );

  const defaultIdx = useMemo(() => {
    const i = scoreboard.sweep.findIndex((s) => s.threshold === 70);
    return i >= 0 ? i : Math.floor(scoreboard.sweep.length / 2);
  }, [scoreboard.sweep]);
  const [idx, setIdx] = useState(defaultIdx);
  const point = scoreboard.sweep[idx];

  const methodKeys = ["naive", "ewma", "ours"].filter(
    (k) => scoreboard.methods[k]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">
          Scoreboard · hidden fleet
        </h2>
        <p className="text-xs text-ink/50">
          {scoreboard.n_failures} labelled failures · evaluated on held-out
          seeds with shifted ranges; chosen on dev only.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-ground text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 font-medium">Median lead</th>
                <th className="px-3 py-2 font-medium">FA / machine-week</th>
                <th className="px-3 py-2 font-medium">Missed</th>
              </tr>
            </thead>
            <tbody>
              {methodKeys.map((k) => {
                const m = scoreboard.methods[k];
                const best = k === "ours";
                return (
                  <tr
                    key={k}
                    className={
                      "border-t border-line " + (best ? "bg-teal/[0.06]" : "")
                    }
                  >
                    <td className="px-3 py-2 font-medium text-ink">
                      {METHOD_LABEL[k] ?? k}
                      {best ? (
                        <span className="ml-2 rounded-full bg-teal/15 px-2 py-0.5 text-xs text-teal">
                          ours
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {m.median_lead_h.toFixed(1)} h
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {m.fa_per_week.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{m.missed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hist} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="rgba(20,32,28,0.08)" vertical={false} />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 10, fill: "rgba(20,32,28,0.55)" }}
                stroke="rgba(20,32,28,0.2)"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "rgba(20,32,28,0.55)" }}
                stroke="rgba(20,32,28,0.2)"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid rgba(20,32,28,0.12)",
                  fontSize: 12,
                }}
              />
              <RLegend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ours" name="Ours" fill="#0F6B5C" radius={[3, 3, 0, 0]} />
              <Bar
                dataKey="naive"
                name="Naive"
                fill="#8a8f8c"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-ink/45">
          Lead-time distribution (hours). Naive fires late and misses the long
          tail.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Sensitivity</h2>
        <p className="text-xs text-ink/50">
          Move the act-now threshold and watch the false-alarm / lead-time
          trade-off.
        </p>

        <div className="mt-4">
          <label
            htmlFor="sensitivity"
            className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-ink/50"
          >
            <span>Act-now threshold</span>
            <span className="tabular-nums text-ink">{point.threshold}</span>
          </label>
          <input
            id="sensitivity"
            type="range"
            min={0}
            max={scoreboard.sweep.length - 1}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] text-ink/40">
            <span>stricter</span>
            <span>looser</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-md border border-line bg-ground/50 p-3">
            <div className="text-xs uppercase tracking-wide text-ink/45">
              False alarms / week
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-amber">
              {point.fa_per_week.toFixed(1)}
            </div>
          </div>
          <div className="rounded-md border border-line bg-ground/50 p-3">
            <div className="text-xs uppercase tracking-wide text-ink/45">
              Median lead
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-teal">
              {point.median_lead_h.toFixed(0)} h
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-ink/50">
          The sweep is precomputed on the hidden fleet; the slider only reads it,
          it never re-runs the detector live.
        </p>
      </div>
    </div>
  );
}
