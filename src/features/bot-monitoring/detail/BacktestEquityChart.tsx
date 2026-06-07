/** Pure SVG area+line chart of a cumulative-profit curve. Color follows the
 * final value's sign. No animation, no deps — driven entirely by `curve`. */
export function BacktestEquityChart({ curve }: { curve: number[] }) {
  if (curve.length < 2) return null;
  const W = 720,
    H = 150,
    p = 8;
  // Always include 0 in the range so the zero baseline (and the area fill to
  // it) stays inside the viewport even for all-positive / all-negative curves.
  const min = Math.min(0, ...curve),
    max = Math.max(0, ...curve);
  const span = max - min || 1;
  const x = (i: number) => p + (i * (W - 2 * p)) / (curve.length - 1);
  const y = (v: number) => p + ((max - v) * (H - 2 * p)) / span;
  const zero = y(0);
  const line = curve
    .map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(curve.length - 1).toFixed(1)} ${zero.toFixed(1)} L${x(0).toFixed(1)} ${zero.toFixed(1)} Z`;
  const up = curve[curve.length - 1] >= 0;
  const stroke = up ? '#0ecb81' : '#f6465d';
  const fillTop = up ? 'rgba(14,203,129,0.26)' : 'rgba(246,70,93,0.26)';
  const fillBottom = up ? 'rgba(14,203,129,0)' : 'rgba(246,70,93,0)';
  const end = curve[curve.length - 1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block h-[150px] w-full"
      role="img"
      aria-label={`Backtest equity curve, ending ${up ? 'up' : 'down'} at ${end.toFixed(2)}`}
    >
      <defs>
        <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillTop} />
          <stop offset="100%" stopColor={fillBottom} />
        </linearGradient>
      </defs>
      <line
        x1={p}
        y1={zero}
        x2={W - p}
        y2={zero}
        stroke="#2b3139"
        strokeDasharray="3 3"
      />
      <path d={area} fill="url(#eq-grad)" />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}
