import type { Suspected } from "@/lib/types";
import ScheduleButton from "./ScheduleButton";

const HIGHLIGHT = "#B3261E";
const IDLE = "#0F6B5C";

function pick(subsystem: string | null) {
  const s = (subsystem ?? "").toLowerCase();
  return {
    bearings: s.includes("bearing") || s.includes("rotating"),
    cooling: s.includes("cooling") || s.includes("lubric"),
    drive: s.includes("drive") || s.includes("load"),
  };
}

export default function SubsystemSchematic({
  suspected,
  suggestedAction,
}: {
  suspected: Suspected | null;
  suggestedAction: string;
}) {
  const hit = pick(suspected?.subsystem ?? null);

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink">Suspected subsystem</h2>
      <p className="text-xs text-ink/50">
        A 2D schematic; the suspected part is highlighted for inspection.
      </p>

      <div className="mt-3 rounded-md bg-ground p-2">
        <svg viewBox="0 0 360 150" className="h-44 w-full" role="img" aria-label="Motor schematic">
          {/* base */}
          <rect x="20" y="118" width="320" height="12" rx="3" fill="#14201C" opacity="0.15" />

          {/* cooling fins */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x={70 + i * 22}
              y="42"
              width="10"
              height="66"
              rx="3"
              fill={hit.cooling ? HIGHLIGHT : IDLE}
              opacity={hit.cooling ? 0.9 : 0.18}
            />
          ))}

          {/* motor body */}
          <rect x="60" y="30" width="180" height="90" rx="12" fill="#14201C" opacity="0.06" />
          <rect x="60" y="30" width="180" height="90" rx="12" fill="none" stroke="#14201C" strokeOpacity="0.25" strokeWidth="1.5" />

          {/* bearings (hidden radial) */}
          <circle cx="96" cy="75" r="17" fill={hit.bearings ? HIGHLIGHT : IDLE} opacity={hit.bearings ? 0.9 : 0.16} />
          <circle cx="96" cy="75" r="17" fill="none" stroke="#14201C" strokeOpacity="0.3" strokeWidth="1.5" />
          <circle cx="204" cy="75" r="17" fill={hit.bearings ? HIGHLIGHT : IDLE} opacity={hit.bearings ? 0.9 : 0.16} />
          <circle cx="204" cy="75" r="17" fill="none" stroke="#14201C" strokeOpacity="0.3" strokeWidth="1.5" />

          {/* shaft */}
          <rect x="240" y="68" width="70" height="14" rx="4" fill="#14201C" opacity="0.2" />

          {/* drive / load coupling */}
          <rect x="300" y="56" width="30" height="38" rx="6" fill={hit.drive ? HIGHLIGHT : IDLE} opacity={hit.drive ? 0.9 : 0.16} />
          <rect x="300" y="56" width="30" height="38" rx="6" fill="none" stroke="#14201C" strokeOpacity="0.3" strokeWidth="1.5" />

          <text x="60" y="20" fontSize="11" fill="#14201C" opacity="0.55">Motor housing</text>
          <text x="84" y="132" fontSize="10" fill="#14201C" opacity="0.5">bearings</text>
          <text x="86" y="16" fontSize="10" fill="#14201C" opacity="0.5" />
          <text x="300" y="132" fontSize="10" fill="#14201C" opacity="0.5">drive / load</text>
          <text x="150" y="20" fontSize="10" fill="#14201C" opacity="0.5">cooling fins</text>
        </svg>
      </div>

      <div className="mt-3 space-y-2">
        {suspected ? (
          <>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: HIGHLIGHT }}
              />
              <span className="font-semibold text-ink">
                {suspected.subsystem}
              </span>
            </div>
            <p className="text-sm text-ink/65">Basis: {suspected.basis}.</p>
            <p className="rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-xs font-medium text-amber">
              {suspected.caveat}
            </p>
          </>
        ) : (
          <p className="text-sm text-ink/60">
            No suspected subsystem — machine is within normal range.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-ink/70">
          Suggested action: <strong className="text-ink">{suggestedAction}</strong>
        </p>
        <ScheduleButton />
      </div>
      <p className="mt-2 text-xs text-ink/40">
        “Schedule inspection” is a mock button — no work order is created.
      </p>
    </div>
  );
}
