import { describe, it, expect } from 'vitest'
import { readinessScore, readinessAdvice, readinessTone, measureSummary } from './body.js'

describe('readiness', () => {
  it('scores 0 to 100 from four answers', () => {
    expect(readinessScore({ sleep: 5, energy: 5, soreness: 5, stress: 5 })).toBe(100)
    expect(readinessScore({ sleep: 1, energy: 1, soreness: 1, stress: 1 })).toBe(0)
    expect(readinessScore({ sleep: 4, energy: 3, soreness: 2, stress: 4 })).toBe(56)
    expect(readinessScore({ sleep: 4, energy: 3 })).toBeNull()
    expect(readinessScore(null)).toBeNull()
  })
  it('turns the score into a sentence and a tone', () => {
    expect(readinessAdvice(80)).toMatch(/رکورد/)
    expect(readinessAdvice(20)).toMatch(/استراحت/)
    expect([readinessTone(90), readinessTone(60), readinessTone(40), readinessTone(10)]).toEqual(['good', '', 'warn', 'bad'])
  })
})

describe('measurements', () => {
  it('takes each measure\'s latest value and its change, skipping blank dates', () => {
    const s = measureSummary([
      { date: '2026-10-20', waist: '84.0', arm: 35 },
      { date: '2026-10-01', waist: 86, arm: null },
      { date: '2026-10-27', waist: null, arm: 35.5 }])
    expect(s.waist).toMatchObject({ last: { date: '2026-10-20', y: 84 }, prev: { date: '2026-10-01', y: 86 }, change: -2 })
    expect(s.arm).toMatchObject({ last: { y: 35.5 }, change: 0.5 })
    expect(s.neck).toEqual({ last: null, prev: null, change: null, points: [] })
  })
})
