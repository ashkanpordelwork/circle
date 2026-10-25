// Body weight over time, plain SVG. Time runs right to left, the way the page reads.
export default function WeightChart({ points }) {
  if (points.length < 2) return null
  const ws = points.map(p => Number(p.weight))
  const min = Math.min(...ws), max = Math.max(...ws), span = max - min || 1
  const W = 320, H = 120, pad = 12
  const xy = points.map((p, i) => [W - pad - (i * (W - 2 * pad)) / (points.length - 1), H - pad - ((Number(p.weight) - min) / span) * (H - 2 * pad)])
  const line = xy.map(p => p.join(',')).join(' ')
  return <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`نمودار وزن از ${ws[0]} تا ${ws[ws.length - 1]} کیلوگرم`}>
    <defs><linearGradient id="wfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity="0.25" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
    <polygon fill="url(#wfill)" points={`${xy[0][0]},${H} ${line} ${xy[xy.length - 1][0]},${H}`} />
    <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={line} />
    <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="4" fill="var(--accent)" />
  </svg>
}
