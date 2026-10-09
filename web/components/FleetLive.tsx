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
import { STATUS_FILL, THRESHOLD, statusFromHealth } from "@/lib/format";
import {
  MAX_SAMPLES,
  TICK_MS,
  computeStats,
  fmtHealth,
  initialSim,
  seedSeries,
  stepValue,
  trendLabel,
  type SimState,
} from "@/lib/live";
import type { MachineSummary } from "@/lib/types";
import FleetAi from "./FleetAi";

const DASH = ["", "6 4", "2 3", "9 4", "4 3"];

export default function FleetLive({
  machines,
}: {
  machines: MachineSummary[];
}) {
  const simsRef = useRef<Record<string, SimState> | null>(null);
  if (!simsRef.current) {
    simsRef.current = Object.fromEntries(
      machines.map((m) => [m.id, initialSim(m)])
    );
  }

  const [series, setSeries] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(machines.map((m) => [m.id, seedSeries(m)]))
  );
  const seriesRef = useRef(series);
  const tickRef = useRef(0);

  const [live, setLive] = useState(true);
  const [selected, setSelected] = useState<string[]>(() =>
    [...machines]
      .sort((a, b) => a.health - b.health)
      .slice(0, 3)
      .map((m) => m.id)
  );
  const [aiFocus, setAiFocus] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);
  const aiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!live) return;
    const handle = window.setInterval(() => {
      const sims = simsRef.current;
      if (!sims) return;
      const t = (tickRef.current += 1);
      const prev = seriesRef.current;
      const next: Record<string, number[]> = {};
      for (const m of machines) {
        const hist = prev[m.id] ?? [m.health];
        const v = stepValue(hist[hist.length - 1], sims[m.id], t);
        const trimmed = hist.length >= MAX_SAMPLES ? hist.slice(1) : hist;
        next[m.id] = [...trimmed, v];
      }
      seriesRef.current = next;
      setSeries(next);
    }, TICK_MS);
    return () => window.clearInterval(handle);
  }, [live, machines]);

  useEffect(
    () => () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    []
  );

  const stats = useMemo(() => computeStats(machines, series), [machines, series]);
  const breaches = useMemo(
    () => stats.filter((s) => s.status !== "healthy").sort((a, b) => a.health - b.health),
    [stats]
  );

  const rows = useMemo(() => {
    const any = selected.map((id) => series[id]).find((s) => s?.length);
    const n = any?.length ?? 0;
    return Array.from({ length: n }, (_, i) => {
      const row: Record<string, number> = { i };
      for (const id of selected) {
        const s = series[id];
        if (s && i < s.length) row[id] = s[i];
      }
      return row;
    });
  }, [series, selected]);

  function toggle(id: string) {
    setSelected((sel) =>
      sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]
    );
  }

  function openAi(focusId?: string) {
    if (focusId) setAiFocus(focusId);
    setFlash(true);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 2600);
    window.setTimeout(
      () => aiRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      60
    );
  }

  return (
    <>
      <section className="mt-6 rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Live monitor</h2>
            <p className="text-xs text-ink/50">
              Randomized mock telemetry · one sample per second · watch &lt;{" "}
              {THRESHOLD.watch} · act now &lt; {THRESHOLD.act_now}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLive((l) => !l)}
              aria-pressed={live}
              className="inline-flex min-h-10 items-center rounded-md border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-ink/5"
            >
              {live ? "❚❚ Pause stream" : "▶ Resume stream"}
            </button>
            <button
              type="button"
              onClick={() => openAi()}
              className="inline-flex min-h-10 items-center rounded-md bg-[#C90027] px-4 text-sm font-semibold text-white hover:bg-[#C90027]/90"
            >
              AI · probable issues
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-ink/50">
              Machines
            </span>
            <button
              type="button"
              onClick={() => setSelected(machines.map((m) => m.id))}
              className="min-h-8 rounded-md border border-line bg-white px-2 text-xs font-medium text-ink hover:bg-ink/5"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelected(breaches.map((b) => b.id))}
              className="min-h-8 rounded-md border border-line bg-white px-2 text-xs font-medium text-ink hover:bg-ink/5"
            >
              At risk only
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {stats.map((s) => {
              const on = selected.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-pressed={on}
                  className={
                    "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm transition-colors " +
                    (on
                      ? "border-transparent bg-[#C90027] text-white"
                      : "border-line bg-white text-ink hover:border-[#C90027]/50")
                  }
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: on
                        ? "#FFFFFF"
                        : STATUS_FILL[statusFromHealth(s.health)],
                    }}
                  />
                  <span className="font-medium">{s.id}</span>
                  <span
                    className={
                      "hidden text-xs sm:inline " +
                      (on ? "text-white/80" : "text-ink/55")
                    }
                  >
                    {s.name}
                  </span>
                  <span
                    className={
                      "font-mono text-xs tabular-nums " +
                      (on ? "text-white" : "text-ink/70")
                    }
                  >
                    {fmtHealth(s.health)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink/45">
            Click a machine to plot or hide it. Line color follows the current
            status: black = healthy, faded red = watch, red = act now.
          </p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-md border border-line p-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/60">
                Health stream
              </h3>
              <span className="text-[11px] text-ink/45">
                last {rows.length} samples · {selected.length} plotted
              </span>
            </div>

            {selected.length === 0 ? (
              <p className="grid h-64 place-items-center text-sm text-ink/50">
                Select at least one machine above.
              </p>
            ) : (
              <div className="mt-2 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={rows}
                    margin={{ top: 8, right: 12, bottom: 4, left: -18 }}
                  >
                    <CartesianGrid stroke="rgba(0,0,0,0.07)" vertical={false} />
                    <XAxis dataKey="i" hide />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 70, 100]}
                      tick={{ fontSize: 11, fill: "rgba(0,0,0,0.55)" }}
                      stroke="rgba(0,0,0,0.2)"
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid rgba(0,0,0,0.15)",
                        fontSize: 12,
                      }}
                      labelFormatter={(v) => `sample ${v}`}
                      formatter={(v, name) => [Number(v).toFixed(1), String(name)]}
                    />
                    <ReferenceLine
                      y={THRESHOLD.watch}
                      stroke="#C90027A6"
                      strokeDasharray="4 4"
                      label={{
                        value: `watch ${THRESHOLD.watch}`,
                        position: "insideTopRight",
                        fill: "#C90027A6",
                        fontSize: 10,
                      }}
                    />
                    <ReferenceLine
                      y={THRESHOLD.act_now}
                      stroke="#C90027"
                      strokeDasharray="4 4"
                      label={{
                        value: `act ${THRESHOLD.act_now}`,
                        position: "insideBottomRight",
                        fill: "#C90027",
                        fontSize: 10,
                      }}
                    />
                    {selected.map((id, idx) => {
                      const vals = series[id];
                      const last = vals?.length ? vals[vals.length - 1] : 100;
                      return (
                        <Line
                          key={id}
                          type="monotone"
                          dataKey={id}
                          stroke={STATUS_FILL[statusFromHealth(last)]}
                          strokeWidth={2}
                          strokeDasharray={DASH[idx % DASH.length] || undefined}
                          dot={false}
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-md border border-line p-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/60">
                Systems outside thresholds
              </h3>
              <span className="font-mono text-[11px] text-[#C90027]">
                {breaches.length} / {stats.length}
              </span>
            </div>

            {breaches.length === 0 ? (
              <p className="mt-3 text-sm text-ink/55">
                All systems are inside their thresholds.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {breaches.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 py-2.5 first:pt-1"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{s.id}</span>
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                          style={
                            s.status === "act_now"
                              ? { backgroundColor: "#C90027", color: "#FFFFFF" }
                              : {
                                  backgroundColor: "#C9002726",
                                  color: "#C90027",
                                }
                          }
                        >
                          {s.status === "act_now" ? "act now" : "watch"}
                        </span>
                      </div>
                      <div className="truncate text-xs text-ink/55">
                        {s.name} · {s.suspected ?? "subsystem unconfirmed"} ·{" "}
                        {trendLabel(s.trend)}
                      </div>
                      <div className="text-[11px] text-ink/45">
                        {s.status === "act_now"
                          ? `below ${THRESHOLD.act_now}${
                              s.actAgo != null ? ` for ${s.actAgo} samples` : ""
                            }`
                          : `below ${THRESHOLD.watch}${
                              s.watchAgo != null
                                ? ` for ${s.watchAgo} samples`
                                : ""
                            }`}
                      </div>
                    </div>
                    <div
                      className="font-mono text-lg font-semibold tabular-nums"
                      style={{ color: STATUS_FILL[s.status] }}
                    >
                      {fmtHealth(s.health)}
                    </div>
                    <button
                      type="button"
                      onClick={() => openAi(s.id)}
                      className="inline-flex min-h-9 shrink-0 items-center rounded-md border border-[#C90027]/45 bg-white px-2.5 text-xs font-semibold text-[#C90027] hover:bg-[#C90027] hover:text-white"
                    >
                      Ask AI
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink/45">
              Thresholds are per-line health limits: watch {THRESHOLD.watch},
              act now {THRESHOLD.act_now}.
            </p>
          </div>
        </div>
      </section>

      <div
        ref={aiRef}
        className={
          "mt-4 scroll-mt-6 rounded-lg transition-shadow " +
          (flash ? "ring-2 ring-[#C90027]" : "")
        }
      >
        <FleetAi
          machines={machines}
          series={series}
          focus={aiFocus}
          onFocusHandled={() => setAiFocus(null)}
        />
      </div>
    </>
  );
}
