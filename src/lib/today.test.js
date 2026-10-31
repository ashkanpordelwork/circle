import { describe, it, expect } from 'vitest'
import { ownSession, macroProgress, totalsOf, mealLog, minutesOf, dosesOf, reminders } from './today.js'

const r = (id, position, days = [], n = 3) => ({ id, position, days, items: Array.from({ length: n }, () => ({})) })
const TODAY = '2026-10-31'   // a Saturday: getDay() 6

describe('today\'s session', () => {
  it('follows the weekdays when the routines have them', () => {
    const mine = [r('a', 0, [6]), r('b', 1, [1]), r('c', 2, [3])]
    expect(ownSession(mine, 6, {}, TODAY)).toMatchObject({ r: { id: 'a' }, kind: 'today', done: false })
    expect(ownSession(mine, 6, { a: TODAY }, TODAY)).toMatchObject({ r: { id: 'a' }, kind: 'today', done: true })
    expect(ownSession(mine, 0, {}, TODAY)).toMatchObject({ r: { id: 'b' }, kind: 'rest', day: 1 })   // Sunday: rest, Monday next
  })
  it('goes in order without weekdays: the one after the last trained, round and round', () => {
    const mine = [r('a', 0), r('b', 1), r('c', 2)]
    expect(ownSession(mine, 6, {}, TODAY)).toMatchObject({ r: { id: 'a' }, kind: 'next' })
    expect(ownSession(mine, 6, { a: '2026-10-28', b: '2026-10-30' }, TODAY)).toMatchObject({ r: { id: 'c' }, kind: 'next' })
    expect(ownSession(mine, 6, { c: '2026-10-30' }, TODAY)).toMatchObject({ r: { id: 'a' } })
    expect(ownSession(mine, 6, { b: TODAY }, TODAY)).toMatchObject({ r: { id: 'b' }, done: true })
  })
  it('skips empty routines, and has nothing without any', () => {
    expect(ownSession([r('a', 0, [], 0), r('b', 1)], 6, {}, TODAY).r.id).toBe('b')
    expect(ownSession([], 6, {}, TODAY)).toBeNull()
  })
})

describe('food today', () => {
  const targets = { calories: 2800, protein: 180, carbs: 320, fat: 80 }
  it('adds up what was eaten and what is left', () => {
    const p = macroProgress(targets, [{ calories: 480, protein: 31, carbs: 40, fat: 23 }, { calories: '150', protein: '25.4', carbs: 5, fat: 0 }])
    expect(p.protein).toEqual({ eaten: 56, target: 180, left: 124, share: 56 / 180, over: false })
    expect(p.calories.left).toBe(2170)
  })
  it('never shows less than nothing left', () => {
    const p = macroProgress({ ...targets, fat: 20 }, [{ fat: 30 }])
    expect(p.fat).toMatchObject({ left: 0, share: 1, over: true })
  })
  it('has no progress without targets', () => {
    expect(macroProgress(null, [{ protein: 10 }]).protein).toMatchObject({ eaten: 10, target: 0, share: 0 })
    expect(totalsOf([])).toEqual({ protein: 0, calories: 0, carbs: 0, fat: 0 })
  })
  it('logs a planned meal with its own copy of the macros', () => {
    expect(mealLog({ id: 'm1', name: 'صبحانه', calories: '480.0', protein: '31.0', carbs: '40.0', fat: '23.0' }, 's1', TODAY))
      .toEqual({ student_id: 's1', date: TODAY, meal_id: 'm1', name: 'صبحانه', calories: 480, protein: 31, carbs: 40, fat: 23 })
  })
})

describe('supplements today', () => {
  it('reads clock times in either digits, and the usual words', () => {
    expect(minutesOf('08:00')).toBe(480)
    expect(minutesOf('۲۲:۳۰')).toBe(1350)
    expect(minutesOf('صبح')).toBe(480)
    expect(minutesOf('ناهار')).toBe(780)
    expect(minutesOf('قبل از خواب')).toBe(1350)
    expect(minutesOf('بعد از تمرین')).toBeNull()
    expect(minutesOf('هر وقت')).toBeNull()
  })
  const sups = [
    { id: 'c', name: 'کراتین', dose: '۵ گرم', times: ['بعد از تمرین'], position: 0 },
    { id: 'd', name: 'ویتامین D', dose: '۱۰۰۰ واحد', times: ['08:00'], position: 1 },
    { id: 'o', name: 'امگا ۳', dose: '۱ عدد', times: ['ناهار', 'شام'], position: 2 },
    { id: 'z', name: 'زینک', dose: '', times: [], position: 3 }
  ]
  it('lists every dose in the order of the day, due once its time has come', () => {
    const d = dosesOf(sups, [{ supplement_id: 'd', time: '08:00' }], 14 * 60, false)
    expect(d.map(x => x.key)).toEqual(['z|', 'd|08:00', 'o|ناهار', 'c|بعد از تمرین', 'o|شام'])
    expect(d.find(x => x.key === 'd|08:00')).toMatchObject({ taken: true, due: false })
    expect(d.find(x => x.key === 'o|ناهار').due).toBe(true)
    expect(d.find(x => x.key === 'o|شام').due).toBe(false)
    expect(d.find(x => x.key === 'z|').due).toBe(true)              // no time: due all day
  })
  it('makes the after-workout dose due once the workout is logged', () => {
    expect(dosesOf(sups, [], 600, false).find(x => x.key === 'c|بعد از تمرین').due).toBe(false)
    expect(dosesOf(sups, [], 600, true).find(x => x.key === 'c|بعد از تمرین').due).toBe(true)
  })
  it('turns the doses still to come into reminders', () => {
    const now = new Date(2026, 9, 31, 12, 0)
    const rs = reminders(dosesOf(sups, [], 720, false), now)
    expect(rs.map(x => x.key)).toEqual(['o|ناهار', 'o|شام'])
    expect(rs[0]).toMatchObject({ title: 'وقت امگا ۳', body: '۱ عدد · ناهار', at: new Date(2026, 9, 31, 13, 0).getTime() })
  })
})
