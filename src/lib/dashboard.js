// The coach's overview, computed from plain rows so it can be tested.
//   students  [{ id, full_name, user_id, active }]
//   workouts  [{ id, student_id, routine_name, date: 'YYYY-MM-DD', sets? }]   (any recent window)
//   routines  [{ student_id, days: [getDay numbers] }]
//   today     'YYYY-MM-DD'
const DAY = 86400000
const toDate = iso => new Date(iso + 'T12:00:00')
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY)
export const isoMinus = (iso, n) => {
  const d = new Date(toDate(iso) - n * DAY)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The Persian week runs Saturday to Friday; this is the Saturday on or before `iso`.
export const weekStart = iso => isoMinus(iso, (toDate(iso).getDay() + 1) % 7)

export function overview({ students, workouts, routines, today }) {
  const live = students.filter(s => s.active && s.user_id)
  const liveIds = new Set(live.map(s => s.id))
  // This calendar week, Saturday → Friday; days after today are still to come.
  const sat = weekStart(today)
  const weekDays = Array.from({ length: 7 }, (_, i) => isoMinus(sat, -i))
  const soFar = weekDays.filter(d => d <= today)
  const week = workouts.filter(w => w.date >= sat && w.date <= today)
  const month = workouts.filter(w => daysBetween(w.date, today) >= 0 && daysBetween(w.date, today) < 30)
  const perDay = weekDays.map(d => ({ date: d, count: week.filter(w => w.date === d).length, future: d > today }))

  // Planned sessions so far this week for students who can train, against the ones done.
  let planned = 0
  for (const s of live) {
    const rs = routines.filter(r => r.student_id === s.id)
    for (const d of soFar) planned += rs.filter(r => (r.days || []).includes(toDate(d).getDay())).length
  }
  const doneLive = week.filter(w => liveIds.has(w.student_id)).length
  const adherence = planned ? Math.min(1, doneLive / planned) : null

  const lastBy = {}
  for (const w of workouts) if (!lastBy[w.student_id] || w.date > lastBy[w.student_id]) lastBy[w.student_id] = w.date
  // Who has gone quiet: a week or more without a workout (or none ever), longest first.
  const idle = live
    .map(s => ({ student: s, last: lastBy[s.id] || null, days: lastBy[s.id] ? daysBetween(lastBy[s.id], today) : null }))
    .filter(x => x.days == null || x.days >= 7)
    .sort((a, b) => (b.days ?? 1e9) - (a.days ?? 1e9))

  const recent = [...workouts].sort((a, b) => (b.date + (b.created_at || '')).localeCompare(a.date + (a.created_at || ''))).slice(0, 6)
  return {
    total: students.length,
    live: live.length,
    pending: students.filter(s => s.active && !s.user_id).length,
    activeThisWeek: new Set(week.map(w => w.student_id)).size,
    week: week.length,
    month: month.length,
    perDay,
    adherence,
    idle,
    recent
  }
}
