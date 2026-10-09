"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDateTime, fmtSpeed } from "@/lib/format";
import type { Scenario } from "@/lib/types";

const SPEEDS: { label: string; hps: number }[] = [
  { label: "1 h / s", hps: 1 },
  { label: "1 day / 10 s", hps: 8640 },
  { label: "1 day / 3 s", hps: 28800 },
];

export default function SimControls({
  simTime,
  speed,
  playing,
  scenarios,
}: {
  simTime: string;
  speed: number;
  playing: boolean;
  scenarios: Scenario[];
}) {
  const [clock, setClock] = useState(() => Date.parse(simTime));
  const [isPlaying, setIsPlaying] = useState(playing);
  const [hps, setHps] = useState(speed);
  const [scenario, setScenario] = useState(scenarios[0]?.id ?? "");
  const [note, setNote] = useState<string | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setClock((c) => c + hps * dt * 3600_000);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [isPlaying, hps]);

  function jumpBeforeFailure() {
    setClock((c) => c - 72 * 3600_000);
    setNote("Jumped to 72 h before the staged failure.");
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[210px]">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink/50">
            Simulated clock
          </label>
          <div className="mt-1 font-mono text-lg tabular-nums text-ink">
            {fmtDateTime(new Date(clock).toISOString())}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsPlaying((p) => !p)}
          aria-pressed={isPlaying}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-teal px-4 text-sm font-semibold text-white hover:bg-teal/90"
        >
          {isPlaying ? "❚❚ Pause" : "▶ Play"}
        </button>

        <div>
          <label
            htmlFor="sim-speed"
            className="block text-xs font-medium uppercase tracking-wide text-ink/50"
          >
            Speed
          </label>
          <select
            id="sim-speed"
            value={hps}
            onChange={(e) => setHps(Number(e.target.value))}
            className="mt-1 min-h-11 rounded-md border border-line bg-white px-3 text-sm text-ink"
          >
            {SPEEDS.map((s) => (
              <option key={s.hps} value={s.hps}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="sim-scenario"
            className="block text-xs font-medium uppercase tracking-wide text-ink/50"
          >
            Scenario
          </label>
          <select
            id="sim-scenario"
            value={scenario}
            onChange={(e) => {
              setScenario(e.target.value);
              setNote(
                `Scenario staged: ${
                  scenarios.find((s) => s.id === e.target.value)?.summary ?? ""
                }`
              );
            }}
            className="mt-1 min-h-11 rounded-md border border-line bg-white px-3 text-sm text-ink"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.summary}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={jumpBeforeFailure}
          className="inline-flex min-h-11 items-center rounded-md border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-ink/5"
        >
          Jump to 72 h before failure
        </button>
      </div>

      <p className="mt-2 text-xs text-ink/50">
        Playing at {fmtSpeed(hps)} · times are compressed for the demo.
        {note ? ` ${note}` : ""}
      </p>
    </div>
  );
}
