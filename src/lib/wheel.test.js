import { describe, it, expect } from 'vitest'
import { range, nearest, splitWeight, joinWeight, parseReps, joinReps } from './wheel.js'

describe('number wheels', () => {
  it('ranges and nearest values', () => {
    expect(range(0, 1, 0.25)).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(nearest(range(0, 600, 15), 100)).toBe(105)
    expect(nearest([1, 2], '')).toBe(null)
  })
  it('weights split into whole kilos and a fraction, and join back', () => {
    const f = [0, 0.25, 0.5, 0.75]
    expect(splitWeight(62.5, f)).toEqual([62, 0.5])
    expect(splitWeight('۷۸٫۷۵', f)).toEqual([78, 0.75])
    expect(splitWeight('', f)).toEqual([null, 0])
    expect(joinWeight(62, 0.5)).toBe(62.5)
  })
  it('planned reps: a number or a range', () => {
    expect(parseReps('8-12')).toEqual([8, 12])
    expect(parseReps('10')).toEqual([10, null])
    expect(parseReps('۸-۱۰'.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))).toEqual([8, 10])
    expect(joinReps(8, 12)).toBe('8-12')
    expect(joinReps(10, null)).toBe('10')
    expect(joinReps(10, 8)).toBe('10')
  })
})
