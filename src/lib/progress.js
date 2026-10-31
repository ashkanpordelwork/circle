// «پیشرفت» in three parts: one sentence of encouragement taken from the athlete's own numbers,
// the estimated one-rep max of their main lifts over time, and how often they hit their protein.
// Built on stats.js (sessions, volume, the one-rep-max series) and home.js (weeks, streak).

import { addDays } from './jalali.js'
import { weekStartOf, streakWeeks } from './home.js'
import { exerciseSeries, trainedExercises } from './stats.js'

const fa = n => Number(n).toLocaleString('fa-IR')

// Kilograms moved in the workouts whose date falls in [from, to].
function volumeBetween(workouts, sets, from, to) {
  const ids = new Set(workouts.filter(w => w.date >= from && w.date <= to).map(w => w.id))
  return sets.filter(s => ids.has(s.workout_id)).reduce((v, s) => v + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0)
}

// Records this week: exercises whose best estimate this week beats every week before.
export function recordsThisWeek(workouts, sets, today) {
  const start = weekStartOf(today)
  const out = []
  for (const id of trainedExercises(sets)) {
    const s = exerciseSeries(workouts, sets, id).filter(p => p.e1rm != null)
    const now = s.filter(p => p.date >= start), before = s.filter(p => p.date < start)
    if (!now.length || !before.length) continue
    const best = Math.max(...now.map(p => p.e1rm)), prev = Math.max(...before.map(p => p.e1rm))
    if (best > prev) out.push({ exercise_id: id, e1rm: best, prev })
  }
  return out.sort((a, b) => b.e1rm / b.prev - a.e1rm / a.prev)
}

// The one sentence, from what is true this week, best news first:
// a new record → more volume than last week (by how much) → the streak → sessions so far.
// name(id) gives an exercise's Persian name.
export function motivation(workouts, sets, today, name = id => id) {
  if (!workouts.length) return { kind: 'start', text: 'اولین تمرینت را که ثبت کنی، پیشرفتت از همین‌جا شروع می‌شود.' }
  const rec = recordsThisWeek(workouts, sets, today)[0]
  if (rec) return { kind: 'record', text: `رکورد جدید در ${name(rec.exercise_id)}: یک‌تکرار تخمینی‌ات به ${fa(Math.round(rec.e1rm * 10) / 10)} کیلو رسید.` }
  const start = weekStartOf(today)
  const now = volumeBetween(workouts, sets, start, today)
  // Last week up to the same weekday, so a Monday is not compared with a whole week.
  const days = Math.round((Date.parse(today) - Date.parse(start)) / 864e5)
  const before = volumeBetween(workouts, sets, addDays(start, -7), addDays(start, -7 + days))
  if (before > 0 && now > before) return { kind: 'volume', text: `این هفته حجم تمرینت ${fa(Math.round(((now - before) / before) * 100))}٪ بیشتر از همین وقتِ هفته‌ی قبل است.` }
  const dates = [...new Set(workouts.map(w => w.date))]
  const streak = streakWeeks(dates, today)
  if (streak >= 2) return { kind: 'streak', text: `${fa(streak)} هفته است پشت سر هم تمرین می‌کنی. ادامه بده.` }
  const thisWeek = workouts.filter(w => w.date >= start && w.date <= today).length
  if (thisWeek) return { kind: 'week', text: `این هفته ${fa(thisWeek)} جلسه تمرین کرده‌ای.` }
  return { kind: 'back', text: 'این هفته هنوز تمرین نکرده‌ای. یک جلسه کافی است تا دوباره راه بیفتی.' }
}

// The main lifts: the most-trained exercises that have a one-rep-max estimate, each with its
// series (oldest first), its best and its latest change. Up to `n`.
export function mainLifts(workouts, sets, n = 3) {
  const out = []
  for (const id of trainedExercises(sets)) {
    const points = exerciseSeries(workouts, sets, id).filter(p => p.e1rm != null)
    if (!points.length) continue
    const best = points.reduce((b, p) => (p.e1rm > b.e1rm ? p : b))
    const change = points.length > 1 ? Math.round((points.at(-1).e1rm - points[0].e1rm) * 10) / 10 : null
    out.push({ exercise_id: id, points, best, change })
    if (out.length === n) break
  }
  return out
}

// Of the last `days` days up to today, how many reached the protein target, and which.
// logs: meal_logs rows ({ date, protein }); target: grams a day.
export function proteinAdherence(logs, target, today, days = 7) {
  if (!(target > 0)) return null
  const sum = {}
  for (const l of logs) sum[l.date] = (sum[l.date] || 0) + (Number(l.protein) || 0)
  // Day by day, oldest first, ending today.
  const list = Array.from({ length: days }, (_, k) => { const date = addDays(today, k - days + 1); return { date, hit: (sum[date] || 0) >= target } })
  const hit = list.filter(d => d.hit).length
  return { hit, of: days, share: hit / days, days: list }
}
