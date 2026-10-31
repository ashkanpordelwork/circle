// «کد برنامه»: the athlete's whole plan — workouts, food, supplements — as their AI wrote it, in
// one block of JSON. This file turns pasted text into a checked, matched preview; nothing here
// talks to a server or to any AI. Version 1:
//
//   { "version": 1,
//     "workouts": [{ "name", "days"?: ["شنبه"], "exercises": [{ "name", "sets", "reps", "rest_sec"?, "note"? }] }],
//     "nutrition"?: { "targets": { "calories", "protein", "carbs", "fat" },
//                     "meals": [{ "name", "time"?: "08:00", "items": [{ "name", "amount", "calories", "protein", "carbs", "fat" }] }] },
//     "supplements"?: [{ "name", "dose", "times": ["بعد از تمرین"] }] }

import { normText } from './exercises.js'
import { toNumber } from './plan.js'
import { toLatinDigits } from './phone.js'

export const PLAN_VERSION = 1

/* ---------- 1. the code out of whatever was pasted ---------- */

// The JSON inside a ``` block, or the outermost { … } in the text. Chat apps add words around
// it, curly quotes, Persian digits in numbers, a trailing comma: each is forgiven in turn.
const INCOMPLETE = 'کد کامل نیست یا خراب شده. دوباره از هوش مصنوعی بخواه فقط یک بلوک کد بدهد.'
export function extractCode(text) {
  const t = String(text ?? '').trim()
  if (!t) return { error: 'کد را در کادر بچسبان.' }
  const fenced = [...t.matchAll(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/g)].map(m => m[1]).find(b => b.includes('{'))
  const body = fenced ?? t
  const a = body.indexOf('{'), b = body.lastIndexOf('}')
  if (a < 0) return { error: 'در متن چسبانده‌شده کدی پیدا نشد. کل پاسخ هوش مصنوعی را کپی کن.' }
  if (b <= a) return { error: INCOMPLETE }
  const raw = body.slice(a, b + 1)
  const tries = [
    raw,
    raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"),
    toLatinDigits(raw.replace(/[“”]/g, '"')).replace(/,\s*([}\]])/g, '$1')
  ]
  for (const s of tries) {
    try { return { data: JSON.parse(s) } } catch { /* the next, more forgiving try */ }
  }
  return { error: INCOMPLETE }
}

/* ---------- 2. checking it, with errors a person can act on ---------- */

const fa = n => Number(n).toLocaleString('fa-IR')
const DAYS = { شنبه: 6, یکشنبه: 0, دوشنبه: 1, سهشنبه: 2, چهارشنبه: 3, پنجشنبه: 4, جمعه: 5,
  saturday: 6, sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 }
const dayOf = d => DAYS[normText(d).replace(/[\s‌-]/g, '')]
const isObj = v => v && typeof v === 'object' && !Array.isArray(v)
const str = v => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const num = v => (typeof v === 'number' ? v : typeof v === 'string' ? toNumber(v) : null)
const hhmm = t => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(toLatinDigits(String(t ?? '')).trim())
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

// → { plan, errors }: plan is the cleaned plan (only when there are no errors).
export function validatePlan(data) {
  const errors = []
  const err = (where, what) => errors.push(where ? `${where}: ${what}` : what)
  if (!isObj(data)) return { errors: ['کد باید یک شیء JSON باشد که با { شروع می‌شود.'] }
  if (data.version != null && Number(data.version) !== PLAN_VERSION) err('', `نسخه‌ی ${data.version} پشتیبانی نمی‌شود؛ نسخه باید ${fa(PLAN_VERSION)} باشد.`)
  const plan = { workouts: [], nutrition: null, supplements: null }

  if (data.workouts != null && !Array.isArray(data.workouts)) err('', '«workouts» باید فهرست باشد.')
  ;(Array.isArray(data.workouts) ? data.workouts : []).forEach((w, i) => {
    const where = `تمرین ${fa(i + 1)}`
    if (!isObj(w)) return err(where, 'باید یک شیء باشد.')
    const name = str(w.name)
    if (!name) err(where, 'نام ندارد.')
    const days = []
    if (w.days != null) {
      if (!Array.isArray(w.days)) err(where, '«days» باید فهرست روزها باشد، مثلاً ["شنبه"].')
      else for (const d of w.days) { const n = dayOf(d); n == null ? err(where, `روز «${d}» شناخته نشد.`) : days.push(n) }
    }
    if (!Array.isArray(w.exercises) || !w.exercises.length) err(where, 'هیچ حرکتی ندارد.')
    const exercises = (Array.isArray(w.exercises) ? w.exercises : []).map((x, k) => {
      const at = `${where}، حرکت ${fa(k + 1)}`
      if (!isObj(x)) { err(at, 'باید یک شیء باشد.'); return null }
      const sets = num(x.sets), reps = str(x.reps), rest = x.rest_sec == null || x.rest_sec === '' ? null : num(x.rest_sec)
      if (!str(x.name)) err(at, 'نام ندارد.')
      if (!(Number.isInteger(sets) && sets >= 1 && sets <= 20)) err(at, 'تعداد ست باید عددی از ۱ تا ۲۰ باشد.')
      if (!/^\d{1,3}(\s*-\s*\d{1,3})?$/.test(toLatinDigits(reps))) err(at, 'تکرار باید عدد یا بازه باشد، مثلاً 8 یا "6-8".')
      if (rest != null && !(rest >= 0 && rest <= 900)) err(at, 'استراحت باید بین ۰ تا ۹۰۰ ثانیه باشد.')
      return { name: str(x.name), sets, reps: toLatinDigits(reps).replace(/\s+/g, ''), rest_sec: rest, note: str(x.note) }
    }).filter(Boolean)
    plan.workouts.push({ name, days: [...new Set(days)], exercises })
  })

  if (data.nutrition != null) {
    const n = data.nutrition
    if (!isObj(n)) err('تغذیه', 'باید یک شیء باشد.')
    else {
      let targets = null
      if (n.targets != null) {
        if (!isObj(n.targets)) err('هدف روزانه', 'باید یک شیء باشد.')
        else {
          targets = {}
          for (const [k, label] of [['calories', 'کالری'], ['protein', 'پروتئین'], ['carbs', 'کربوهیدرات'], ['fat', 'چربی']]) {
            const v = num(n.targets[k])
            if (v == null || v < 0) err('هدف روزانه', `${label} باید عدد باشد.`)
            targets[k] = Math.round(v ?? 0)
          }
        }
      }
      if (n.meals != null && !Array.isArray(n.meals)) err('تغذیه', '«meals» باید فهرست باشد.')
      const meals = (Array.isArray(n.meals) ? n.meals : []).map((m, i) => {
        const where = `وعده ${fa(i + 1)}`
        if (!isObj(m)) { err(where, 'باید یک شیء باشد.'); return null }
        if (!str(m.name)) err(where, 'نام ندارد.')
        const time = m.time == null || m.time === '' ? null : hhmm(m.time)
        if (m.time != null && m.time !== '' && !time) err(where, `زمان «${m.time}» باید مثل 08:00 باشد.`)
        const items = (Array.isArray(m.items) ? m.items : []).map((it, k) => {
          const at = `${where}، قلم ${fa(k + 1)}`
          if (!isObj(it) || !str(it.name)) { err(at, 'نام ندارد.'); return null }
          const macro = {}
          for (const key of ['calories', 'protein', 'carbs', 'fat']) {
            const v = it[key] == null || it[key] === '' ? 0 : num(it[key])
            if (v == null || v < 0) err(at, `«${key}» باید عدد باشد.`)
            macro[key] = v ?? 0
          }
          return { name: str(it.name), amount: str(it.amount), ...macro }
        }).filter(Boolean)
        return { name: str(m.name), time, items }
      }).filter(Boolean)
      plan.nutrition = { targets, meals }
    }
  }

  if (data.supplements != null) {
    if (!Array.isArray(data.supplements)) err('مکمل‌ها', 'باید فهرست باشد.')
    else plan.supplements = data.supplements.map((s, i) => {
      const where = `مکمل ${fa(i + 1)}`
      if (!isObj(s) || !str(s.name)) { err(where, 'نام ندارد.'); return null }
      const times = (Array.isArray(s.times) ? s.times : s.times != null ? [s.times] : []).map(t => hhmm(t) || str(t)).filter(Boolean)
      return { name: str(s.name), dose: str(s.dose), times }
    }).filter(Boolean)
  }

  if (!plan.workouts.length && !plan.nutrition && !plan.supplements) err('', 'کد هیچ تمرین، وعده یا مکملی ندارد.')
  return errors.length ? { errors } : { plan, errors: [] }
}

/* ---------- 3. exercise names → the library ---------- */

// Common names an AI writes, to the library's plain version of each lift. Without these the
// closest-sounding variant wins: «Barbell Bench Press» is nearer «Decline Barbell Bench Press».
const ALIASES = {
  'bench press': '0025', 'barbell bench press': '0025', 'flat bench press': '0025',
  'incline bench press': '0047', 'incline barbell bench press': '0047',
  'dumbbell bench press': '0289', 'incline dumbbell press': '0314', 'incline dumbbell bench press': '0314',
  squat: '0043', 'back squat': '0043', 'barbell back squat': '0043', 'barbell squat': '0043',
  'front squat': '0042', 'goblet squat': '1760',
  deadlift: '0032', 'barbell deadlift': '0032', 'conventional deadlift': '0032',
  'romanian deadlift': '0085', rdl: '0085',
  'overhead press': '1457', ohp: '1457', 'military press': '1457', 'barbell overhead press': '1457',
  'dumbbell shoulder press': '0426', 'seated dumbbell press': '0405',
  'lateral raise': '0334', 'lateral raises': '0334', 'dumbbell lateral raise': '0334',
  'barbell row': '0027', 'bent over row': '0027', 'bent over barbell row': '0027',
  'dumbbell row': '0292', 'one arm dumbbell row': '0292',
  'lat pulldown': '0150', 'lat pull down': '0150',
  'seated cable row': '0861', 'cable row': '0861',
  'pull up': '0652', 'pullup': '0652', 'pull ups': '0652', 'chin up': '1326',
  'push up': '0662', 'pushup': '0662', 'push ups': '0662', dips: '0814', dip: '0814',
  'bicep curl': '0294', 'biceps curl': '0294', 'dumbbell curl': '0294', 'dumbbell bicep curl': '0294',
  'barbell curl': '0031', 'hammer curl': '0313',
  'tricep pushdown': '0201', 'triceps pushdown': '0201', 'cable pushdown': '0201', 'skull crusher': '0060',
  'leg press': '0739', 'leg extension': '0585', 'leg curl': '0586', 'lying leg curl': '0586', 'seated leg curl': '0599',
  'calf raise': '0605', 'standing calf raise': '0605', 'hip thrust': 'Barbell_Hip_Thrust', 'barbell hip thrust': 'Barbell_Hip_Thrust', 'glute bridge': '1409',
  lunges: '0336', lunge: '0336', 'walking lunge': '0054', 'face pull': '0203',
  'chest fly': '0308', 'dumbbell fly': '0308', 'dumbbell flye': '0308', 'pec deck': '0596', 'cable fly': '0185',
  plank: 'Plank', crunch: '0274', crunches: '0274', 'cable crunch': '0175', 'reverse fly': '0383', 'rear delt fly': '0383'
}

// Lower-case, Persian letters and digits unified, punctuation to spaces, plural «s» dropped.
const words = s => normText(String(s).replace(/_/g, ' ')).replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  .map(w => (/^[a-z]{4,}s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w))
const key = s => words(s).join(' ')
const compact = s => words(s).join('')

function lev(a, b) {
  if (a === b) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}
// 0–1: shared words (Dice) or, for a typo, the edit distance of the names without spaces.
function similarity(q, name) {
  const a = new Set(words(q)), b = new Set(words(name))
  if (!a.size || !b.size) return 0
  let common = 0
  for (const w of a) if (b.has(w)) common++
  const dice = (2 * common) / (a.size + b.size)
  const x = compact(q), y = compact(name)
  const edit = 1 - lev(x, y) / Math.max(x.length, y.length)
  return Math.max(dice, edit)
}

// Prepare the library once for matching: [{ id, n, f }] → with their search keys.
export const indexLibrary = list => list.map(x => ({ id: x.id, n: x.n, f: x.f, kn: compact(x.n), kf: compact(x.f || ''), kid: compact(x.id) }))

// One name → { status: 'sure' | 'maybe' | 'missing', exercise_id?, candidates: [id] }.
// sure: the name is the library's own (English or Persian, ignoring case, spaces and
// punctuation) or a known common name; maybe: close enough to show for a yes; else missing,
// with whatever came closest as suggestions.
export function matchExercise(name, index) {
  const c = compact(name)
  if (!c) return { status: 'missing', candidates: [] }
  const alias = ALIASES[key(name)]
  if (alias && index.some(x => x.id === alias)) return { status: 'sure', exercise_id: alias, candidates: [] }
  const exact = index.find(x => x.kn === c || x.kf === c || x.kid === c)
  if (exact) return { status: 'sure', exercise_id: exact.id, candidates: [] }
  const ranked = index.map(x => ({ id: x.id, s: Math.max(similarity(name, x.n), x.f ? similarity(name, x.f) : 0) }))
    .filter(r => r.s >= 0.3).sort((p, q) => q.s - p.s).slice(0, 3)
  if (ranked[0] && ranked[0].s >= 0.6) return { status: 'maybe', exercise_id: ranked[0].id, candidates: ranked.map(r => r.id) }
  return { status: 'missing', candidates: ranked.map(r => r.id) }
}

/* ---------- 4. the preview ---------- */

// Pasted text → { errors } or { preview }. The preview holds every workout with each exercise
// matched, and counts of sure / maybe / missing for the three groups the page shows.
export function previewPlan(text, library) {
  const got = extractCode(text)
  if (got.error) return { errors: [got.error] }
  const { plan, errors } = validatePlan(got.data)
  if (errors.length) return { errors }
  const index = indexLibrary(library)
  const workouts = plan.workouts.map(w => ({ ...w, exercises: w.exercises.map(x => ({ ...x, match: matchExercise(x.name, index) })) }))
  const all = workouts.flatMap(w => w.exercises)
  const count = s => all.filter(x => x.match.status === s).length
  return { preview: { workouts, nutrition: plan.nutrition, supplements: plan.supplements, counts: { sure: count('sure'), maybe: count('maybe'), missing: count('missing') } }, errors: [] }
}

// Ready to save once every exercise is settled: sure, or confirmed / chosen by the athlete, or
// removed. (The page marks a settled one with status 'sure' and its exercise_id.)
export const unresolved = preview => preview.workouts.flatMap(w => w.exercises).filter(x => x.match.status !== 'sure').length

// A preview workout → the items save_my_routine takes. A rep range climbs by double
// progression; a single number by linear.
export const routineItems = w => w.exercises.map(x => ({
  exercise_id: x.match.exercise_id, sets: x.sets, reps: x.reps, weight: '', rest_sec: x.rest_sec ?? '', tempo: '', note: x.note,
  progression: x.reps.includes('-') ? 'double' : 'linear'
}))

/* ---------- 5. what to ask the AI ---------- */

export const PLAN_PROMPT = `برنامه‌ی تمرین، تغذیه و مکملی را که برایم نوشته‌ای، دقیقاً در قالب JSON زیر برگردان تا در اپ Circle وارد کنم.

قانون‌ها:
- فقط و فقط یک بلوک کد JSON بده، بدون هیچ توضیحی قبل یا بعد از آن.
- "version" همیشه 1 باشد.
- نام حرکت‌ها به انگلیسی و با نام استاندارد و رایج باشد (مثل "Barbell Bench Press"، "Lat Pulldown"، "Romanian Deadlift").
- "sets" عدد صحیح باشد؛ "reps" یک عدد یا یک بازه مثل "6-8"؛ "rest_sec" استراحت به ثانیه.
- "days" اختیاری است: اگر روز هر جلسه مشخص است، روزهای هفته را به فارسی بنویس (شنبه، یکشنبه، دوشنبه، سه‌شنبه، چهارشنبه، پنجشنبه، جمعه)؛ اگر نه، "days" را ننویس تا جلسه‌ها به ترتیب اجرا شوند.
- همه‌ی ماکروها (calories, protein, carbs, fat) عدد باشند، بدون واحد. پروتئین، کربوهیدرات و چربی به گرم.
- "time" وعده‌ها به شکل 08:00 باشد.
- اگر بخشی (تغذیه یا مکمل) در برنامه نیست، آن بخش را ننویس.

قالب:
\`\`\`json
{
  "version": 1,
  "workouts": [
    { "name": "روز ۱ - سینه و پشت بازو", "days": ["شنبه"], "exercises": [
      { "name": "Barbell Bench Press", "sets": 4, "reps": "6-8", "rest_sec": 120, "note": "" }
    ] }
  ],
  "nutrition": {
    "targets": { "calories": 2800, "protein": 180, "carbs": 320, "fat": 80 },
    "meals": [
      { "name": "صبحانه", "time": "08:00", "items": [
        { "name": "تخم‌مرغ", "amount": "۴ عدد", "calories": 280, "protein": 24, "carbs": 2, "fat": 20 }
      ] }
    ]
  },
  "supplements": [
    { "name": "کراتین", "dose": "۵ گرم", "times": ["بعد از تمرین"] }
  ]
}
\`\`\``
