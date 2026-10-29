// The body beyond the scale: a readiness check-in before training, and tape measurements.

// Four questions, each answered 1–5 where 5 is good (for soreness and stress: none).
export const READINESS = [
  ['sleep', 'خواب', ['خیلی بد', 'بد', 'معمولی', 'خوب', 'عالی']],
  ['energy', 'انرژی', ['تمام', 'کم', 'معمولی', 'خوب', 'پر']],
  ['soreness', 'کوفتگی عضلات', ['خیلی زیاد', 'زیاد', 'کمی', 'کم', 'هیچ']],
  ['stress', 'استرس', ['خیلی زیاد', 'زیاد', 'کمی', 'کم', 'هیچ']]
]

// 0–100: the four answers averaged and stretched from 1–5.
export function readinessScore(c) {
  if (!c) return null
  const v = READINESS.map(([k]) => Number(c[k]))
  if (v.some(x => !(x >= 1 && x <= 5))) return null
  return Math.round(((v.reduce((a, b) => a + b, 0) / v.length - 1) / 4) * 100)
}

// What the score suggests for today's session, in a sentence.
export function readinessAdvice(score) {
  if (score == null) return ''
  if (score >= 75) return 'آماده‌ای؛ برای رکورد زدن روز خوبی است.'
  if (score >= 50) return 'روز معمولی؛ طبق برنامه پیش برو.'
  if (score >= 30) return 'کمی خسته‌ای؛ اگر ست‌ها سنگین شد، یک پله سبک‌تر بگیر.'
  return 'بدنت استراحت می‌خواهد؛ سبک تمرین کن یا امروز را استراحت کن.'
}
export const readinessTone = score => (score == null ? '' : score >= 75 ? 'good' : score >= 50 ? '' : score >= 30 ? 'warn' : 'bad')

// Tape measurements, in centimetres (body fat in percent).
export const MEASURES = [
  ['waist', 'دور کمر', 'سانتی‌متر'], ['chest', 'دور سینه', 'سانتی‌متر'], ['hips', 'دور باسن', 'سانتی‌متر'],
  ['arm', 'دور بازو', 'سانتی‌متر'], ['thigh', 'دور ران', 'سانتی‌متر'], ['neck', 'دور گردن', 'سانتی‌متر'],
  ['body_fat', 'چربی بدن', 'درصد']
]

// For each measure: the latest value, the one before, and every value oldest first.
// rows: [{ date, waist, chest, … }] in any order; a blank measure on a date is simply not taken.
export function measureSummary(rows) {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1))
  return Object.fromEntries(MEASURES.map(([k]) => {
    const pts = sorted.filter(r => r[k] != null && r[k] !== '').map(r => ({ date: r.date, y: Number(r[k]) }))
    const last = pts.at(-1) || null, prev = pts.at(-2) || null
    return [k, { last, prev, change: last && prev ? Math.round((last.y - prev.y) * 10) / 10 : null, points: pts }]
  }))
}
