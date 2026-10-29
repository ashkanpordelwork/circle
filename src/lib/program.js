// Monthly programs: a start date, a number of weeks, so many sessions a week, and each week's
// sessions written one by one. Sessions are numbered, never named, and not tied to weekdays.
// Pure helpers; supabase/migrations/0006_programs.sql stores what they build.
import { addDays, daysBetween } from './jalali.js'
import { newId, newItem, toPayload } from './plan.js'

export const DURATIONS = [[4, 'یک ماه'], [8, 'دو ماه'], [12, 'سه ماه']]
const fa = n => Number(n).toLocaleString('fa-IR')
export const sessionLabel = n => `جلسه ${fa(n)}`
export const weekLabel = n => `هفته ${fa(n)}`

export const programEnd = p => addDays(p.start_date, p.weeks * 7 - 1)
// Which week of the program a date falls in (1…weeks), or null outside it.
export function weekOf(p, iso) {
  const d = daysBetween(p.start_date, iso)
  return d < 0 || d >= p.weeks * 7 ? null : Math.floor(d / 7) + 1
}
export const weekRange = (p, w) => [addDays(p.start_date, (w - 1) * 7), addDays(p.start_date, (w - 1) * 7 + 6)]

// The program running today (the later one if two overlap), the next one, and the last one that ended.
export function pickPrograms(programs, today) {
  const byStart = [...programs].sort((a, b) => b.start_date.localeCompare(a.start_date))
  const current = byStart.find(p => weekOf(p, today) != null) || null
  const next = byStart.filter(p => p.start_date > today).at(-1) || null
  const past = byStart.filter(p => programEnd(p) < today)
  return { current, next, past }
}

// Where a new program starts by default: the day after the last one ends, or today.
export function nextStart(programs, today) {
  const last = programs.map(programEnd).sort().at(-1)
  return last && last >= today ? addDays(last, 1) : today
}
export const overlaps = (programs, start, weeks, exceptId) => {
  const end = addDays(start, weeks * 7 - 1)
  return programs.some(p => p.id !== exceptId && p.start_date <= end && programEnd(p) >= start)
}

/* ---------- the editor's draft: { program, sessions: [{ id, week, session, items }] } ---------- */

export function toProgramDraft(program, routines, items) {
  return {
    program: { id: program.id, start_date: program.start_date, weeks: program.weeks, per_week: program.per_week },
    sessions: routines.filter(r => r.program_id === program.id).map(r => ({
      id: r.id, week: r.week, session: r.session,
      items: items.filter(i => i.routine_id === r.id).sort((a, b) => a.position - b.position)
        .map(i => ({ exercise_id: i.exercise_id, sets: i.sets, reps: i.reps, weight: i.weight ?? '', rest_sec: i.rest_sec ?? '', tempo: i.tempo || '', note: i.note || '', progression: i.progression || 'linear' }))
    }))
  }
}
export const newProgramDraft = (student, start, weeks, perWeek) =>
  ({ program: { id: newId(), start_date: start, weeks, per_week: perWeek }, sessions: [] })

export const sessionAt = (draft, week, session) => draft.sessions.find(s => s.week === week && s.session === session)

// The week's sessions 1…per_week, each with its items (empty when not written yet).
export const weekSessions = (draft, week) => Array.from({ length: draft.program.per_week }, (_, k) =>
  sessionAt(draft, week, k + 1) || { id: null, week, session: k + 1, items: [] })

// How far a week is written: sessions with at least one exercise.
export const weekFilled = (draft, week) => weekSessions(draft, week).filter(s => s.items.length).length

// Change one session's exercises, creating the session the first time.
export function setItems(draft, week, session, fn) {
  const cur = sessionAt(draft, week, session)
  const items = fn(cur?.items || [])
  if (cur) return { ...draft, sessions: draft.sessions.map(s => (s === cur ? { ...s, items } : s)) }
  return { ...draft, sessions: [...draft.sessions, { id: newId(), week, session, items }] }
}
export const addExercises = (draft, week, session, ids) => setItems(draft, week, session, items => [...items, ...ids.map(newItem)])

// Copy a week onto other weeks, replacing what they had: the usual way to write the next week.
export function copyWeek(draft, from, to) {
  const src = draft.sessions.filter(s => s.week === from && s.items.length)
  let sessions = draft.sessions
  for (const w of to) {
    if (w === from) continue
    sessions = [...sessions.filter(s => s.week !== w), ...src.map(s => ({ id: newId(), week: w, session: s.session, items: s.items.map(i => ({ ...i })) }))]
  }
  return { ...draft, sessions }
}

// Copy one session onto the same session of other weeks.
export function copySession(draft, week, session, toWeeks) {
  const src = sessionAt(draft, week, session)
  let out = draft
  for (const w of toWeeks) if (w !== week) out = setItems(out, w, session, () => (src?.items || []).map(i => ({ ...i })))
  return out
}

// New dates, length or sessions a week; what falls outside goes.
export function resize(draft, { start_date, weeks, per_week }) {
  const program = { ...draft.program, start_date: start_date ?? draft.program.start_date, weeks: weeks ?? draft.program.weeks, per_week: per_week ?? draft.program.per_week }
  return { program, sessions: draft.sessions.filter(s => s.week <= program.weeks && s.session <= program.per_week) }
}

// Start a program from another one: its last written week fills every week of the new one.
export function seedFrom(draft, source) {
  if (!source?.sessions.length) return draft
  const lastWeek = Math.max(...source.sessions.filter(s => s.items.length).map(s => s.week), 0)
  const src = source.sessions.filter(s => s.week === lastWeek && s.session <= draft.program.per_week)
  const sessions = []
  for (let w = 1; w <= draft.program.weeks; w++) for (const s of src) sessions.push({ id: newId(), week: w, session: s.session, items: s.items.map(i => ({ ...i })) })
  return { ...draft, sessions }
}
// …or from a weekday plan of before: its sessions in week order become sessions 1, 2, 3….
export function seedFromWeekdays(draft, routines) {
  const order = [6, 0, 1, 2, 3, 4, 5]
  const first = r => Math.min(...r.days.map(d => order.indexOf(d)), 7)
  const src = [...routines].filter(r => r.items.length).sort((a, b) => first(a) - first(b)).slice(0, draft.program.per_week)
  const sessions = []
  for (let w = 1; w <= draft.program.weeks; w++) src.forEach((r, k) => sessions.push({ id: newId(), week: w, session: k + 1, items: r.items.map(i => ({ ...i })) }))
  return { ...draft, sessions }
}

// What save_program receives: only sessions with exercises, numbers cleaned as for weekday plans.
export function toProgramPayload(draft) {
  const written = draft.sessions.filter(s => s.items.length && s.week <= draft.program.weeks && s.session <= draft.program.per_week)
  const clean = toPayload(written.map(s => ({ id: s.id, name: '', days: [], items: s.items })))
  return written.map((s, k) => ({ id: s.id, week: s.week, session: s.session, items: clean[k].items }))
}
export const programKey = draft => JSON.stringify([draft.program, toProgramPayload(draft)])

/* ---------- the student's week ---------- */

// This week's sessions in order, which are done, and the one to do next.
export function studentWeek(program, sessions, doneIds, today) {
  const week = weekOf(program, today)
  if (week == null) return null
  const list = sessions.filter(s => s.program_id === program.id && s.week === week).sort((a, b) => a.session - b.session)
    .map(s => ({ ...s, done: doneIds.has(s.id) }))
  const [, end] = weekRange(program, week)
  return { week, list, next: list.find(s => !s.done) || null, daysLeft: daysBetween(today, end) + 1, end }
}
