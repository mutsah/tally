// SVG donut. Segment sizes are display geometry computed from fractions (ratios,
// not money) — the money values themselves stay strings and are rendered by the
// caller. Starts at 12 o'clock (rotated -90°).
const R = 48;
const STROKE = 16;
const C = 2 * Math.PI * R;

export interface DonutSegment {
  id: string;
  color: string; // CSS color
  fraction: number; // 0..1
}

export function Donut({
  segments,
  children,
}: {
  segments: DonutSegment[];
  children?: React.ReactNode;
}) {
  const dashes = segments.map((s) => s.fraction * C);
  // Cumulative start offset per segment (pure — no render-time mutation).
  const offsets = dashes.map((_, i) =>
    dashes.slice(0, i).reduce((sum, d) => sum + d, 0),
  );
  return (
    <div className="relative size-40 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={STROKE}
        />
        {segments.map((s, i) => (
          <circle
            key={s.id}
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={STROKE}
            strokeDasharray={`${dashes[i]} ${C - dashes[i]}`}
            strokeDashoffset={-offsets[i]}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
