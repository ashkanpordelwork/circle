// The smart part of a workout: from what was logged before, the weight (or reps) for next time
// and one sentence saying why. The rules themselves are openGym's progression engine, unchanged
// (lib/og/progression.js, AGPL-3.0, with its own tests); this file only translates between it
// and Circle — Circle's sessions and sets in, Persian sentences out.
//
// Nothing is stored: the next target is derived from the log every time it is asked for, so
// fixing a mistyped set or changing an exercise's rule gives the right answer at once.

import { nextPrescription, POLICIES_FOR } from './og/progression.js'
import { faDigits } from './plan.js'

// The rules a coach (or the lifter) can pick for an exercise, in the order they are offered.
export const RULES = ['linear', 'double', 'greyskull', 'off']
export const RULE_NAME = {
  linear: 'افزایش خطی',
  double: 'دوبل پروگرشن',
  greyskull: 'گری‌اسکال',
  off: 'بدون پیشنهاد',
  time: 'افزایش زمان'
}
export const RULE_DESC = {
  linear: 'همه‌ی تکرارها کامل شد، وزنه یک پله بالا می‌رود. سه بار پشت سر هم ناقص بماند، وزنه سبک می‌شود.',
  double: 'با همان وزنه تکرارها را تا سقف بازه بالا ببر؛ وقتی همه‌ی ست‌ها به سقف رسید، وزنه بالا می‌رود و تکرار به کف بازه برمی‌گردد.',
  greyskull: 'ست آخر تا جایی که می‌توانی. هدف را رد کنی وزنه بالا می‌رود؛ دو برابر هدف بزنی، دو پله. یک بار شکست یعنی ۱۰٪ سبک‌تر.',
  off: 'وزنه همانی می‌ماند که در برنامه نوشته شده.',
  time: 'همه‌ی ست‌ها تا آخر زمان نگه داشته شد، زمان بالا می‌رود.'
}

// «۸-۱۲» or «10» as Circle writes reps → the engine's top of the range and its bottom.
export function repsOf(text) {
  const nums = String(text ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).match(/\d+/g)?.map(Number) || []
  if (!nums.length) return {}
  if (nums.length === 1) return { reps: nums[0] }
  const [a, b] = nums
  return { reps: Math.max(a, b), repsMin: Math.min(a, b) }
}

// A routine item → the engine's exercise config.
export function cfgOf(item) {
  const n = v => (v === '' || v == null ? undefined : Number(v))
  return {
    id: item.exercise_id,
    mode: 'reps',
    sets: Math.max(1, Number(item.sets) || 1),
    ...repsOf(item.reps),
    ...(n(item.weight) != null ? { weight: n(item.weight) } : {}),
    prog: item.progression || 'linear',
    ...(n(item.increment) > 0 ? { inc: n(item.increment) } : {})
  }
}

// Circle's workouts and their sets → the engine's history, oldest first. Only ticked sets are
// stored, so a set that was skipped is simply missing — which the engine reads as a miss.
export function historyOf(workouts, sets) {
  const bySession = new Map()
  for (const s of sets) {
    if (!bySession.has(s.workout_id)) bySession.set(s.workout_id, [])
    bySession.get(s.workout_id).push(s)
  }
  const ordered = [...workouts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.created_at || '').localeCompare(String(b.created_at || ''))))
  return {
    unit: 'kg',
    workouts: ordered.map(w => {
      const mine = (bySession.get(w.id) || []).slice().sort((a, b) => a.set_index - b.set_index)
      const ids = [...new Set(mine.map(s => s.exercise_id))]
      return {
        d: w.date,
        ...(w.routine_id ? { routineId: w.routine_id } : {}),
        entries: ids.map(id => ({
          id,
          sets: mine.filter(s => s.exercise_id === id).map(s => ({ w: Number(s.weight) || 0, r: Number(s.reps) || 0, done: true }))
        }))
      }
    })
  }
}

// The next target for one exercise of a session, with its reason in Persian.
// { kind: first|up|hold|deload|off, weight?, reps?, sets?, why: 'جمله' }
export function suggest(history, item, routineId) {
  const cfg = cfgOf(item)
  if (!POLICIES_FOR.reps.includes(cfg.prog)) cfg.prog = 'linear'
  const p = nextPrescription(history, cfg, routineId ? { id: routineId } : null)
  return { ...p, why: p.why ? whyFa(p.why) : '' }
}

/* ---------- the reason, in Persian ---------- */

const num = v => faDigits(typeof v === 'number' ? Math.round(v * 100) / 100 : v)
const UNIT = { kg: 'کیلو', lb: 'پوند' }
const arg = v => (typeof v === 'string' && UNIT[v] ? UNIT[v] : num(v))

const WHY = {
  'Nothing logged yet — this session sets the baseline.': 'هنوز چیزی ثبت نشده؛ این جلسه نقطه‌ی شروع است.',
  'First time in this routine — starting from its own target.': 'اولین بار در این جلسه؛ از هدف خود برنامه شروع کن.',
  'Plan changed — starting from your new target.': 'برنامه عوض شده؛ از هدف تازه شروع کن.',
  'Every rep last time — {0} {1} more.': 'دفعه‌ی قبل همه‌ی تکرارها کامل شد؛ {0} {1} اضافه کن.',
  'Every rep last time — {0} {1} less help.': 'دفعه‌ی قبل همه‌ی تکرارها کامل شد؛ {0} {1} کمک کمتر.',
  'Last set hit {0} reps — twice the target, so take a double jump of {1} {2}.': 'ست آخر {0} تکرار شد، دو برابر هدف؛ پس دو پله، {1} {2} اضافه کن.',
  'Missed reps last time — same weight again ({0} of {1} to go).': 'دفعه‌ی قبل تکرارها ناقص ماند؛ دوباره همین وزنه.',
  'Missed reps — reset to {0} {1} and work back up.': 'تکرارها ناقص ماند؛ با {0} {1} دوباره بالا برو.',
  'Missed reps {0} sessions running — reset to {1} {2} and work back up.': '{0} جلسه پشت سر هم ناقص ماند؛ با {1} {2} دوباره بالا برو.',
  'Missed reps — {0} {1} of help while you build back up.': 'تکرارها ناقص ماند؛ با {0} {1} کمک دوباره بساز.',
  'Stalled {0} sessions — deload to {1} {2}.': '{0} جلسه پیشرفت نکردی؛ وزنه را به {1} {2} برسان.',
  'Stalled {0} sessions — Epley deload to {1} {2} for {3} reps.': '{0} جلسه پیشرفت نکردی؛ {1} {2} با {3} تکرار.',
  'Stalled {0} sessions — hold {1} {2} and use {3} reps.': '{0} جلسه پیشرفت نکردی؛ همان {1} {2} با {3} تکرار.',
  'Stalled {0} sessions — back to {1} {2} of help and build up again.': '{0} جلسه پیشرفت نکردی؛ با {1} {2} کمک دوباره بساز.',
  'Top of the rep range in every set — {0} {1} more, back to {2} reps.': 'همه‌ی ست‌ها به سقف تکرار رسید؛ {0} {1} اضافه کن و برگرد به {2} تکرار.',
  'Top of the rep range in every set — {0} {1} less help, back to {2} reps.': 'همه‌ی ست‌ها به سقف تکرار رسید؛ {0} {1} کمک کمتر و برگرد به {2} تکرار.',
  'Same weight — aim for {0} reps this time.': 'همین وزنه؛ این بار {0} تکرار.',
  'No weight logged last time — enter what you lift and progression takes it from there.': 'دفعه‌ی قبل وزنه‌ای ثبت نشد؛ وزنه‌ات را بنویس تا پیشنهاد از همین‌جا ادامه دهد.',
  'Bodyweight — every rep last time, so go for {0} this time.': 'وزن بدن؛ دفعه‌ی قبل همه کامل شد، این بار {0} تکرار.',
  'Bodyweight — same target again until every set is clean.': 'وزن بدن؛ همین هدف تا همه‌ی ست‌ها کامل شود.',
  '{0} reps in every set — add a set and go back to {1}.': 'در همه‌ی ست‌ها {0} تکرار؛ یک ست اضافه کن و برگرد به {1}.',
  '{0} sets of {1} — time to add weight or move to a harder variation.': '{0} ست {1}تایی؛ وقت وزنه‌ی اضافه یا حرکت سخت‌تر است.',
  'Held every set for the full time — target up by {0}s.': 'همه‌ی ست‌ها تا آخر نگه داشته شد؛ {0} ثانیه بیشتر.',
  'Short {0} sessions in a row — back off to {1}s and build up again.': '{0} جلسه کوتاه ماند؛ با {1} ثانیه دوباره بساز.',
  'Last time came up short — same target again.': 'دفعه‌ی قبل کوتاه ماند؛ دوباره همین هدف.'
}

export function whyFa([template, ...args]) {
  const fa = WHY[template]
  if (!fa) return ''
  return fa.replace(/\{(\d)\}/g, (_, i) => arg(args[Number(i)]))
}

/* ---------- estimated one-rep max (openGym's onerm.js, Epley) ---------- */

// Above this many reps an estimate says more about endurance than strength: no guess.
export const REP_CAP = 12
export function estimate1RM(w, r) {
  const weight = Number(w), reps = Number(r)
  if (!isFinite(weight) || !isFinite(reps) || weight <= 0 || reps < 1 || reps > REP_CAP) return null
  const est = reps === 1 ? weight : weight * (1 + Math.round(reps) / 30)
  return isFinite(est) && est > 0 ? Math.round(est * 10) / 10 : null
}

// One point per session where the exercise gave an estimate, oldest first, each with the set
// it came from — «۷۰ از ۶۰ × ۵».
export function e1rmSeries(history, exId) {
  const out = []
  for (const w of history.workouts) {
    let best = null
    for (const e of w.entries) {
      if (e.id !== exId) continue
      for (const s of e.sets) {
        const est = estimate1RM(s.w, s.r)
        if (est != null && (!best || est > best.y)) best = { d: w.d, y: est, w: s.w, r: s.r }
      }
    }
    if (best) out.push(best)
  }
  return out
}
export const best1RM = (history, exId) => e1rmSeries(history, exId).reduce((b, p) => (!b || p.y > b.y ? p : b), null)
