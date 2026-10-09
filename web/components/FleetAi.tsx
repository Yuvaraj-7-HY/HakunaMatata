"use client";

import { useEffect, useRef, useState } from "react";
import { STATUS_LABEL, THRESHOLD } from "@/lib/format";
import {
  computeStats,
  fmtHealth,
  trendLabel,
  type LiveStats,
} from "@/lib/live";
import type { MachineSummary } from "@/lib/types";
import ToolChip from "./ToolChip";

interface Msg {
  role: "user" | "ai";
  text: string;
  tools?: { name: string; args: Record<string, unknown> }[];
  cites?: string[];
}

const CAUSES: Record<string, string[]> = {
  "Rotating assembly (bearings)": [
    "bearing wear or spalling",
    "imbalance / misalignment after a crash stop",
    "lubrication breakdown",
  ],
  "Cooling and lubrication": [
    "cooling circuit fouling or low flow",
    "lubricant degradation under sustained load",
    "heat rejection loss at high duty",
  ],
  "Drive and load path": [
    "coupling or belt wear",
    "load spikes beyond the duty point",
    "electrical imbalance in the drive",
  ],
};

const NEXT_STEP: Record<string, string> = {
  "Rotating assembly (bearings)":
    "inspect the bearings at low speed and check lubrication before the next run",
  "Cooling and lubrication":
    "check coolant flow, filter ΔP and lubricant temperature",
  "Drive and load path":
    "inspect the coupling/belts and check drive current balance",
};

const DEFAULT_CAUSES = [
  "broad degradation — no single subsystem dominates the drift",
  "process drift (duty cycle change) not yet reflected in the model",
  "sensor fouling giving a slow baseline shift",
];

const SUGGESTED = [
  "Which machines are failing right now?",
  "What should I fix first?",
  "Why did a threshold get crossed?",
  "Is this real plant data?",
];

function findMachineId(q: string): string | null {
  const m = q.match(/\bm\s*-?(\d{1,2})\b/i);
  if (!m) return null;
  return `M-${m[1].padStart(2, "0")}`;
}

function answerFor(
  q: string,
  stats: LiveStats[]
): { text: string; tools: Msg["tools"]; cites: string[] } {
  const lower = q.toLowerCase();
  const atRisk = stats
    .filter((s) => s.status !== "healthy")
    .sort((a, b) => a.health - b.health);

  const id = findMachineId(q);
  if (id) {
    const s = stats.find((x) => x.id === id);
    if (!s) {
      return {
        text: `I have no live stream for ${id}. The monitored fleet is ${stats
          .map((x) => x.id)
          .join(", ")}.`,
        tools: [{ name: "get_fleet_summary", args: {} }],
        cites: [],
      };
    }
    const causes = s.suspected
      ? CAUSES[s.suspected] ?? DEFAULT_CAUSES
      : DEFAULT_CAUSES;
    const step =
      NEXT_STEP[s.suspected ?? ""] ??
      "keep the unit on the watch list and re-check in 10 minutes";
    const where =
      s.status === "act_now"
        ? `below the act-now line (50)${
            s.actAgo != null ? ` for ~${s.actAgo} samples` : ""
          }`
        : s.status === "watch"
          ? `below the watch line (70)${
              s.watchAgo != null ? ` for ~${s.watchAgo} samples` : ""
            }`
          : "still above both lines (watch 70, act now 50)";
    return {
      text: `${s.id} — ${s.name} — reads health ${fmtHealth(s.health)} and is ${
        STATUS_LABEL[s.status]
      }. It is ${where}, and over the last 10 samples it is ${trendLabel(
        s.trend
      )}. Suspected subsystem: ${
        s.suspected ?? "none — the drift is spread across signals"
      }.\n\nProbable issues: ${causes.join("; ")}. Suggested next step: ${step}.\n\nSuspected, not confirmed — every reading comes from the simulated stream.`,
      tools: [
        { name: "get_live_health", args: { machine_id: s.id } },
        { name: "explain_flag", args: { machine_id: s.id } },
      ],
      cites: [`${s.id} · last ${s.samples} samples`],
    };
  }

  if (/fail|bad|urgent|critical|act now|act-now|wrong|at risk|trouble/.test(lower)) {
    if (atRisk.length === 0) {
      return {
        text: `Nothing is over a line right now — all ${stats.length} machines sit above the watch threshold of 70. I will flag the first one that crosses.`,
        tools: [{ name: "list_threshold_breaches", args: {} }],
        cites: [],
      };
    }
    const lines = atRisk.map(
      (s, i) =>
        `${i + 1}. ${s.id} (${s.name}) — health ${fmtHealth(s.health)}, ${
          STATUS_LABEL[s.status]
        }, ${trendLabel(s.trend)} over 10 samples, suspected ${
          s.suspected ?? "—"
        }.`
    );
    return {
      text: `${atRisk.length} of ${stats.length} systems are outside their thresholds:\n${lines.join(
        "\n"
      )}\n\nThe act-now line is ${THRESHOLD.act_now}, the watch line is ${
        THRESHOLD.watch
      }. Values are live mock telemetry, refreshed every second.`,
      tools: [
        { name: "list_threshold_breaches", args: {} },
        { name: "get_fleet_summary", args: {} },
      ],
      cites: atRisk.map((s) => `${s.id} · live window`),
    };
  }

  if (/first|priority|prioriti|fix|order|start|should i|which machine/.test(lower)) {
    if (atRisk.length === 0) {
      return {
        text: `Nothing needs action yet — every machine is above 70. First to watch: ${[...stats]
          .sort((a, b) => a.health - b.health)
          .slice(0, 3)
          .map((s) => `${s.id} at ${fmtHealth(s.health)}`)
          .join(", ")}.`,
        tools: [{ name: "rank_by_risk", args: {} }],
        cites: [],
      };
    }
    const ranked = [...atRisk, ...stats.filter((s) => s.status === "healthy")]
      .sort((a, b) => a.health - b.health)
      .slice(0, 4);
    const lines = ranked.map(
      (s, i) =>
        `${i + 1}. ${s.id} — health ${fmtHealth(s.health)} (${
          STATUS_LABEL[s.status]
        })${s.suspected ? `, suspected ${s.suspected.toLowerCase()}` : ""}.`
    );
    return {
      text: `Work order from the live stream, worst first:\n${lines.join(
        "\n"
      )}\n\nStart with anything below 50 — those are the units crossing the act-now line. Everything else is inspection-deferred monitoring.`,
      tools: [{ name: "rank_by_risk", args: {} }],
      cites: atRisk.slice(0, 3).map((s) => `${s.id} · live window`),
    };
  }

  if (/threshold|watch line|act|cross|line|70|50/.test(lower)) {
    const crossed = atRisk
      .map((s) => {
        if (s.status === "act_now")
          return `${s.id} crossed the act-now line (50)${
            s.actAgo != null ? ` ${s.actAgo} samples ago` : ""
          } and sits at ${fmtHealth(s.health)}.`;
        return `${s.id} crossed the watch line (70)${
          s.watchAgo != null ? ` ${s.watchAgo} samples ago` : ""
        } and sits at ${fmtHealth(s.health)}.`;
      })
      .join(" ");
    return {
      text: `Two thresholds are drawn on every chart: watch below ${THRESHOLD.watch}, act now below ${
        THRESHOLD.act_now
      }.\n\n${crossed || "No line is crossed at the moment."}\n\nA machine is flagged only after the drift is sustained, not on a single noisy sample.`,
      tools: [{ name: "list_threshold_breaches", args: {} }],
      cites: atRisk.map((s) => `${s.id} · live window`),
    };
  }

  if (/real|actual|simulated|mock|fake|production data/.test(lower)) {
    return {
      text: `No — this is not plant data. The stream is generated by our own physics-grounded simulator and randomized every second for the demo. Health scores, thresholds and suspected subsystems are all simulated, and subsystem calls are suspected, not confirmed faults.`,
      tools: [{ name: "get_fleet_summary", args: {} }],
      cites: [],
    };
  }

  const worst = [...stats].sort((a, b) => a.health - b.health).slice(0, 3);
  return {
    text: `Live picture: ${stats.filter((s) => s.status === "healthy").length} healthy, ${
      stats.filter((s) => s.status === "watch").length
    } on watch, ${
      stats.filter((s) => s.status === "act_now").length
    } needing action. Lowest health right now: ${worst
      .map((s) => `${s.id} at ${fmtHealth(s.health)}`)
      .join(", ")}.\n\nAsk me about a specific machine (“What is wrong with M-04?”), about the thresholds, or what to fix first.`,
    tools: [{ name: "get_fleet_summary", args: {} }],
    cites: [],
  };
}

export default function FleetAi({
  machines,
  series,
  focus,
  onFocusHandled,
}: {
  machines: MachineSummary[];
  series: Record<string, number[]>;
  focus: string | null;
  onFocusHandled: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<(q: string) => void>(() => {});

  const stats = computeStats(machines, series);

  function send(question: string) {
    const q = question.trim();
    if (!q || thinking) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setThinking(true);
    window.setTimeout(() => {
      const reply = answerFor(q, stats);
      setMessages((m) => [
        ...m,
        { role: "ai", text: reply.text, tools: reply.tools, cites: reply.cites },
      ]);
      setThinking(false);
      window.requestAnimationFrame(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
      });
    }, 450);
  }

  sendRef.current = send;

  useEffect(() => {
    if (!focus) return;
    sendRef.current(`What are the probable issues with ${focus}?`);
    onFocusHandled();
  }, [focus, onFocusHandled]);

  const riskIds = stats
    .filter((s) => s.status !== "healthy")
    .sort((a, b) => a.health - b.health)
    .slice(0, 2)
    .map((s) => `What is wrong with ${s.id}?`);
  const suggested = [...riskIds, ...SUGGESTED].slice(0, 6);

  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-[#C90027] px-2.5 py-1 text-xs font-semibold text-white">
            AI
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Diagnose probable issues
            </h2>
            <p className="text-xs text-ink/50">
              Answers are computed from the live mock stream · suspected, not
              confirmed
            </p>
          </div>
        </div>
        <span className="font-mono text-[11px] text-ink/45">
          {stats.length} machines · sample / s
        </span>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col rounded-lg border border-line bg-ground">
          <div
            ref={logRef}
            className="flex-1 space-y-4 overflow-y-auto p-4"
            style={{ maxHeight: 440 }}
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-ink/55">
                Ask which systems are going bad, why a threshold was crossed,
                or what to inspect first. Every number is read from the live
                stream on this page.
              </p>
            ) : null}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg rounded-br-sm bg-[#C90027] px-3 py-2 text-sm text-white">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="max-w-[92%]">
                  <div className="rounded-lg rounded-bl-sm border border-line bg-white px-3 py-2 text-sm text-ink/85">
                    <p className="whitespace-pre-line">{m.text}</p>
                  </div>
                  {m.tools && m.tools.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.tools.map((t, j) => (
                        <ToolChip key={j} name={t.name} args={t.args} />
                      ))}
                    </div>
                  ) : null}
                  {m.cites && m.cites.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink/55">
                      {m.cites.map((c, j) => (
                        <span
                          key={j}
                          className="rounded border border-line bg-white px-2 py-0.5"
                        >
                          cite · {c}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            )}

            {thinking ? (
              <div className="text-sm text-ink/45">Reading the live stream…</div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 border-t border-line p-3"
          >
            <div className="flex-1">
              <label
                htmlFor="fleet-ai-input"
                className="block text-xs font-medium uppercase tracking-wide text-ink/50"
              >
                Ask the AI
              </label>
              <input
                id="fleet-ai-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. What is wrong with M-04?"
                className="mt-1 min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink"
              />
            </div>
            <button
              type="submit"
              disabled={thinking || !input.trim()}
              className="inline-flex min-h-11 items-center rounded-md bg-[#C90027] px-4 text-sm font-semibold text-white hover:bg-[#C90027]/90 disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        </div>

        <aside className="rounded-lg border border-line p-4">
          <h2 className="text-sm font-semibold text-ink">Suggested</h2>
          <div className="mt-3 flex flex-col gap-2">
            {suggested.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-left text-sm text-ink/80 hover:border-[#C90027]/50 hover:text-[#C90027]"
              >
                {q}
              </button>
            ))}
          </div>
          <p className="mt-4 border-t border-line pt-3 text-xs text-ink/50">
            Tool results only — no invented numbers. Probable issues are
            hypotheses for inspection, never confirmed faults.
          </p>
        </aside>
      </div>
    </div>
  );
}
