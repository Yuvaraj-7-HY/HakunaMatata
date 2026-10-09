import { fmtDateTime } from "@/lib/format";
import type { ContextItem } from "@/lib/types";

export default function ContextCard({ items }: { items: ContextItem[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink">Context</h2>
      <p className="text-xs text-ink/50">
        Regime changes that explain part of a deviation — so we don’t cry wolf.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((c, i) => (
          <li
            key={i}
            className="rounded-md border border-line bg-ground/60 px-3 py-2 text-sm text-ink/75"
          >
            <time className="mr-2 font-mono text-xs text-ink/45">
              {fmtDateTime(c.ts)}
            </time>
            {c.text}
          </li>
        ))}
        {items.length === 0 ? (
          <li className="text-sm text-ink/50">
            No regime changes in this window.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
