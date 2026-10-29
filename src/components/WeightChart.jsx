import LineChart from './LineChart.jsx'

// Body weight over time (points: [{ date, weight }], oldest first).
export default function WeightChart({ points }) {
  return <LineChart points={points.map(p => ({ y: Number(p.weight) }))} unit="کیلو"
    label={points.length > 1 ? `نمودار وزن از ${points[0].weight} تا ${points[points.length - 1].weight} کیلو` : ''} />
}
