import { describe, it, expect } from 'vitest'
import { overview, isoMinus, daysBetween, weekStart } from './dashboard.js'

const today = '2026-10-25'   // a Sunday (getDay 0)
const students = [
  { id: 'a', full_name: 'علی', user_id: 'u1', active: true },
  { id: 'b', full_name: 'سارا', user_id: 'u2', active: true },
  { id: 'c', full_name: 'رضا', user_id: null, active: true },      // invited, not signed up
  { id: 'd', full_name: 'مینا', user_id: 'u4', active: false }     // paused
]
const routines = [{ student_id: 'a', days: [0, 2, 4] }, { student_id: 'b', days: [6] }]
const workouts = [
  { id: 1, student_id: 'a', routine_name: 'پا', date: today },
  { id: 2, student_id: 'a', routine_name: 'سینه', date: isoMinus(today, 2) },
  { id: 3, student_id: 'b', routine_name: 'کل بدن', date: isoMinus(today, 12) },
  { id: 4, student_id: 'a', routine_name: 'پشت', date: isoMinus(today, 20) }
]

describe('coach dashboard', () => {
  it('date helpers', () => {
    expect(isoMinus(today, 1)).toBe('2026-10-24')
    expect(daysBetween('2026-10-20', today)).toBe(5)
  })
  it('the week starts on Saturday', () => {
    expect(weekStart('2026-10-24')).toBe('2026-10-24')   // Saturday itself
    expect(weekStart(today)).toBe('2026-10-24')          // Sunday
    expect(weekStart('2026-10-30')).toBe('2026-10-24')   // Friday
    expect(weekStart('2026-10-31')).toBe('2026-10-31')   // next Saturday
  })
  it('counts, adherence and who went quiet', () => {
    const o = overview({ students, workouts, routines, today })
    expect(o.total).toBe(4)
    expect(o.live).toBe(2)
    expect(o.pending).toBe(1)
    expect(o.week).toBe(1)
    expect(o.month).toBe(4)
    expect(o.activeThisWeek).toBe(1)
    // so far: Ali's Sunday and Sara's Saturday are planned, Ali's Sunday is done
    expect(o.adherence).toBeCloseTo(1 / 2)
    expect(o.idle.map(x => [x.student.id, x.days])).toEqual([['b', 12]])
    expect(o.recent[0].id).toBe(1)
  })
  it('this week, student by student: who is behind comes first', () => {
    const rs = [{ student_id: 'a', name: 'پا', days: [0, 2, 4] }, { student_id: 'b', name: 'کل بدن', days: [6] }]
    const o = overview({ students, workouts, routines: rs, today })
    expect(o.board.map(x => [x.student.id, x.status])).toEqual([['b', 'behind'], ['a', 'ontrack']])
    const [sara, ali] = o.board
    expect(sara.missed).toEqual(['2026-10-24'])
    expect(ali.sessions.map(x => x.state)).toEqual(['done', 'upcoming', 'upcoming'])
    expect([o.sessionsDone, o.sessionsPlanned, o.behind]).toEqual([1, 4, 1])
  })
  it('a session due today, no plan at all, and a quiet student whose sessions are still ahead', () => {
    const ss = [{ id: 'a', full_name: 'علی', user_id: 'u1', active: true }, { id: 'e', full_name: 'نیما', user_id: 'u5', active: true }, { id: 'f', full_name: 'لیلا', user_id: 'u6', active: true }]
    const rs = [{ student_id: 'a', name: 'سینه', days: [0] }, { student_id: 'f', name: 'پا', days: [3] }]
    const o = overview({ students: ss, workouts: [{ id: 9, student_id: 'f', date: isoMinus(today, 15) }, { id: 8, student_id: 'a', date: isoMinus(today, 3) }], routines: rs, today })
    expect(o.board.map(x => [x.student.id, x.status])).toEqual([['e', 'noplan'], ['f', 'idle'], ['a', 'today']])
    expect(o.board[2].today).toEqual(['سینه'])
    expect(o.board[1].idleDays).toBe(15)
  })
  it('students on a monthly program: by what is left of their program week', () => {
    const ss = [1, 2, 3, 4].map(n => ({ id: 's' + n, full_name: 'ش' + n, user_id: 'u' + n, active: true }))
    // today is Sunday 25 Oct; programs started Friday 23 Oct, so week 1 runs to Thursday 29 Oct (5 days left)
    const prog = id => ({ id: 'p' + id, student_id: 's' + id, start_date: '2026-10-23', weeks: 4, per_week: 3 })
    const sess = (id, n) => Array.from({ length: n }, (_, k) => ({ id: `r${id}${k}`, student_id: 's' + id, program_id: 'p' + id, week: 1, session: k + 1, name: 'جلسه' }))
    const programs = [prog(1), prog(2), prog(3), { id: 'p4', student_id: 's4', start_date: '2026-08-01', weeks: 4, per_week: 3 }]
    const routines = [...sess(1, 3), ...sess(2, 7)]
    const workouts = [{ id: 1, student_id: 's1', date: '2026-10-24' }]
    const o = overview({ students: ss, workouts, routines, programs, today })
    const by = Object.fromEntries(o.board.map(x => [x.student.id, x]))
    expect([by.s1.status, by.s1.done, by.s1.planned, by.s1.program.daysLeft]).toEqual(['ontrack', 1, 3, 5])
    expect(by.s1.sessions.map(x => x.state)).toEqual(['done', 'upcoming', 'upcoming'])
    expect([by.s2.status, by.s2.sessions.filter(x => x.state === 'missed').length]).toEqual(['behind', 2])   // 7 left, 5 days
    expect(by.s3.status).toBe('unwritten')   // the week has no sessions yet
    expect(by.s4.status).toBe('ended')
    expect(o.board.map(x => x.student.id)).toEqual(['s2', 's3', 's4', 's1'])
  })
})
