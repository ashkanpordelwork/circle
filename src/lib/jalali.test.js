import { describe, it, expect } from 'vitest'
import { toJalali, toGregorian, isoToJ, jToIso, monthLength, addDays, daysBetween, weekdaySat, fmtJ, fmtRange, monthGrid } from './jalali.js'

const intl = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' })
const viaIntl = iso => {
  const p = Object.fromEntries(intl.formatToParts(new Date(iso + 'T12:00:00Z')).map(x => [x.type, x.value]))
  return [parseInt(p.year), parseInt(p.month), parseInt(p.day)]
}

describe('jalali', () => {
  it('matches the browser\'s Persian calendar every day for fifteen years, both ways', () => {
    let iso = '2020-01-01'
    for (let i = 0; i < 365 * 15; i++, iso = addDays(iso, 1)) {
      const j = isoToJ(iso)
      expect(j, iso).toEqual(viaIntl(iso))
      expect(jToIso(...j), iso).toBe(iso)
    }
  })
  it('known dates', () => {
    expect(toJalali(2026, 3, 21)).toEqual([1405, 1, 1])
    expect(toGregorian(1405, 8, 1)).toEqual([2026, 10, 23])
    expect(monthLength(1405, 1)).toBe(31)
    expect(monthLength(1405, 8)).toBe(30)
    expect([monthLength(1403, 12), monthLength(1404, 12)]).toEqual([30, 29])   // 1403 was a leap year
  })
  it('days and weekdays', () => {
    expect(addDays('2026-10-23', 27)).toBe('2026-11-19')
    expect(daysBetween('2026-10-23', '2026-11-19')).toBe(27)
    expect(weekdaySat('2026-10-24')).toBe(0)   // a Saturday
    expect(weekdaySat('2026-10-23')).toBe(6)   // a Friday
  })
  it('in words, and a month laid out from Saturday', () => {
    expect(fmtJ('2026-10-23')).toBe('۱ آبان ۱۴۰۵')
    expect(fmtRange('2026-10-23', '2026-11-19')).toBe('۱ تا ۲۸ آبان ۱۴۰۵')
    expect(fmtRange('2026-11-15', '2026-12-12')).toBe('۲۴ آبان تا ۲۱ آذر ۱۴۰۵')
    expect(fmtRange('2026-10-23', '2026-10-30')).toBe('۱ تا ۸ آبان ۱۴۰۵')
    const g = monthGrid(1405, 8)
    expect(g.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-10-23'])
    expect(g.filter(Boolean)).toHaveLength(30)
  })
})
