import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import ContextCard from "@/components/ContextCard";
import HealthTimeline from "@/components/HealthTimeline";
import SignalPanel from "@/components/SignalPanel";
import StatusBadge from "@/components/StatusBadge";
import SubsystemSchematic from "@/components/SubsystemSchematic";
import WhyFlagged from "@/components/WhyFlagged";
import {
  getFleet,
  getMachine,
  getMachineHistory,
  hasMachineMock,
  isMock,
} from "@/lib/api";
import { healthColor, timeInStatus } from "@/lib/format";
import type { HistoryRange } from "@/lib/types";

export async function generateStaticParams() {
  const fleet = await getFleet();
  return fleet.machines.map((m) => ({ id: m.id }));
}

export default async function MachinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fleet = await getFleet();
  const summary = fleet.machines.find((m) => m.id === id);
  if (!summary) notFound();

  const range: HistoryRange = "24h";
  const [machine, history] = await Promise.all([
    getMachine(id),
    getMachineHistory(id, range),
  ]);

  const fallbackSample = isMock && !hasMachineMock(id);

  return (
    <AppShell active="fleet">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/" className="text-teal hover:underline">
          ← Fleet
        </Link>
        <span className="text-ink/30">/</span>
        <span className="text-ink/60">{id}</span>
      </div>

      <header className="mt-3 rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{summary.name}</h1>
            <p className="mt-1 text-sm text-ink/55">
              {summary.type} · id {id}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Chip label="Load" value={`${machine.regime.load_pct.toFixed(0)}%`} />
              <Chip label="Speed" value={`${machine.regime.speed_rpm.toFixed(0)} rpm`} />
              <Chip label="Ambient" value={`${machine.regime.ambient_c.toFixed(0)} °C`} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-ink/45">
                Health
              </div>
              <div
                className="text-4xl font-semibold tabular-nums"
                style={{ color: healthColor(machine.health) }}
              >
                {machine.health}
              </div>
            </div>
            <div className="space-y-2 text-right">
              <StatusBadge status={machine.status} />
              <div className="text-xs text-ink/50">
                in this status {timeInStatus(machine.status_since, fleet.sim_time)}
              </div>
            </div>
          </div>
        </div>
        {fallbackSample ? (
          <p className="mt-3 rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
            Mock mode: only M-04 ships a full evidence recording, so this screen
            shows the M-04 sample. Set NEXT_PUBLIC_USE_MOCK=false to load {id}{" "}
            from the live API.
          </p>
        ) : null}
      </header>

      <section className="mt-4">
        <HealthTimeline history={history} />
      </section>

      <section className="mt-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">
          Signal panels · value vs regime-expected band
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {machine.signals.map((s) => {
            const series = history.signals[s.name];
            if (!series) return null;
            return (
              <SignalPanel
                key={s.name}
                name={s.name}
                unit={s.unit}
                series={series}
                current={s.value}
                expected={s.expected}
                bandLow={s.band_low}
                bandHigh={s.band_high}
                z={s.z}
              />
            );
          })}
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <WhyFlagged
          contributors={machine.why_flagged.contributors}
          driftHours={machine.why_flagged.drift_hours}
          signalsAgreeing={machine.why_flagged.signals_agreeing}
          signalsTotal={machine.why_flagged.signals_total}
        />
        <ContextCard items={machine.context} />
      </section>

      <section className="mt-4">
        <SubsystemSchematic
          suspected={machine.suspected}
          suggestedAction={machine.suggested_action}
        />
      </section>
    </AppShell>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ground px-2.5 py-1">
      <span className="text-ink/45">{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </span>
  );
}
