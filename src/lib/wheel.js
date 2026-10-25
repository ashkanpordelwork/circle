// Values for the number wheels (components/Wheel.jsx). Pure, so they can be tested.
import { toNumber } from './plan.js'

export const range = (min, max, step = 1) => {
  const out = []
  for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100)
  return out
}

// The value in a list nearest to v (a typed or stored number that is not on the wheel).
export const nearest = (list, v) => {
  const n = toNumber(v)
  if (n == null) return null
  return list.reduce((best, x) => (Math.abs(x - n) < Math.abs(best - n) ? x : best), list[0])
}

// A weight on two wheels, whole kilos and a fraction: 62.5 → [62, 0.5].
export function splitWeight(v, fracs) {
  const n = toNumber(v)
  if (n == null) return [null, 0]
  const whole = Math.floor(n + 1e-9)
  return [whole, nearest(fracs, n - whole) ?? 0]
}
export const joinWeight = (whole, frac) => Math.round((whole + (frac || 0)) * 100) / 100

// Planned reps: "10" or a range "8-12".
export function parseReps(v) {
  const m = String(v ?? '').match(/(\d+)\s*(?:[-–تا]+\s*(\d+))?/)
  if (!m) return [10, null]
  const a = Number(m[1]), b = m[2] ? Number(m[2]) : null
  return [a, b != null && b > a ? b : null]
}
export const joinReps = (a, b) => (b != null && b > a ? `${a}-${b}` : String(a))
