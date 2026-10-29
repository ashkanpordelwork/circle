// The few of openGym's history helpers that progression.js reads, copied unchanged.
import { isCardio, isBodyweightEq } from './exercises.js'
import { isWarmupRow } from './workout-model.js'

export function modeOf(cfg) {
  const m = cfg && cfg.mode
  if (m === 'reps' || m === 'time' || m === 'cardio') return m
  return isCardio(cfg && cfg.id) ? 'cardio' : 'reps'
}
// bodyweight: the exercise carries no load of its own. side: logged per side (reps are the total).
export const isBw = cfg => (cfg && cfg.bodyweight != null ? !!cfg.bodyweight : isBodyweightEq(cfg && cfg.id))
export const isPerSide = cfg => !!(cfg && cfg.side)
// Unilateral work moves in pairs, so its rep target steps by two.
export const repStep = cfg => (isPerSide(cfg) ? 2 : 1)

export function entryExcluded(w, entry) {
  return w?.excludeFromProgression === true || entry?.noProg === true
}
// Which routine a saved entry was planned by — the "slot" its numbers belong to.
export function entryRoutineId(w, en) {
  if (en?.rid) return en.rid
  if ((w?.entries || []).some(e => e && e.rid)) return null
  return [].concat(w?.routineIds ?? [])[0] ?? w?.routineId ?? null
}

// Warm-up rows ramp toward the first work set's weight.
export function rerampWarmups(rows, step = 2.5) {
  const firstWork = rows.findIndex(x => !isWarmupRow(x))
  if (firstWork <= 0) return rows
  const target = rows[firstWork].w || 0
  if (!(target > 0)) return rows
  const out = rows.slice()
  let from = 0
  for (let i = 0; i < firstWork; i++) {
    if (out[i].done) { from = out[i].w || 0; continue }
    const w = target > from
      ? Math.max(0, Math.min(target, Math.floor((from + (target - from) / 2) / step) * step))
      : target
    out[i] = { ...out[i], w }
    from = w
  }
  return out
}
