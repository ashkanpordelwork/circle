// Pure helpers for plans and logs. Kept free of React and Supabase so they can be unit-tested.

// Persian week: Saturday first. Values are JavaScript getDay() numbers (0 = Sunday).
export const WEEK = [6, 0, 1, 2, 3, 4, 5]
export const DAY_NAMES = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']
export const DAY_SHORT = ['یک', 'دو', 'سه', 'چهار', 'پنج', 'جمعه', 'شنبه']

export const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())

export const newId = () => crypto.randomUUID()

export const routinesForDay = (routines, day) =>
  routines.filter(r => (r.days || []).includes(day)).sort((a, b) => a.position - b.position)

// Rows from Supabase (routines + routine_items) → the editor's draft: routines with their items.
export function toDraft(routines, items) {
  return [...routines].sort((a, b) => a.position - b.position).map(r => ({
    id: r.id, name: r.name, days: [...(r.days || [])],
    items: items.filter(i => i.routine_id === r.id).sort((a, b) => a.position - b.position)
      .map(i => ({ exercise_id: i.exercise_id, sets: i.sets, reps: i.reps, weight: i.weight ?? '', rest_sec: i.rest_sec ?? '', note: i.note || '' }))
  }))
}

// The editor's draft → the save_plan payload, with numbers that are numbers and blanks that are null.
export function toPayload(draft) {
  const num = v => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))
  return draft.map(r => ({
    id: r.id,
    name: r.name.trim() || 'روتین',
    days: [...new Set(r.days)].filter(d => d >= 0 && d <= 6),
    items: r.items.map(i => ({
      exercise_id: i.exercise_id,
      sets: Math.min(20, Math.max(1, Math.round(num(i.sets) || 3))),
      reps: String(i.reps || '10').slice(0, 20),
      weight: num(i.weight),
      rest_sec: num(i.rest_sec),
      note: (i.note || '').slice(0, 500)
    }))
  }))
}

export const draftKey = (draft, note) => JSON.stringify(toPayload(draft)) + '|' + (note || '')

// The logging form for one routine: one row per planned set, prefilled with the plan's numbers
// (the lower end of a range like "8-10"), or with what the student lifted last time when known.
export function blankLog(routine, lastSets = []) {
  return routine.items.map(it => {
    const prev = lastSets.filter(s => s.exercise_id === it.exercise_id)
    const reps = parseInt(String(it.reps), 10)
    return {
      exercise_id: it.exercise_id,
      sets: Array.from({ length: it.sets }, (_, k) => {
        const p = prev.find(s => s.set_index === k + 1)
        return { done: false, reps: p?.reps ?? (Number.isNaN(reps) ? '' : reps), weight: p?.weight ?? it.weight ?? '' }
      })
    }
  })
}

// Only ticked sets are saved.
export function logToRows(workoutId, log) {
  const rows = []
  for (const ex of log) {
    let n = 0
    for (const s of ex.sets) {
      if (!s.done) continue
      n++
      rows.push({
        workout_id: workoutId, exercise_id: ex.exercise_id, set_index: n,
        reps: s.reps === '' ? null : Math.round(Number(s.reps)),
        weight: s.weight === '' || s.weight == null ? null : Number(s.weight)
      })
    }
  }
  return rows
}

// Volume and best set per exercise for a list of logged sets.
export function summarize(sets) {
  const per = new Map()
  for (const s of sets) {
    const e = per.get(s.exercise_id) || { sets: 0, volume: 0, best: null }
    e.sets++
    e.volume += (Number(s.weight) || 0) * (Number(s.reps) || 0)
    if (s.weight != null && (!e.best || Number(s.weight) > Number(e.best.weight))) e.best = s
    per.set(s.exercise_id, e)
  }
  return per
}

export const fmtNum = n => (n == null || n === '' ? '—' : Number(n).toLocaleString('fa-IR', { maximumFractionDigits: 2 }))
export const fmtDate = (iso, opts = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('fa-IR', opts)
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// One logged set as the coach and the student read it: "60kg × 10", or "× 10" for bodyweight.
export const setText = s => (s.weight != null ? `${Number(s.weight)}kg × ` : '× ') + (s.reps ?? '—')
