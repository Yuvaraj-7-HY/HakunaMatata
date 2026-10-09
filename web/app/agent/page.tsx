import AppShell from "@/components/AppShell";
import ChatPanel from "@/components/ChatPanel";
import { getFleet, getMachine, getReplay, getScoreboard } from "@/lib/api";
import { fmtHours } from "@/lib/format";
import type { AgentAskResponse } from "@/lib/types";

export default async function AgentPage() {
  const [fleet, scoreboard, machine, replay] = await Promise.all([
    getFleet(),
    getScoreboard(),
    getMachine("M-04"),
    getReplay("sc-01"),
  ]);

  const m = machine;
  const ours = scoreboard.methods.ours;
  const naive = scoreboard.methods.naive;

  const whyM04 = `M-04 (${m.name}) was flagged because its health fell to ${m.health}, below the 50 act-now line, and stayed down for about ${fmtHours(
    m.why_flagged.drift_hours
  )}. ${m.why_flagged.contributors
    .slice(0, 2)
    .map((c) => `${c.signal} (z ${c.z.toFixed(1)})`)
    .join(" and ")} drifted first, and ${m.why_flagged.signals_agreeing} of ${
    m.why_flagged.signals_total
  } signals agree. That pattern points to “${
    m.suspected?.subsystem ?? "general degradation"
  }” — suspected, not a confirmed fault. Suggested action: ${
    m.suggested_action
  }.`;

  const lead = `On the last staged bearing-wear failure (M-04), our detector alerted about ${fmtHours(
    replay.lead_time_hours_ours
  )} before failure, versus ${fmtHours(
    replay.lead_time_hours_naive
  )} for a naive vibration threshold. Across the hidden fleet our method misses ${ours.missed} of ${scoreboard.n_failures} failures, against ${naive.missed} missed for naive.`;

  const fa = `Our method runs at about ${ours.fa_per_week.toFixed(
    1
  )} false alarms per machine-week on the hidden fleet, versus ${naive.fa_per_week.toFixed(
    1
  )} for the naive threshold, while giving a longer median lead time (${ours.median_lead_h.toFixed(
    1
  )} h vs ${naive.median_lead_h.toFixed(
    1
  )} h). You can trade false alarms against lead time with the sensitivity slider on the replay screen.`;

  const real = `No — this is not real plant data. Every reading is produced by our own physics-grounded simulator, and the fleet health, alerts and lead times are all from that simulation. Subsystem attributions are suspected, not confirmed. The purpose is to demonstrate the method, not to claim field accuracy.`;

  const answers: Record<string, AgentAskResponse> = {
    "Why was M-04 flagged?": {
      answer: whyM04,
      tool_calls: [
        { name: "get_machine_health", args: { machine_id: "M-04" } },
        { name: "explain_flag", args: { machine_id: "M-04" } },
      ],
      citations: [{ machine_id: "M-04", window: "last 7 days" }],
      chart: null,
    },
    "How early would we have been warned last time?": {
      answer: lead,
      tool_calls: [
        { name: "compare_methods", args: { scenario_id: "sc-01" } },
        { name: "get_scoreboard", args: {} },
      ],
      citations: [{ machine_id: "M-04", window: "failure window" }],
      chart: null,
    },
    "What is the false-alarm rate of our method?": {
      answer: fa,
      tool_calls: [{ name: "get_scoreboard", args: {} }],
      citations: [],
      chart: null,
    },
    "Is this real plant data?": {
      answer: real,
      tool_calls: [],
      citations: [],
      chart: null,
    },
  };

  const fallback: AgentAskResponse = {
    answer: `I can only answer from the simulated fleet data I have tools for. Right now ${fleet.kpis.monitored} machines are monitored: ${fleet.kpis.healthy} healthy, ${fleet.kpis.watch} on watch and ${fleet.kpis.act_now} needing action. Try one of the suggested questions — e.g. “Why was M-04 flagged?”.`,
    tool_calls: [{ name: "get_fleet_summary", args: {} }],
    citations: [],
    chart: null,
  };

  return (
    <AppShell active="agent">
      <h1 className="text-2xl font-semibold text-ink">Ask the agent</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink/55">
        A maintenance assistant that answers only from tool results. Every
        number cites a machine and window; subsystem calls are “suspected”.
      </p>
      <section className="mt-5">
        <ChatPanel
          suggested={Object.keys(answers)}
          answers={answers}
          fallback={fallback}
        />
      </section>
    </AppShell>
  );
}
