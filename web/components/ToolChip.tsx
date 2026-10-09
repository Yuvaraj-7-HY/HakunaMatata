export default function ToolChip({
  name,
  args,
}: {
  name: string;
  args: Record<string, unknown>;
}) {
  const argText = Object.entries(args)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(", ");
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line bg-ground px-2 py-1 font-mono text-[11px] text-ink/70">
      <span className="text-teal">{name}</span>
      {argText ? <span className="text-ink/45">({argText})</span> : null}
    </span>
  );
}
