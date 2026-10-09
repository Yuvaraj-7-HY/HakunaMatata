import type { ReactNode } from "react";

export default function KpiTile({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-ink/50">
        {label}
      </div>
      <div
        className="mt-1 text-3xl font-semibold tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-ink/45">{hint}</div> : null}
    </div>
  );
}
