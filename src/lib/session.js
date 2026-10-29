// A workout in progress, as plain data: what each set starts at, what was done, and what the
// finished session adds up to. The page (pages/student/LogWorkout.jsx) only draws it.
//
// Every set starts at the suggestion — the weight (and, for double progression, the reps) the
// progression engine gives for this exercise (lib/smart.js) — and carries the same set of the
// last session beside it, so the lifter sees both "what now" and "what last time".

import { suggest, repsOf, cfgOf, estimate1RM, best1RM } from './smart.js'
import { needsWeight, toNumber } from './plan.js'

export const DEFAULT_REST = 90

// The sets of the most recent session that trained this exercise: this routine's own if it has
// one, else any (a new program continues from where the lifter is).
export function lastSetsOf(history, exId, routineId) {
  const find = own => {
    for (let i = history.workouts.length - 1; i >= 0; i--) {
      const w = history.workouts[i]
      if (own && w.routineId !== routineId) continue
      const e = w.entries.find(x => x.id === exId)
      if (e && e.sets.length) return e.sets
    }
    return null
  }
  return (routineId && find(true)) || find(false) || []
}

// The session to log: one entry per exercise of the routine, each set ready to tick.
// equipmentOf(id) → the library's equipment word, which decides whether a set has a weight.
export function buildSession(routine, history, equipmentOf = () => '') {
  return routine.items.map(it => {
    const p = suggest(history, it, routine.id)
    const cfg = cfgOf(it)
    const last = lastSetsOf(history, it.exercise_id, routine.id)
    const range = repsOf(it.reps)
    const weighted = needsWeight(it, equipmentOf(it.exercise_id))
    const planWeight = toNumber(it.weight)
    const weight = !weighted ? ''
      : p.kind === 'off' ? (planWeight ?? last[0]?.w ?? '')
        : (p.weight ?? last[0]?.w ?? planWeight ?? '')
    // Linear and Greyskull judge a session against the top of a range; only double progression
    // climbs it from the bottom.
    const reps = p.reps ?? (cfg.prog === 'double' ? range.repsMin : range.reps) ?? range.reps ?? ''
    const count = Math.max(1, p.sets ?? Number(it.sets) ?? 1)
    return {
      exercise_id: it.exercise_id,
      weighted,
      rest: toNumber(it.rest_sec) || DEFAULT_REST,
      suggestion: p,
      sets: Array.from({ length: count }, (_, k) => ({
        weight: weight === 0 ? '' : weight,
        reps,
        done: false,
        prev: last[k] ? { w: last[k].w, r: last[k].r } : null
      }))
    }
  })
}

// The first set not yet ticked, as [exercise, set]; null when every set is done.
export function nextOpen(log) {
  for (let e = 0; e < log.length; e++) {
    const s = log[e].sets.findIndex(x => !x.done)
    if (s >= 0) return [e, s]
  }
  return null
}

export const doneSets = log => log.reduce((n, x) => n + x.sets.filter(s => s.done).length, 0)
export const totalSets = log => log.reduce((n, x) => n + x.sets.length, 0)

// What the finished session adds up to, and the estimated one-rep maxes it beat.
// `history` is everything logged before this session.
export function summarize(log, history, durationSec = 0) {
  let sets = 0, reps = 0, volume = 0
  const records = []
  for (const ex of log) {
    let best = null
    for (const s of ex.sets) {
      if (!s.done) continue
      const w = toNumber(s.weight) || 0, r = toNumber(s.reps) || 0
      sets++; reps += r; volume += w * r
      const est = estimate1RM(w, r)
      if (est != null && (!best || est > best.y)) best = { y: est, w, r }
    }
    if (!best) continue
    const before = best1RM(history, ex.exercise_id)
    if (!before || best.y > before.y) records.push({ exercise_id: ex.exercise_id, ...best, prev: before ? before.y : null })
  }
  return { sets, planned: totalSets(log), reps, volume: Math.round(volume * 10) / 10, minutes: Math.max(1, Math.round(durationSec / 60)), records }
}

// Why a session ended before its last set — stored with the workout, offered as chips.
export const END_REASONS = [
  ['time', 'وقت کم بود'], ['energy', 'انرژی کم بود'], ['pain', 'درد یا ناراحتی'],
  ['equipment', 'وسیله در دسترس نبود'], ['fit', 'برنامه مناسب نبود']
]

// A session in progress survives closing the app: it is kept on the device until it is saved
// or thrown away. Older than this, it is stale and starts fresh.
export const KEEP_HOURS = 12
export const draftKey = routineId => 'workout:' + routineId
export function readDraft(storage, routineId, now = Date.now()) {
  try {
    const d = JSON.parse(storage.getItem(draftKey(routineId)) || 'null')
    if (!d || !Array.isArray(d.log) || !(now - d.startedAt < KEEP_HOURS * 3600e3)) return null
    // Nothing ticked yet: nothing to resume — start fresh, with today's suggestions.
    if (!doneSets(d.log)) return null
    return d
  } catch { return null }
}
export function writeDraft(storage, routineId, draft) {
  try { storage.setItem(draftKey(routineId), JSON.stringify(draft)) } catch { /* private mode: no resume */ }
}
export function dropDraft(storage, routineId) {
  try { storage.removeItem(draftKey(routineId)) } catch { /* nothing kept */ }
}
