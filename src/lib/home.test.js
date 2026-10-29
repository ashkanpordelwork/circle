import { describe, it, expect } from 'vitest'
import { weekDays, streakWeeks, weeklyCounts, volumeOf, nextOwn, weekStartOf } from './home.js'

// 2026-10-29 is a Thursday; its week starts Saturday 2026-10-24.
const TODAY = '2026-10-29'

describe('the week on «امروز»', () => {
  it('runs Saturday to Friday and marks what was trained', () => {
    expect(weekStartOf(TODAY)).toBe('2026-10-24')
    const w = weekDays(TODAY, ['2026-10-25', '2026-10-29', '2026-10-20'])
    expect(w.map(d => d.date)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'])
    expect(w.filter(d => d.trained).map(d => d.date)).toEqual(['2026-10-25', '2026-10-29'])
    expect(w.find(d => d.today).date).toBe(TODAY)
    expect(w.filter(d => d.future).length).toBe(1)
  })
  it('counts the streak in weeks, and an empty week so far does not break it', () => {
    expect(streakWeeks(['2026-10-26', '2026-10-19', '2026-10-12'], TODAY)).toBe(3)
    expect(streakWeeks(['2026-10-19', '2026-10-12'], TODAY)).toBe(2)       // nothing yet this week
    expect(streakWeeks(['2026-10-26', '2026-10-05'], TODAY)).toBe(1)       // a gap ends it
    expect(streakWeeks([], TODAY)).toBe(0)
  })
  it('counts workouts per week, oldest first', () => {
    const c = weeklyCounts(['2026-10-25', '2026-10-27', '2026-10-18', '2026-08-01'], TODAY, 3)
    expect(c).toEqual([{ start: '2026-10-10', count: 0 }, { start: '2026-10-17', count: 1 }, { start: '2026-10-24', count: 2 }])
  })
  it('adds up the volume', () => {
    expect(volumeOf([{ weight: 60, reps: 5 }, { weight: '62.5', reps: 5 }, { weight: null, reps: 10 }])).toBe(613)
  })
  it('suggests the own routine trained longest ago', () => {
    const mine = [{ id: 'a', position: 1 }, { id: 'b', position: 2 }, { id: 'c', position: 3 }]
    expect(nextOwn(mine, { a: '2026-10-28', b: '2026-10-26', c: '2026-10-27' }).id).toBe('b')
    expect(nextOwn(mine, { a: '2026-10-28' }).id).toBe('b')
    expect(nextOwn([], {})).toBeNull()
  })
})
