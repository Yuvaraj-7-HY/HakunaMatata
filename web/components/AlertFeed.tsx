import Link from "next/link";
import { fmtDateTime } from "@/lib/format";
import type { AlertFeedItem } from "@/lib/types";
import StatusBadge from "./StatusBadge";

export default function AlertFeed({ alerts }: { alerts: AlertFeedItem[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Alert feed</h2>
        <p className="text-xs text-ink/50">Newest first · one alert per status change.</p>
      </div>
      <ol>
        {alerts.map((a) => (
          <li key={a.id} className="border-b border-line px-4 py-3 last:border-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={a.level} size="sm" />
                <Link
                  href={`/machine/${a.machine_id}`}
                  className="font-medium text-ink hover:text-teal"
                >
                  {a.machine_id}
                </Link>
              </div>
              <time className="font-mono text-xs text-ink/45">
                {fmtDateTime(a.ts)}
              </time>
            </div>
            <p className="mt-1 text-sm text-ink/70">{a.reason}</p>
          </li>
        ))}
        {alerts.length === 0 ? (
          <li className="px-4 py-6 text-sm text-ink/50">No alerts yet.</li>
        ) : null}
      </ol>
    </div>
  );
}
