// Coaching: what an application asks, the coach plans, and the words for both.

// The areas an applicant picks from (one or more).
export const FOCUS = ['بدنسازی', 'قدرتی و پاورلیفتینگ', 'کاهش وزن', 'آمادگی عمومی', 'توانبخشی و آسیب', 'ورزشکاران حرفه‌ای', 'بانوان', 'سالمندان']

export const PLANS = [
  ['free', 'رایگان', 10],
  ['pro', 'حرفه‌ای', 30],
  ['studio', 'استودیو', null]
]
export const PLAN_NAME = Object.fromEntries(PLANS.map(([k, n]) => [k, n]))

// How many active students the coach may have today; null is no limit. Mirrors
// coach_capacity() in 0010_coaching.sql: a granted plan past its date is free again.
export function capacityOf(coach, today) {
  if (!coach) return 10
  if (coach.plan_until && coach.plan_until < today) return 10
  return (PLANS.find(p => p[0] === (coach.plan || 'free')) || PLANS[0])[2]
}
export const planNow = (coach, today) => (coach?.plan_until && coach.plan_until < today ? 'free' : coach?.plan || 'free')

export const APP_STATUS = { pending: 'در انتظار بررسی', approved: 'پذیرفته شد', declined: 'پذیرفته نشد' }
