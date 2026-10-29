// «امروز» in numbers: this week day by day, the streak, the volume, the weeks before.
// Weeks start on Saturday, as everywhere in the app.
import { addDays, weekdaySat } from './jalali.js'

export const weekStartOf = iso => addDays(iso, -weekdaySat(iso))

// Saturday to Friday of the week holding `today`, each day with whether it was trained.
export function weekDays(today, trainedDates) {
  const set = new Set(trainedDates)
  const start = weekStartOf(today)
  return Array.from({ length: 7 }, (_, k) => {
    const d = addDays(start, k)
    return { date: d, trained: set.has(d), today: d === today, future: d > today }
  })
}

// Weeks in a row with at least one workout, counting back from this week. This week counts
// once it has one; until then the streak still stands on last week's.
export function streakWeeks(trainedDates, today) {
  const weeks = new Set(trainedDates.map(weekStartOf))
  let w = weekStartOf(today), n = 0
  if (!weeks.has(w)) w = addDays(w, -7)
  while (weeks.has(w)) { n++; w = addDays(w, -7) }
  return n
}

// Workouts per week for the last `n` weeks, oldest first, this week last.
export function weeklyCounts(trainedDates, today, n = 8) {
  const start = weekStartOf(today)
  const counts = Array.from({ length: n }, (_, k) => ({ start: addDays(start, -7 * (n - 1 - k)), count: 0 }))
  for (const d of trainedDates) {
    const i = counts.findIndex(c => c.start === weekStartOf(d))
    if (i >= 0) counts[i].count++
  }
  return counts
}

// Kilograms moved: weight × reps over the sets given.
export const volumeOf = sets => Math.round(sets.reduce((v, s) => v + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0))

// The routine to do next when there is no coach's session: the one trained longest ago (never
// trained first), so a split rotates on its own.
export function nextOwn(mine, lastDone) {
  if (!mine.length) return null
  return [...mine].sort((a, b) => (lastDone[a.id] || '').localeCompare(lastDone[b.id] || '') || a.position - b.position)[0]
}
