import { fmtDay } from "@/lib/format";
import type { Heatmap } from "@/lib/types";

// Machines (rows) x days (columns), colored by daily health.
function cellColor(v: number): string {
  if (v < 50) return "#B3261E";
  if (v < 70) return "#C98500";
  if (v < 85) return "#3E8E7E";
  return "#0F6B5C";
}

function cellOpacity(v: number): number {
  // Map 30..100 -> 0.45..1 so the grid reads as a heat field.
  const t = Math.max(0, Math.min(1, (v - 30) / 70));
  return 0.45 + 0.55 * t;
}

export default function FleetHeatmap({ heatmap }: { heatmap: Heatmap }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Fleet heatmap</h2>
          <p className="text-xs text-ink/50">
            Daily health per machine · darker = healthier
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="inline-block min-w-max">
          <div className="flex">
            <div className="w-14 shrink-0" />
            {heatmap.days.map((d) => (
              <div
                key={d}
                className="w-6 shrink-0 pb-1 text-center font-mono text-[9px] text-ink/40"
                style={{ writingMode: "vertical-rl" }}
                title={d}
              >
                {fmtDay(d)}
              </div>
            ))}
          </div>
          {heatmap.values.map((row, i) => (
            <div key={heatmap.machine_ids[i]} className="flex items-center">
              <div className="w-14 shrink-0 py-0.5 pr-2 text-right font-mono text-[11px] text-ink/60">
                {heatmap.machine_ids[i]}
              </div>
              <div className="flex">
                {row.map((v, j) => (
                  <div
                    key={j}
                    className="m-[1px] h-5 w-5 shrink-0 rounded-[3px]"
                    title={`${heatmap.machine_ids[i]} · ${heatmap.days[j]} · health ${v.toFixed(0)}`}
                    style={{
                      backgroundColor: cellColor(v),
                      opacity: cellOpacity(v),
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
