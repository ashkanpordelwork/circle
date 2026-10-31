import { describe, it, expect } from 'vitest'
import { FEATURES, on } from './features.js'

describe('feature flags', () => {
  it('keep the athlete\'s app to the essentials: every extra is off', () => {
    expect(Object.keys(FEATURES).sort()).toEqual(['apply', 'body', 'coach', 'detailedStats', 'intake', 'water'])
    for (const k of Object.keys(FEATURES)) expect(on(k)).toBe(false)
  })
  it('reads a flag, and treats an unknown one as off', () => {
    expect(on('water', { water: true })).toBe(true)
    expect(on('nope')).toBe(false)
  })
})
