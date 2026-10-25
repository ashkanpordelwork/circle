import { describe, expect, it } from 'vitest'
import { normPhone, isPhone, phoneEmail, phoneOfEmail, fmtPhone, normCode } from './phone.js'

describe('phone helpers (must match phone_norm in 0002_phone_login.sql)', () => {
  it('normalises the ways people type a number', () => {
    for (const p of ['۰۹۱۲ ۱۲۳ ۴۵۶۷', '+98 912 123 4567', '00989121234567', '9121234567', '0912-123-4567'])
      expect(normPhone(p)).toBe('09121234567')
  })
  it('isPhone', () => {
    expect(isPhone('09121234567')).toBe(true)
    expect(isPhone('0912123')).toBe(false)
    expect(isPhone('')).toBe(false)
  })
  it('stand-in address both ways', () => {
    expect(phoneEmail('+989121234567')).toBe('09121234567@phone.invalid')
    expect(phoneOfEmail('09121234567@phone.invalid')).toBe('09121234567')
    expect(phoneOfEmail('a@gmail.com')).toBe(null)
  })
  it('fmtPhone and normCode', () => {
    expect(fmtPhone('09121234567')).toBe('0912 123 4567')
    expect(normCode(' abc۲۳۴ ')).toBe('ABC234')
  })
})
