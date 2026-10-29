// «آمار» in numbers. Pure functions over the athlete's workouts and sets, so each figure on the
// page has a test beside it. Weeks start on Saturday; months are Jalali.
import { addDays, isoToJ } from './jalali.js'
import { weekStartOf } from './home.js'
import { estimate1RM } from './smart.js'

export const PERIODS = [['7', '۷ روز'], ['30', '۳۰ روز'], ['90', '۹۰ روز'], ['all', 'همه']]
// The first day a period covers; null for all of it.
export const periodStart = (period, today) => (period === 'all' ? null : addDays(today, -(Number(period) - 1)))
export const inPeriod = (date, period, today) => { const s = periodStart(period, today); return !s || (date >= s && date <= today) }

// Sessions, time, sets, reps and volume over a period. `sets` are the done sets of those workouts.
export function insights(workouts, sets, period, today) {
  const ws = workouts.filter(w => inPeriod(w.date, period, today))
  const ids = new Set(ws.map(w => w.id))
  const ss = sets.filter(s => ids.has(s.workout_id))
  const timed = ws.filter(w => w.duration_sec > 0)
  const seconds = timed.reduce((t, w) => t + w.duration_sec, 0)
  return {
    sessions: ws.length,
    minutes: Math.round(seconds / 60),
    avgMinutes: timed.length ? Math.round(seconds / 60 / timed.length) : null,
    sets: ss.length,
    reps: ss.reduce((r, s) => r + (Number(s.reps) || 0), 0),
    volume: Math.round(ss.reduce((v, s) => v + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0)),
    endedEarly: ws.filter(w => w.end_reason).length
  }
}

// Workouts this Jalali month.
export function thisMonth(workouts, today) {
  const [y, m] = isoToJ(today)
  return workouts.filter(w => { const [a, b] = isoToJ(w.date); return a === y && b === m }).length
}

// Body weight change over the last 30 days: newest minus the oldest entry in that window.
export function weightChange(weights, today) {
  const recent = weights.filter(w => w.date >= addDays(today, -29) && w.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1))
  if (recent.length < 2) return null
  return Math.round((Number(recent.at(-1).weight) - Number(recent[0].weight)) * 10) / 10
}

// The last `weeks` weeks day by day, Saturday first: rows are weekdays, columns are weeks
// (oldest first). Each cell: how many sets were done that day, and its level 0–4 for colour.
export function activityGrid(workouts, sets, today, weeks = 15) {
  const perDay = {}
  const dayOf = Object.fromEntries(workouts.map(w => [w.id, w.date]))
  for (const w of workouts) perDay[w.date] = perDay[w.date] || 0
  for (const s of sets) { const d = dayOf[s.workout_id]; if (d) perDay[d] = (perDay[d] || 0) + 1 }
  const max = Math.max(1, ...Object.values(perDay))
  const first = addDays(weekStartOf(today), -7 * (weeks - 1))
  const cols = Array.from({ length: weeks }, (_, c) => Array.from({ length: 7 }, (_, r) => {
    const date = addDays(first, c * 7 + r)
    const n = perDay[date]
    return { date, sets: n ?? 0, level: n === undefined ? 0 : n === 0 ? 1 : Math.min(4, 1 + Math.ceil((n / max) * 3)), future: date > today }
  }))
  return cols
}

// Sets per muscle over a period, by each exercise's primary muscles (a set counts once for
// each). muscles(exerciseId) → the exercise's primary muscles.
export function muscleBalance(workouts, sets, period, today, muscles) {
  const ids = new Set(workouts.filter(w => inPeriod(w.date, period, today)).map(w => w.id))
  const count = {}
  for (const s of sets) {
    if (!ids.has(s.workout_id)) continue
    for (const m of muscles(s.exercise_id) || []) count[m] = (count[m] || 0) + 1
  }
  return Object.entries(count).map(([muscle, n]) => ({ muscle, sets: n })).sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle))
}

// One point per session for an exercise: the best estimated one-rep max and the heaviest set.
export function exerciseSeries(workouts, sets, exId) {
  const dateOf = Object.fromEntries(workouts.map(w => [w.id, w.date]))
  const by = {}
  for (const s of sets) {
    if (s.exercise_id !== exId || !dateOf[s.workout_id]) continue
    const d = dateOf[s.workout_id], w = Number(s.weight) || 0, r = Number(s.reps) || 0
    const p = by[d] || (by[d] = { date: d, best: 0, e1rm: null, w: 0, r: 0 })
    if (w > p.best) p.best = w
    const est = estimate1RM(w, r)
    if (est != null && (p.e1rm == null || est > p.e1rm)) Object.assign(p, { e1rm: est, w, r })
  }
  return Object.values(by).sort((a, b) => (a.date < b.date ? -1 : 1))
}

// The exercises logged, most-trained first: what the exercise picker on «آمار» offers.
export function trainedExercises(sets) {
  const n = {}
  for (const s of sets) n[s.exercise_id] = (n[s.exercise_id] || 0) + 1
  return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([id]) => id)
}
