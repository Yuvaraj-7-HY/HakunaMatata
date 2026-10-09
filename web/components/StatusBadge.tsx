import { STATUS_BADGE, STATUS_LABEL } from "@/lib/format";
import type { Status } from "@/lib/types";

export default function StatusBadge({
  status,
  size = "md",
}: {
  status: Status;
  size?: "sm" | "md";
}) {
  const tone = STATUS_BADGE[status];
  const cls =
    size === "sm"
      ? "text-xs px-2 py-0.5 border"
      : "text-sm px-2.5 py-1 border";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${cls} ${tone.box}`}
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${tone.dot}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}
