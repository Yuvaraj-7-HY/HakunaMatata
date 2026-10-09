import Link from "next/link";
import { STATUS_FILL, timeInStatus } from "@/lib/format";
import type { MachineSummary } from "@/lib/types";
import Sparkline from "./Sparkline";
import StatusBadge from "./StatusBadge";

export default function MachineTable({
  machines,
  nowIso,
}: {
  machines: MachineSummary[];
  nowIso: string;
}) {
  const sorted = [...machines].sort((a, b) => a.health - b.health);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Machines</h2>
        <p className="text-xs text-ink/50">Sorted worst health first.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-ground text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3 font-medium">Machine</th>
              <th className="px-4 py-3 font-medium">Health</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Time in status</th>
              <th className="px-4 py-3 font-medium">14-day trend</th>
              <th className="px-4 py-3 font-medium">Suspected subsystem</th>
              <th className="px-4 py-3 font-medium sr-only">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr
                key={m.id}
                className="border-t border-line align-middle hover:bg-ink/[0.02]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/machine/${m.id}`}
                    className="font-medium text-ink hover:text-teal"
                  >
                    {m.id}
                  </Link>
                  <div className="text-xs text-ink/55">{m.name}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-ink/10">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(0, Math.min(100, m.health))}%`,
                          backgroundColor: STATUS_FILL[m.status],
                        }}
                      />
                    </div>
                    <span className="tabular-nums text-ink">{m.health}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={m.status} size="sm" />
                </td>
                <td className="px-4 py-3 tabular-nums text-ink/70">
                  {timeInStatus(m.status_since, nowIso)}
                </td>
                <td className="px-4 py-3">
                  <Sparkline values={m.sparkline} />
                </td>
                <td className="px-4 py-3 text-ink/75">
                  {m.suspected_subsystem ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/machine/${m.id}`}
                    className="inline-flex min-h-9 items-center rounded-md border border-line px-3 text-xs font-medium text-teal hover:bg-teal/5"
                  >
                    Evidence →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
