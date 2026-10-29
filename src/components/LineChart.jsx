import { faDigits } from '../lib/plan.js'

// A value over time, plain SVG. Time runs right to left, the way the page reads.
// points: [{ y }], oldest first. The highest and lowest values are written at the side.
export default function LineChart({ points, label, unit = '' }) {
  if (points.length < 2) return null
  const ys = points.map(p => Number(p.y))
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1
  const W = 320, H = 120, pad = 12
  const xy = points.map((p, i) => [W - pad - (i * (W - 2 * pad)) / (points.length - 1), H - pad - ((Number(p.y) - min) / span) * (H - 2 * pad)])
  const line = xy.map(p => p.join(',')).join(' ')
  const id = 'fill' + Math.round(min * 10) + '-' + points.length
  return <div className="line-chart">
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label || `از ${ys[0]} تا ${ys[ys.length - 1]} ${unit}`}>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity="0.25" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
      <polygon fill={`url(#${id})`} points={`${xy[0][0]},${H} ${line} ${xy[xy.length - 1][0]},${H}`} />
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={line} />
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="4" fill="var(--accent)" />
    </svg>
    <div className="chart-scale caption"><span>{faDigits(max)} {unit}</span><span>{faDigits(min)} {unit}</span></div>
  </div>
}
