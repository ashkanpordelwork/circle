import { describe as group, it, expect } from 'vitest'
import { rolesOf, nameOf, filterUsers, ago, describe, byDay, inGroup, faPhone } from './admin.js'

const users = [
  { id: '1', phone: '09121111111', is_admin: true, coach_active: true, coach_name: 'اشکان', coach_students: 3 },
  { id: '2', phone: '09352222222', student_id: 's2', student_name: 'علی رضایی', student_coach: 'اشکان' },
  { id: '3', phone: '09125556666', coach_active: false, coach_name: '' },
  { id: '4', phone: '09127778888' }
]

group('admin', () => {
  it('roles and names', () => {
    expect(users.map(rolesOf)).toEqual([['admin', 'coach'], ['student'], ['coach_off'], ['none']])
    expect(users.map(nameOf)).toEqual(['اشکان', 'علی رضایی', '۰۹۱۲۵۵۵۶۶۶۶', '۰۹۱۲۷۷۷۸۸۸۸'])
    expect(faPhone('09121234567')).toBe('۰۹۱۲ ۱۲۳ ۴۵۶۷')
  })
  it('filters by role and searches names and numbers in either digits', () => {
    const ids = (f, q) => filterUsers(users, f, q).map(u => u.id)
    expect(ids('coach')).toEqual(['1', '3'])
    expect(ids('none')).toEqual(['4'])
    expect(ids('admin')).toEqual(['1'])
    expect(ids('all', 'علی')).toEqual(['2'])
    expect(ids('all', '۰۹۱۲ ۷۷۷')).toEqual(['4'])
    expect(ids('student', '0912')).toEqual([])
  })
  it('how long ago', () => {
    const now = Date.parse('2026-10-25T12:00:00Z')
    expect(ago(null, now)).toBe('هرگز')
    expect(ago('2026-10-25T11:59:30Z', now)).toBe('همین حالا')
    expect(ago('2026-10-25T09:00:00Z', now)).toBe('۳ ساعت پیش')
    expect(ago('2026-10-20T12:00:00Z', now)).toBe('۵ روز پیش')
  })
  it('the log in words, admin actions with the names they were about', () => {
    expect(describe({ kind: 'workout', who: 'علی', detail: 'پا', student_id: 's2' })).toMatchObject({ text: 'علی تمرین کرد: پا', to: '/s/s2' })
    expect(describe({ kind: 'admin:student_moved', who: 'اشکان', detail: '{"student":"s2","from":"c1","coach":"c2"}', student_id: 's2' },
      { s2: 'علی', c1: 'مربی یک', c2: 'مربی دو' }).text).toBe('اشکان: علی را از مربی یک به مربی دو منتقل کرد')
    expect(describe({ kind: 'admin:coach_granted', who: 'اشکان', detail: '{"phone":"09123334444"}' }).text).toBe('اشکان: دسترسی مربی داد به ۰۹۱۲۳۳۳۴۴۴۴')
    expect(inGroup({ kind: 'admin:user_deleted' }, 'admin')).toBe(true)
    expect(inGroup({ kind: 'login' }, 'training')).toBe(false)
  })
  it('groups by day', () => {
    const now = new Date('2026-10-25T12:00:00')
    const days = byDay([{ at: '2026-10-25T10:00:00' }, { at: '2026-10-25T08:00:00' }, { at: '2026-10-24T20:00:00' }, { at: '2026-10-20T20:00:00' }], now)
    expect(days.map(d => [d.label, d.items.length])).toEqual([['امروز', 2], ['دیروز', 1], [days[2].label, 1]])
    expect(days[2].label).toContain('مهر')
  })
})
