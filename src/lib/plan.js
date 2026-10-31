// Pure helpers for plans and logs. Kept free of React and Supabase so they can be unit-tested.
import { toLatinDigits } from './phone.js'

// Numbers as people type them on a Persian keyboard: "۶۰" and "۷۸٫۵" are 60 and 78.5.
export const toNumber = v => {
  if (v === '' || v == null) return null
  const n = Number(toLatinDigits(v).replace(/[٫,]/g, '.').trim())
  return Number.isFinite(n) ? n : null
}

// Persian week: Saturday first. Values are JavaScript getDay() numbers (0 = Sunday).
export const WEEK = [6, 0, 1, 2, 3, 4, 5]
export const DAY_NAMES = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']

export const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())

export const newId = () => crypto.randomUUID()

export const routinesForDay = (routines, day) =>
  routines.filter(r => (r.days || []).includes(day)).sort((a, b) => a.position - b.position)

// Rows from Supabase (routines + routine_items) → the editor's draft: routines with their items.
export function toDraft(routines, items) {
  return [...routines].sort((a, b) => a.position - b.position).map(r => ({
    id: r.id, name: r.name, days: [...(r.days || [])], owner: r.owner || 'coach', program_id: r.program_id || null, week: r.week ?? null, session: r.session ?? null,
    items: items.filter(i => i.routine_id === r.id).sort((a, b) => a.position - b.position)
      .map(i => ({ exercise_id: i.exercise_id, sets: i.sets, reps: i.reps, weight: i.weight ?? '', rest_sec: i.rest_sec ?? '', tempo: i.tempo || '', note: i.note || '', progression: i.progression || 'linear' }))
  }))
}

// The editor's draft → the save_plan payload, with numbers that are numbers and blanks that are null.
export function toPayload(draft) {
  const num = toNumber
  return draft.map(r => ({
    id: r.id,
    name: r.name.trim() || 'برنامه',
    days: [...new Set(r.days)].filter(d => d >= 0 && d <= 6),
    items: r.items.map(i => ({
      exercise_id: i.exercise_id,
      sets: Math.min(20, Math.max(1, Math.round(num(i.sets) || 3))),
      reps: toLatinDigits(i.reps || '10').trim().slice(0, 20),
      weight: num(i.weight),
      rest_sec: num(i.rest_sec),
      tempo: normTempo(i.tempo),
      note: (i.note || '').slice(0, 500),
      progression: ['linear', 'double', 'greyskull', 'off'].includes(i.progression) ? i.progression : 'linear'
    }))
  }))
}

// A new exercise in a session: three sets of ten until the coach says otherwise.
export const newItem = id => ({ exercise_id: id, sets: 3, reps: '10', weight: '', rest_sec: '', tempo: '', note: '', progression: 'linear' })


// Tempo: four phases in seconds — lowering, pause at the bottom, lifting, pause at the top.
// "X" is explosive. Stored as "3010"; anything else becomes "" (no tempo).
export const normTempo = t => {
  const v = toLatinDigits(String(t ?? '')).toUpperCase().replace(/[^0-9X]/g, '')
  return v.length === 4 ? v : ''
}
export const TEMPO_PHASES = ['پایین آوردن', 'مکث پایین', 'بالا بردن', 'مکث بالا']
export const fmtTempo = t => (normTempo(t) ? [...normTempo(t)].map(c => (c === 'X' ? 'X' : faDigits(c))).join('-') : '')
// "۳ ثانیه پایین آوردن · بدون مکث · ۱ ثانیه بالا بردن · بدون مکث" — the tempo in words.
export const tempoWords = t => {
  const v = normTempo(t)
  if (!v) return ''
  return [...v].map((c, i) => {
    if (c === 'X') return TEMPO_PHASES[i] + ' انفجاری'
    if (c === '0') return i % 2 ? 'بدون ' + TEMPO_PHASES[i] : TEMPO_PHASES[i] + ' سریع'
    return `${faDigits(c)} ثانیه ${TEMPO_PHASES[i]}`
  }).join(' · ')
}

// The logging form for one routine: one row per planned set. Reps start at the plan's number (the
// lower end of a range like "8-10"); the weight starts empty, so the student enters what they
// actually lifted — last time's weight, or the plan's, is only a hint (and where the picker opens).
export function blankLog(routine, lastSets = []) {
  return routine.items.map(it => {
    const prev = lastSets.filter(s => s.exercise_id === it.exercise_id)
    const reps = parseInt(String(it.reps), 10)
    return {
      exercise_id: it.exercise_id,
      sets: Array.from({ length: it.sets }, (_, k) => {
        const p = prev.find(s => s.set_index === k + 1)
        const hint = p?.weight ?? (it.weight === '' ? null : it.weight) ?? null
        return { done: false, reps: p?.reps ?? (Number.isNaN(reps) ? '' : reps), weight: '', hint }
      })
    }
  })
}

// A set can be ticked only once its weight is entered. Bodyweight work (no weight planned for a
// bodyweight exercise) needs reps instead.
// Bodyweight moves: 'body weight' in the exercise library, 'body only' in its older entries.
const BODYWEIGHT = new Set(['body weight', 'body only'])
export const needsWeight = (item, equipment) => !(BODYWEIGHT.has(equipment) && (item.weight === '' || item.weight == null))
export const canTick = (set, weightNeeded) =>
  weightNeeded ? toNumber(set.weight) != null : toNumber(set.reps) != null

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
        reps: toNumber(s.reps) == null ? null : Math.round(toNumber(s.reps)),
        weight: toNumber(s.weight)
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

// Display text is all Persian digits: a Latin number or unit inside a Persian line gets reordered
// by the bidi algorithm and reads backwards ("kg 60").
export const faDigits = v => String(v ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]).replace(/\./g, '٫')
export const kg = w => `${faDigits(toNumber(w) ?? '—')} کیلو`

// What a number field shows (Persian digits) and what it stores (the same number, Latin digits).
export const showNum = v => faDigits(v)
export const readNum = s => toLatinDigits(s).replace(/٫/g, '.')

// A planned exercise: "۳ × ۸-۱۲ · ۶۰ کیلو".
export const fmtTarget = it =>
  `${faDigits(it.sets)} × ${faDigits(it.reps || '—')}` + (it.weight !== '' && it.weight != null ? ` · ${kg(it.weight)}` : '') +
  (normTempo(it.tempo) ? ` · تمپو ${fmtTempo(it.tempo)}` : '')

// One logged set: "۶۰ کیلو × ۱۰", or "۱۰ تکرار" with no weight (bodyweight).
export const setText = s => (s.weight != null ? `${kg(s.weight)} × ${faDigits(s.reps ?? '—')}` : `${faDigits(s.reps ?? '—')} تکرار`)
