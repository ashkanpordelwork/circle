// The coach's overview, computed from plain rows so it can be tested.
//   students  [{ id, full_name, user_id, active }]
//   workouts  [{ id, student_id, routine_name, date: 'YYYY-MM-DD', sets? }]   (any recent window)
//   routines  [{ student_id, name, days: [getDay numbers] }]
//   today     'YYYY-MM-DD'
import { pickPrograms, weekOf, weekRange, programEnd } from './program.js'
import { daysBetween as jDays } from './jalali.js'

const DAY = 86400000
const toDate = iso => new Date(iso + 'T12:00:00')
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY)
export const isoMinus = (iso, n) => {
  const d = new Date(toDate(iso) - n * DAY)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The Persian week runs Saturday to Friday; this is the Saturday on or before `iso`.
export const weekStart = iso => isoMinus(iso, (toDate(iso).getDay() + 1) % 7)

// One student on a monthly program (0006_programs.sql), this program week: its sessions are done in
// order on any day, so a session is late only once the days left can no longer fit what remains.
function programWeek(s, programs, routines, workouts, today) {
  const mine = programs.filter(p => p.student_id === s.id)
  const { current, next } = pickPrograms(mine, today)
  if (!current) return { status: next ? 'waiting' : 'ended', sessions: [], done: 0, planned: 0, due: 0, missed: [], today: [], program: { next } }
  const week = weekOf(current, today)
  const [a, b] = weekRange(current, week)
  const list = routines.filter(r => r.program_id === current.id && r.week === week).sort((x, y) => x.session - y.session)
  const done = workouts.filter(w => w.student_id === s.id && w.date >= a && w.date <= today).length
  const daysLeft = jDays(today, b) + 1
  const remaining = Math.max(0, list.length - done)
  const late = Math.max(0, remaining - daysLeft)
  const sessions = list.map((r, k) => ({ name: r.name, state: k < done ? 'done' : k >= list.length - late ? 'missed' : 'upcoming' }))
  const ending = jDays(today, programEnd(current)) < 7 && !next
  const status = !list.length ? 'unwritten' : late ? 'behind' : remaining === 0 ? 'done' : 'ontrack'
  return { status, sessions, done: Math.min(done, list.length), planned: list.length, due: Math.max(0, list.length - (daysLeft - 1)),
    missed: sessions.filter(x => x.state === 'missed').map(x => x.name), today: [], program: { week, weeks: current.weeks, daysLeft, remaining, ending } }
}

export function overview({ students, workouts, routines, programs = [], today }) {
  const live = students.filter(s => s.active && s.user_id)
  const liveIds = new Set(live.map(s => s.id))
  // This calendar week, Saturday → Friday; days after today are still to come.
  const sat = weekStart(today)
  const weekDays = Array.from({ length: 7 }, (_, i) => isoMinus(sat, -i))
  const soFar = weekDays.filter(d => d <= today)
  const week = workouts.filter(w => w.date >= sat && w.date <= today)
  const month = workouts.filter(w => daysBetween(w.date, today) >= 0 && daysBetween(w.date, today) < 30)

  // Planned sessions so far this week for students who can train, against the ones done.
  const onProgram = new Set(programs.map(p => p.student_id))
  let planned = 0, doneLive = 0
  for (const s of live) {
    if (onProgram.has(s.id)) continue
    const rs = routines.filter(r => r.student_id === s.id && !r.program_id)
    for (const d of soFar) planned += rs.filter(r => (r.days || []).includes(toDate(d).getDay())).length
    doneLive += week.filter(w => w.student_id === s.id).length
  }

  const lastBy = {}
  for (const w of workouts) if (!lastBy[w.student_id] || w.date > lastBy[w.student_id]) lastBy[w.student_id] = w.date
  // Who has gone quiet: a week or more without a workout (or none ever), longest first.
  const idle = live
    .map(s => ({ student: s, last: lastBy[s.id] || null, days: lastBy[s.id] ? daysBetween(lastBy[s.id], today) : null }))
    .filter(x => x.days == null || x.days >= 7)
    .sort((a, b) => (b.days ?? 1e9) - (a.days ?? 1e9))

  // This week, student by student: every planned session in day order, with the workouts done so
  // far crediting the earliest ones. A session before today with no credit was missed.
  const board = live.map(s => {
    if (onProgram.has(s.id)) {
      const x = programWeek(s, programs, routines, workouts, today)
      planned += x.due; doneLive += Math.min(x.done, x.due)
      return { student: s, idleDays: lastBy[s.id] ? daysBetween(lastBy[s.id], today) : null, ...x }
    }
    const rs = routines.filter(r => r.student_id === s.id && !r.program_id)
    const sessions = []
    for (const d of weekDays) for (const r of rs) if ((r.days || []).includes(toDate(d).getDay())) sessions.push({ date: d, name: r.name || '' })
    let credit = week.filter(w => w.student_id === s.id).length
    const done = credit
    for (const x of sessions) {
      if (credit > 0) { x.state = 'done'; credit-- }
      else x.state = x.date < today ? 'missed' : x.date === today ? 'today' : 'upcoming'
    }
    const missed = sessions.filter(x => x.state === 'missed')
    const idleDays = lastBy[s.id] ? daysBetween(lastBy[s.id], today) : null
    const status = !rs.length ? 'noplan' : missed.length ? 'behind' : (idleDays == null || idleDays >= 7) && sessions.some(x => x.state !== 'done') ? 'idle'
      : sessions.some(x => x.state === 'today') ? 'today' : sessions.every(x => x.state === 'done') ? 'done' : 'ontrack'
    return { student: s, status, sessions, done, planned: sessions.length, missed: missed.map(x => x.date), today: sessions.filter(x => x.state === 'today').map(x => x.name), idleDays }
  })
  const adherence = planned ? Math.min(1, doneLive / planned) : null
  const rank = { behind: 0, unwritten: 1, ended: 2, noplan: 3, idle: 4, today: 5, ontrack: 6, waiting: 7, done: 8 }
  board.sort((a, b) => rank[a.status] - rank[b.status] || b.missed.length - a.missed.length || (b.idleDays ?? 1e9) - (a.idleDays ?? 1e9))
  const sessions = board.flatMap(x => x.sessions)

  const recent = [...workouts].sort((a, b) => (b.date + (b.created_at || '')).localeCompare(a.date + (a.created_at || ''))).slice(0, 6)
  return {
    total: students.length,
    live: live.length,
    pending: students.filter(s => s.active && !s.user_id).length,
    activeThisWeek: new Set(week.map(w => w.student_id)).size,
    week: week.length,
    month: month.length,
    adherence,
    board,
    sessionsDone: sessions.filter(x => x.state === 'done').length,
    sessionsPlanned: sessions.length,
    behind: board.filter(x => x.status === 'behind').length,
    idle,
    recent
  }
}
