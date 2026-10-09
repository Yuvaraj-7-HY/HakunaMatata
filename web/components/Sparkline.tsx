import { healthColor } from "@/lib/format";

export default function Sparkline({
  values,
  width = 132,
  height = 36,
  color,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) {
    return <span className="text-xs text-ink/40">no data</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const pad = 3;
  const usable = height - pad * 2;

  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = pad + usable * (1 - (v - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const stroke = color ?? healthColor(values[values.length - 1]);
  const last = values[values.length - 1];
  const lastX = width;
  const lastY = pad + usable * (1 - (last - min) / span);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`14-day health sparkline, latest ${last.toFixed(0)}`}
      className="overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={2.6} fill={stroke} />
    </svg>
  );
}
