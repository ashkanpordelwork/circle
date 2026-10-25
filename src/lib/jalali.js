// The Persian (Jalali) calendar, for picking and showing dates. Dates travel through the app as
// ISO strings ('2026-10-23'); these turn them into Jalali year/month/day and back.
// Conversion: the classic arithmetic (jdf) — checked day by day against Intl in jalali.test.js.

export const J_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

export function toJalali(gy, gm, gd) {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const gy2 = gm > 2 ? gy + 1 : gy
  let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + gdm[gm - 1]
  let jy = -1595 + 33 * Math.floor(days / 12053)
  days %= 12053
  jy += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365 }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30)
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30)
  return [jy, jm, jd]
}

export function toGregorian(jy, jm, jd) {
  jy += 1595
  let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186)
  let gy = 400 * Math.floor(days / 146097)
  days %= 146097
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++ }
  gy += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365 }
  let gd = days + 1
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0
  const ml = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 0
  while (gm < 13 && gd > ml[gm]) gd -= ml[gm++]
  return [gy, gm, gd]
}

const pad = n => String(n).padStart(2, '0')
const isoOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
export const isoToJ = iso => { const [y, m, d] = iso.split('-').map(Number); return toJalali(y, m, d) }
export const jToIso = (jy, jm, jd) => isoOf(...toGregorian(jy, jm, jd))

export function monthLength(jy, jm) {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  // Esfand has 30 days in a leap year: the day after 30 Esfand is still in the same year.
  return isoToJ(jToIso(jy, 12, 30))[0] === jy ? 30 : 29
}

// Days after an ISO date (negative for before), in local calendar days.
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}
export const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)

// Saturday = 0 … Friday = 6: the column of a date in a Persian calendar.
export const weekdaySat = iso => (new Date(iso + 'T12:00:00Z').getUTCDay() + 1) % 7

const fa = n => Number(n).toLocaleString('fa-IR', { useGrouping: false })
// «۱ آبان ۱۴۰۵», or without the year.
export const fmtJ = (iso, year = true) => { const [y, m, d] = isoToJ(iso); return `${fa(d)} ${J_MONTHS[m - 1]}${year ? ' ' + fa(y) : ''}` }
// «۱ تا ۲۸ آبان ۱۴۰۵» / «۲۵ آبان تا ۲۲ آذر ۱۴۰۵» / across a new year, both years.
export function fmtRange(a, b) {
  const [ya, ma] = isoToJ(a), [yb, mb] = isoToJ(b)
  if (ya !== yb) return `${fmtJ(a)} تا ${fmtJ(b)}`
  if (ma !== mb) return `${fmtJ(a, false)} تا ${fmtJ(b)}`
  return `${fa(isoToJ(a)[2])} تا ${fmtJ(b)}`
}

// The cells of a month view starting on Saturday: blanks, then one ISO date per day.
export function monthGrid(jy, jm) {
  const first = jToIso(jy, jm, 1)
  const cells = Array(weekdaySat(first)).fill(null)
  for (let d = 0; d < monthLength(jy, jm); d++) cells.push(addDays(first, d))
  return cells
}
