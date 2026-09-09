import type { ReactNode } from "react";

export interface SparklineCardProps {
  name: string;
  value: number | string;
  why: string;
  /** Historical snapshot values, oldest first. */
  history: number[];
  /**
   * Optional extra content rendered inside the card below the sparkline — used
   * by `/scores` (US-18) to hang a disclosure of the score's contributions off
   * each card.
   */
  children?: ReactNode;
}

/** 60x20 sparkline. Line in primary, final point highlighted in accent. */
function Sparkline({ history }: { history: number[] }) {
  const w = 60;
  const h = 20;
  if (history.length < 2)
    return <svg width={w} height={h} aria-hidden="true" />;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = max - min || 1;
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * (w - 2) + 1;
    const y = h - 1 - ((v - min) / span) * (h - 2);
    return [x, y] as const;
  });
  const d = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const [lastX, lastY] = pts[pts.length - 1] as readonly [number, number];
  return (
    <svg
      className="sot-spark__chart"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="sot-spark__point" cx={lastX} cy={lastY} r="2" />
    </svg>
  );
}

export function SparklineCard({
  name,
  value,
  why,
  history,
  children,
}: SparklineCardProps) {
  return (
    <div className="sot-spark">
      <span className="sot-spark__value">{value}</span>
      <span className="sot-spark__name">{name}</span>
      <span className="sot-spark__why">{why}</span>
      <Sparkline history={history} />
      {children}
    </div>
  );
}
