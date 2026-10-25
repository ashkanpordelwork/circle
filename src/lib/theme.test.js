import { describe, it, expect } from 'vitest'
import { resolveTheme, getThemePref } from './theme.js'

describe('theme', () => {
  it('dark unless light is chosen, or auto on a phone set to light', () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
    expect(resolveTheme('auto', true)).toBe('light')
    expect(resolveTheme('auto', false)).toBe('dark')
    expect(resolveTheme(undefined, true)).toBe('dark')
  })
  it('defaults to dark when nothing is stored (or storage is unavailable)', () => {
    expect(getThemePref()).toBe('dark')
  })
})
