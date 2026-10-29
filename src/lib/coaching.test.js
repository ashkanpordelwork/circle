import { describe, it, expect } from 'vitest'
import { capacityOf, planNow } from './coaching.js'

describe('coach plans', () => {
  const today = '2026-10-29'
  it('gives each plan its room', () => {
    expect(capacityOf({ plan: 'free' }, today)).toBe(10)
    expect(capacityOf({ plan: 'pro' }, today)).toBe(30)
    expect(capacityOf({ plan: 'studio' }, today)).toBeNull()
  })
  it('falls back to free once a granted plan has lapsed', () => {
    expect(capacityOf({ plan: 'pro', plan_until: '2026-10-28' }, today)).toBe(10)
    expect(capacityOf({ plan: 'pro', plan_until: '2026-10-29' }, today)).toBe(30)
    expect(planNow({ plan: 'studio', plan_until: '2026-01-01' }, today)).toBe('free')
  })
})
