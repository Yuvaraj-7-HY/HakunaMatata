import { fmtHours, signalLabel } from "@/lib/format";
import type { Contributor } from "@/lib/types";

function barColor(z: number): string {
  const a = Math.abs(z);
  if (a > 4) return "#B3261E";
  if (a > 2) return "#C98500";
  return "#0F6B5C";
}

export default function WhyFlagged({
  contributors,
  driftHours,
  signalsAgreeing,
  signalsTotal,
}: {
  contributors: Contributor[];
  driftHours: number;
  signalsAgreeing: number;
  signalsTotal: number;
}) {
  const maxAbs = Math.max(...contributors.map((c) => Math.abs(c.z)), 1);
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink">Why flagged</h2>
      <p className="text-xs text-ink/50">
        Contributors ranked by |z|, share of the drift.
      </p>

      <ul className="mt-3 space-y-3">
        {contributors.map((c) => (
          <li key={c.signal}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink">
                {signalLabel(c.signal)}
              </span>
              <span className="tabular-nums text-ink/60">
                z {c.z >= 0 ? "+" : ""}
                {c.z.toFixed(1)} · {(c.share * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(Math.abs(c.z) / maxAbs) * 100}%`,
                  backgroundColor: barColor(c.z),
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/45">
            Drift duration
          </dt>
          <dd className="font-semibold text-ink">{fmtHours(driftHours)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/45">
            Signals agreeing
          </dt>
          <dd className="font-semibold text-ink">
            {signalsAgreeing} / {signalsTotal}
          </dd>
        </div>
      </dl>
    </div>
  );
}
