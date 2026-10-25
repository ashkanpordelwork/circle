// A small line chart of body weight over time; plain SVG, oldest on the right (RTL reading).
export default function WeightChart({ points }) {
  if (points.length < 2) return null
  const ws = points.map(p => Number(p.weight))
  const min = Math.min(...ws), max = Math.max(...ws), span = max - min || 1
  const W = 300, H = 120, pad = 10
  const xy = points.map((p, i) => [W - pad - (i * (W - 2 * pad)) / (points.length - 1), H - pad - ((Number(p.weight) - min) / span) * (H - 2 * pad)])
  return <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="نمودار وزن">
    <polyline fill="none" stroke="var(--acc)" strokeWidth="2.5" strokeLinejoin="round" points={xy.map(p => p.join(',')).join(' ')} />
    {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="var(--acc)" />)}
  </svg>
}
