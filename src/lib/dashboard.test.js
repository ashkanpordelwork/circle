import { describe, it, expect } from 'vitest'
import { overview, isoMinus, daysBetween } from './dashboard.js'

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
  it('counts, the week by day, adherence and who went quiet', () => {
    const o = overview({ students, workouts, routines, today })
    expect(o.total).toBe(4)
    expect(o.live).toBe(2)
    expect(o.pending).toBe(1)
    expect(o.week).toBe(2)
    expect(o.month).toBe(4)
    expect(o.activeThisWeek).toBe(1)
    expect(o.perDay.map(d => d.count)).toEqual([0, 0, 0, 0, 1, 0, 1])
    // last 7 days: Ali's Sun/Tue/Thu → 3 planned (Mon 19 … Sun 25 holds Tue 20, Thu 22, Sun 25), Sara's Sat → 1
    expect(o.adherence).toBeCloseTo(2 / 4)
    expect(o.idle.map(x => [x.student.id, x.days])).toEqual([['b', 12]])
    expect(o.recent[0].id).toBe(1)
  })
})
