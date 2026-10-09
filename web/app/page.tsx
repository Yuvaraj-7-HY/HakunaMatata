import { getFleet, isMock } from "@/lib/api";
import type { Status } from "@/lib/types";

const STATUS_COLOR: Record<Status, string> = {
  healthy: "#0F6B5C",
  watch: "#C98500",
  act_now: "#B3261E",
};

const STATUS_LABEL: Record<Status, string> = {
  healthy: "Healthy",
  watch: "Watch",
  act_now: "Act now",
};

export default async function Home() {
  const fleet = await getFleet();

  const tiles: { label: string; value: number }[] = [
    { label: "Monitored", value: fleet.kpis.monitored },
    { label: "Healthy", value: fleet.kpis.healthy },
    { label: "Watch", value: fleet.kpis.watch },
    { label: "Act now", value: fleet.kpis.act_now },
    { label: "Alerts today", value: fleet.kpis.alerts_today },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#14201C]">
            Mysuru Manufacturing — Fleet
          </h1>
          <p className="mt-1 text-sm text-[#14201C]/60">
            Simulated time {new Date(fleet.sim_time).toLocaleString()} · speed{" "}
            {(fleet.speed / 3600).toFixed(1)}h/s · {fleet.playing ? "playing" : "paused"}
          </p>
        </div>
        <span className="rounded-full border border-[#0F6B5C]/30 bg-[#0F6B5C]/10 px-3 py-1 text-sm font-medium text-[#0F6B5C]">
          {isMock ? "Simulated live · MOCK" : "Simulated live"}
        </span>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-[#14201C]/10 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-[#14201C]/50">
              {t.label}
            </div>
            <div className="mt-1 text-3xl font-semibold text-[#14201C]">{t.value}</div>
          </div>
        ))}
      </section>

      <section className="mt-8 overflow-hidden rounded-lg border border-[#14201C]/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F6F7F5] text-xs uppercase tracking-wide text-[#14201C]/50">
            <tr>
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Health</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Suspected subsystem</th>
            </tr>
          </thead>
          <tbody>
            {fleet.machines.map((m) => (
              <tr key={m.id} className="border-t border-[#14201C]/10">
                <td className="px-4 py-3">
                  <div className="font-medium text-[#14201C]">{m.id}</div>
                  <div className="text-[#14201C]/60">{m.name}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-[#14201C]/10">
                      <div
                        className="h-full rounded-full bg-[#0F6B5C]"
                        style={{ width: `${m.health}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-[#14201C]">{m.health}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 font-medium" style={{ color: STATUS_COLOR[m.status] }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[m.status] }} />
                    {STATUS_LABEL[m.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#14201C]/80">{m.suspected_subsystem ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-8 text-xs text-[#14201C]/50">
        All data is simulated. Subsystem attributions are suspected, not confirmed faults.
      </footer>
    </main>
  );
}
