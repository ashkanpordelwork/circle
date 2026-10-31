// «امروز» worked out: which session is today's, how much of each macro is left, which supplement
// doses are due. Pure functions; the page (pages/student/Today.jsx) only draws them.

import { routinesForDay } from './plan.js'

/* ---------- the session ---------- */

// The athlete's own routines: by weekday when they have days, else in order — the one after the
// routine trained last (round and round). lastDone: { routineId: 'YYYY-MM-DD' }.
//   → { r, kind: 'today' | 'next' | 'rest', done } or null when there are no routines.
// 'rest': routines have weekdays and today has none; r is then the next session, on `day`.
export function ownSession(mine, weekday, lastDone, today) {
  const list = mine.filter(r => r.items?.length).sort((a, b) => a.position - b.position)
  if (!list.length) return null
  if (list.some(r => r.days?.length)) {
    const todays = routinesForDay(list, weekday)
    const open = todays.find(r => lastDone[r.id] !== today)
    if (open) return { r: open, kind: 'today', done: false }
    if (todays.length) return { r: todays[0], kind: 'today', done: true }
    for (let k = 1; k <= 7; k++) {
      const next = routinesForDay(list, (weekday + k) % 7)[0]
      if (next) return { r: next, kind: 'rest', done: false, day: (weekday + k) % 7 }
    }
  }
  // In order: today's if one was already done today, else the one after the last trained.
  const doneToday = list.find(r => lastDone[r.id] === today)
  if (doneToday) return { r: doneToday, kind: 'today', done: true }
  let last = -1, lastDate = ''
  list.forEach((r, i) => { if ((lastDone[r.id] || '') > lastDate) { lastDate = lastDone[r.id]; last = i } })
  return { r: list[(last + 1) % list.length], kind: 'next', done: false }
}

/* ---------- food ---------- */

export const MACROS = ['protein', 'calories', 'carbs', 'fat']
const round = v => Math.round(Number(v) || 0)

export const totalsOf = logs => Object.fromEntries(MACROS.map(k => [k, round(logs.reduce((s, l) => s + (Number(l[k]) || 0), 0))]))

// Each macro: eaten, the target, what is left (never below zero), how far (0–1), and over.
export function macroProgress(targets, logs) {
  const eaten = totalsOf(logs)
  return Object.fromEntries(MACROS.map(k => {
    const target = round(targets?.[k])
    return [k, { eaten: eaten[k], target, left: Math.max(0, target - eaten[k]), share: target ? Math.min(1, eaten[k] / target) : 0, over: target > 0 && eaten[k] > target }]
  }))
}

// A planned meal's log for today, with its own copy of the macros.
export const mealLog = (meal, studentId, date) => ({
  student_id: studentId, date, meal_id: meal.id, name: meal.name,
  calories: Number(meal.calories) || 0, protein: Number(meal.protein) || 0, carbs: Number(meal.carbs) || 0, fat: Number(meal.fat) || 0
})

/* ---------- supplements ---------- */

// Words people use for a time of day, to minutes after midnight. «بعد از تمرین» has no clock: it
// is due once today's workout is logged.
const WORDS = [
  [/ناشتا|بیدار/, 7 * 60], [/صبح/, 8 * 60], [/ظهر|ناهار|نهار/, 13 * 60], [/عصر/, 17 * 60],
  [/شام/, 20 * 60], [/قبل از خواب|خواب|شب/, 22 * 60 + 30]
]
export const AFTER_WORKOUT = /تمرین/

// '08:00' or '۲۲:۳۰' → minutes; a word → its usual hour; else null (no clock).
export function minutesOf(label) {
  const t = String(label ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (m) return Number(m[1]) * 60 + Number(m[2])
  if (AFTER_WORKOUT.test(t)) return null
  for (const [re, min] of WORDS) if (re.test(t)) return min
  return null
}

// Every dose of today, in the order of the day: { key, supplement, time, taken, due }.
// due: its time has come (or, after a workout, the workout is logged) and it is not taken.
// A supplement with no times is one dose («روزانه»), due all day.
export function dosesOf(supplements, logs, nowMinutes, workedOut) {
  const taken = new Set(logs.map(l => `${l.supplement_id}|${l.time}`))
  const out = []
  for (const s of supplements) {
    const times = s.times?.length ? s.times : ['']
    for (const time of times) {
      const key = `${s.id}|${time}`
      const at = minutesOf(time)
      const after = AFTER_WORKOUT.test(time)
      const isTaken = taken.has(key)
      const reached = after ? workedOut : at == null ? true : nowMinutes >= at
      out.push({ key, supplement: s, time, at, taken: isTaken, due: !isTaken && reached })
    }
  }
  const order = d => (d.at ?? (AFTER_WORKOUT.test(d.time) ? 18 * 60 : -1))
  return out.sort((a, b) => order(a) - order(b) || a.supplement.position - b.supplement.position)
}

// The doses still to come today that have a clock, as reminders: { key, at: ms, title, body }.
export function reminders(doses, now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes()
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0)
  return doses.filter(d => !d.taken && d.at != null && d.at > mins)
    .map(d => ({ key: d.key, at: midnight.getTime() + d.at * 60000, title: `وقت ${d.supplement.name}`, body: [d.supplement.dose, d.time].filter(Boolean).join(' · ') }))
}
