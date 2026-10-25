import { describe, it, expect } from 'vitest'
import { toggle, stepDone, complete, clean, ageNow, bmi, profile, alertLine } from './intake.js'

const full = {
  sex: 'male', age: 30, height: 180, weight: 81, answered_year: 2026,
  goals: ['muscle'], experience: 'lt6m', days: 3,
  injuries: ['knee', 'back'], injuries_note: 'زانوی چپ',
  conditions: ['none'], conditions_note: 'قرص فشار نمی‌خورم', diet: ['lactose']
}

describe('toggle', () => {
  it('adds and removes', () => {
    expect(toggle([], 'knee')).toEqual(['knee'])
    expect(toggle(['knee', 'back'], 'knee')).toEqual(['back'])
  })
  it('«none» excludes the rest, both ways', () => {
    expect(toggle(['knee', 'back'], 'none')).toEqual(['none'])
    expect(toggle(['none'], 'knee')).toEqual(['knee'])
  })
})

describe('stepDone / complete', () => {
  it('needs every body field', () => {
    expect(stepDone('body', { sex: 'male', age: 30, height: 180 })).toBe(false)
    expect(stepDone('body', full)).toBe(true)
  })
  it('needs experience and days', () => {
    expect(stepDone('experience', { experience: 'none' })).toBe(false)
    expect(stepDone('experience', full)).toBe(true)
  })
  it('a list question needs at least one answer («ندارم» counts)', () => {
    expect(stepDone('injuries', { injuries: [] })).toBe(false)
    expect(stepDone('injuries', { injuries: ['none'] })).toBe(true)
  })
  it('complete only when all steps are', () => {
    expect(complete(full)).toBe(true)
    expect(complete({ ...full, diet: [] })).toBe(false)
  })
})

describe('clean', () => {
  it('drops unknown keys, bad numbers and empty notes', () => {
    const c = clean({ ...full, goals: ['muscle', 'hack'], age: 500, evil: 1, goals_note: '   ' })
    expect(c.goals).toEqual(['muscle'])
    expect(c.age).toBeUndefined()
    expect(c.evil).toBeUndefined()
    expect(c.goals_note).toBeUndefined()
    expect(c.injuries_note).toBe('زانوی چپ')
  })
})

describe('body numbers', () => {
  it('age grows with the calendar', () => {
    expect(ageNow(full, 2026)).toBe(30)
    expect(ageNow(full, 2028)).toBe(32)
  })
  it('bmi with a band', () => {
    expect(bmi(full)).toEqual({ value: 25, band: 'اضافه وزن', ok: false })
    expect(bmi({ height: 180, weight: 70 }).band).toBe('نرمال')
    expect(bmi({ height: 180 })).toBeNull()
  })
})

describe('profile', () => {
  it('puts injuries first and keeps a note under «ندارم»', () => {
    const p = profile(full, 2026)
    expect(p.alerts).toHaveLength(1)
    expect(p.alerts[0]).toMatchObject({ kind: 'injury', items: ['زانو', 'کمر'], note: 'زانوی چپ' })
    expect(p.conditionsNote).toBe('قرص فشار نمی‌خورم')
    expect(p.goals).toEqual(['عضله‌سازی'])
    expect(p.diet).toEqual(['عدم تحمل لاکتوز'])
    expect(alertLine(p)).toBe('زانو، کمر')
  })
  it('no alerts when the student has none', () => {
    const p = profile({ ...full, injuries: ['none'] })
    expect(p.alerts).toEqual([])
    expect(alertLine(p)).toBe('')
  })
  it('null when not filled', () => { expect(profile(null)).toBeNull() })
})
