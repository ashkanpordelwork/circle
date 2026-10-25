// The student's intake questionnaire: what the coach needs to know before writing a plan.
// Stored as one JSON object per student (supabase/migrations/0004_intake.sql). Each list question
// keeps option keys in `<key>` and the student's own words in `<key>_note`. 'none' («ندارم») is
// exclusive: picking it clears the others, and picking another clears it.

export const SEX = [['male', 'مرد'], ['female', 'زن']]

export const GOALS = [
  ['fat_loss', 'کاهش وزن و چربی'],
  ['muscle', 'عضله‌سازی'],
  ['strength', 'افزایش قدرت'],
  ['fitness', 'تناسب اندام و سلامتی'],
  ['endurance', 'استقامت'],
  ['sport', 'آمادگی برای یک رشته ورزشی'],
  ['rehab', 'بازتوانی بعد از آسیب']
]

export const EXPERIENCE = [
  ['none', 'تازه‌کار، تا حالا تمرین نکرده‌ام'],
  ['lt6m', 'کمتر از ۶ ماه'],
  ['6m2y', '۶ ماه تا ۲ سال'],
  ['gt2y', 'بیشتر از ۲ سال']
]

export const INJURIES = [
  ['none', 'ندارم'],
  ['back', 'کمر'],
  ['knee', 'زانو'],
  ['shoulder', 'شانه'],
  ['neck', 'گردن'],
  ['elbow', 'آرنج'],
  ['wrist', 'مچ دست'],
  ['ankle', 'مچ پا'],
  ['hip', 'لگن'],
  ['other', 'سایر']
]

export const CONDITIONS = [
  ['none', 'ندارم'],
  ['blood_pressure', 'فشار خون'],
  ['heart', 'بیماری قلبی'],
  ['diabetes', 'دیابت'],
  ['asthma', 'آسم'],
  ['thyroid', 'تیروئید'],
  ['joint', 'آرتروز یا مشکل مفصل'],
  ['pregnancy', 'بارداری'],
  ['other', 'سایر']
]

export const DIET = [
  ['none', 'ندارم'],
  ['vegetarian', 'گیاه‌خوار'],
  ['vegan', 'وگان'],
  ['lactose', 'عدم تحمل لاکتوز'],
  ['gluten', 'بدون گلوتن (سلیاک)'],
  ['allergy', 'حساسیت غذایی'],
  ['other', 'سایر']
]

// The screens, in order. `list` questions are multiple choice; `single` ones pick one.
export const STEPS = [
  { key: 'body', icon: 'person', title: 'کمی از خودت بگو', sub: 'مربی برای تنظیم شدت تمرین به این‌ها نیاز دارد.' },
  { key: 'goals', icon: 'flag', title: 'هدفت از تمرین چیست؟', sub: 'هر چند تا که درست است انتخاب کن.', options: GOALS, multi: true, note: 'مثلاً ۸ کیلو کم کنم تا عید' },
  { key: 'experience', icon: 'fitness_center', title: 'سابقه تمرین', sub: 'چقدر با تمرین با وزنه آشنایی؟', options: EXPERIENCE, note: 'مثلاً قبلاً فوتبال بازی می‌کردم' },
  { key: 'injuries', icon: 'healing', title: 'آسیب یا درد داری؟', sub: 'آسیب قدیمی یا دردی که هنگام تمرین حس می‌کنی.', options: INJURIES, multi: true, note: 'کدام سمت، از کی، و چه حرکتی دردش را بیشتر می‌کند' },
  { key: 'conditions', icon: 'medical_information', title: 'بیماری یا شرایط خاص', sub: 'برای امنیت تمرین مهم است.', options: CONDITIONS, multi: true, note: 'داروی خاصی مصرف می‌کنی؟ اینجا بنویس' },
  { key: 'diet', icon: 'restaurant', title: 'محدودیت غذایی', sub: 'برای پیشنهادهای تغذیه‌ای مربی.', options: DIET, multi: true, note: 'مثلاً به بادام‌زمینی حساسیت دارم' }
]

export const DAYS_PER_WEEK = [1, 2, 3, 4, 5, 6, 7]

const label = (list, k) => list.find(([key]) => key === k)?.[1] || k

// Tap an option of a multiple-choice question.
export function toggle(picked, key) {
  const cur = picked || []
  if (cur.includes(key)) return cur.filter(k => k !== key)
  if (key === 'none') return ['none']
  return [...cur.filter(k => k !== 'none'), key]
}

// May the student move past this screen?
export function stepDone(step, a) {
  if (step === 'body') return !!a.sex && a.age > 0 && a.height > 0 && a.weight > 0
  if (step === 'experience') return !!a.experience && a.days > 0
  return (a[step] || []).length > 0
}

export const complete = a => STEPS.every(s => stepDone(s.key, a))

// Only known keys and sane values reach the database.
export function clean(a) {
  const out = {}
  if (SEX.some(([k]) => k === a.sex)) out.sex = a.sex
  for (const [k, lo, hi] of [['age', 10, 100], ['height', 100, 230], ['weight', 25, 300], ['days', 1, 7]]) {
    const v = Number(a[k])
    if (Number.isFinite(v) && v >= lo && v <= hi) out[k] = Math.round(v * 10) / 10
  }
  if (EXPERIENCE.some(([k]) => k === a.experience)) out.experience = a.experience
  for (const [k, list] of [['goals', GOALS], ['injuries', INJURIES], ['conditions', CONDITIONS], ['diet', DIET]]) {
    out[k] = (a[k] || []).filter(x => list.some(([key]) => key === x))
  }
  for (const s of STEPS) {
    const n = String(a[s.key + '_note'] || '').trim().slice(0, 600)
    if (n) out[s.key + '_note'] = n
  }
  if (a.answered_year) out.answered_year = a.answered_year
  return out
}

// Age moves on with the calendar: the answer is stored with the year it was given.
export const ageNow = (a, year = new Date().getFullYear()) =>
  a.age ? a.age + Math.max(0, year - (a.answered_year || year)) : null

export function bmi(a) {
  if (!(a.height > 0 && a.weight > 0)) return null
  const v = a.weight / (a.height / 100) ** 2
  const band = v < 18.5 ? 'کم‌وزن' : v < 25 ? 'نرمال' : v < 30 ? 'اضافه وزن' : 'چاقی'
  return { value: Math.round(v * 10) / 10, band, ok: v >= 18.5 && v < 25 }
}

const picked = (keys, list) => (keys || []).filter(k => k !== 'none').map(k => label(list, k))

// What the coach reads, most important first: safety, then the body, the goal, the background.
export function profile(a, year) {
  if (!a) return null
  const injuries = picked(a.injuries, INJURIES), conditions = picked(a.conditions, CONDITIONS)
  const alerts = []
  if (injuries.length || a.injuries_note && !a.injuries?.includes('none')) alerts.push({ kind: 'injury', title: 'آسیب‌ها', items: injuries, note: a.injuries_note || '' })
  if (conditions.length || a.conditions_note && !a.conditions?.includes('none')) alerts.push({ kind: 'condition', title: 'بیماری و شرایط خاص', items: conditions, note: a.conditions_note || '' })
  return {
    alerts,
    sex: a.sex ? label(SEX, a.sex) : null,
    age: ageNow(a, year),
    height: a.height || null,
    weight: a.weight || null,
    bmi: bmi(a),
    goals: picked(a.goals, GOALS),
    goalsNote: a.goals_note || '',
    experience: a.experience ? label(EXPERIENCE, a.experience) : null,
    experienceNote: a.experience_note || '',
    days: a.days || null,
    diet: picked(a.diet, DIET),
    dietNote: a.diet_note || '',
    // A medication or other remark under «ندارم» is still worth showing.
    conditionsNote: a.conditions?.includes('none') ? a.conditions_note || '' : ''
  }
}

// One line for the plan editor: what to keep in mind while choosing exercises.
export const alertLine = p => (p?.alerts || []).map(x => x.items.length ? x.items.join('، ') : x.title).join(' · ')
