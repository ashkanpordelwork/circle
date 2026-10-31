// The questionnaire right after signing up (SPEC §3.4): 17 questions, one per screen, each with a
// short «why we ask». Stored as one JSON object per person (profiles.answers, 0012_profiles.sql).
// Some questions only follow from an earlier answer (`when`). In a multiple-choice list 'none'
// («ندارم» / «هیچ») is exclusive: picking it clears the others, and picking another clears it.
import { ageOf } from './calculator.js'

// Weekdays as routines store them (0 = Sunday … 6 = Saturday), listed from Saturday.
export const WEEKDAYS = [[6, 'شنبه'], [0, 'یکشنبه'], [1, 'دوشنبه'], [2, 'سه‌شنبه'], [3, 'چهارشنبه'], [4, 'پنجشنبه'], [5, 'جمعه']]

export const QUESTIONS = [
  { key: 'sex', type: 'single', title: 'جنسیتت؟', why: 'نیاز روزانه‌ی کالری مرد و زن با فرمول کمی متفاوت حساب می‌شود.',
    options: [['male', 'مرد'], ['female', 'زن']] },
  { key: 'birth_year', type: 'number', title: 'سال تولدت؟', why: 'سن روی متابولیسم پایه اثر دارد.', placeholder: '۱۳۷۵', min: 1300, max: 2015 },
  { key: 'height', type: 'number', title: 'قدت چقدر است؟', unit: 'سانتی‌متر', why: 'برای حساب کردن نیاز روزانه‌ات.', placeholder: '۱۷۵', min: 120, max: 230 },
  { key: 'weight', type: 'number', title: 'وزنت چقدر است؟', unit: 'کیلو', why: 'نیاز روزانه از وزنت حساب می‌شود، و نمودار وزنت از همین عدد شروع می‌شود.', placeholder: '۷۰', min: 30, max: 250, decimal: true },
  { key: 'goal', type: 'single', title: 'هدف اصلی‌ات چیست؟', why: 'هدف، تعداد تکرار و استراحت بین ست‌ها را تعیین می‌کند.',
    options: [['fat_loss', 'کاهش چربی'], ['muscle', 'عضله‌سازی'], ['health', 'سلامت و انرژی']] },
  { key: 'experience', type: 'single', title: 'چقدر سابقه‌ی تمرین منظم داری؟', why: 'برنامه‌ی تازه‌کار با کسی که سال‌ها تمرین کرده فرق دارد.',
    options: [['none', 'هیچ'], ['lt6m', 'کمتر از ۶ ماه'], ['6m2y', '۶ ماه تا ۲ سال'], ['gt2y', 'بیشتر از ۲ سال']] },
  { key: 'break', type: 'single', title: 'الان چند وقت است تمرین نکرده‌ای؟', why: 'بعد از یک وقفه‌ی طولانی، بدن باید دوباره آرام شروع کند.',
    options: [['training', 'الان تمرین می‌کنم'], ['lt3m', 'کمتر از ۳ ماه'], ['gt3m', 'بیشتر از ۳ ماه']], when: a => a.experience && a.experience !== 'none' },
  { key: 'place', type: 'single', title: 'کجا تمرین می‌کنی؟', why: 'برنامه‌ی خانه با وزن بدن است؛ برنامه‌ی باشگاه با دستگاه و وزنه.',
    options: [['home', 'خانه'], ['gym', 'باشگاه']] },
  { key: 'home_gear', type: 'multi', title: 'در خانه چه داری؟', why: 'تا بدانیم برای تمرین در خانه چه چیزهایی در دسترس توست.',
    options: [['none', 'هیچ'], ['chair', 'صندلی محکم'], ['table', 'میز محکم'], ['bar', 'میله بارفیکس'], ['dumbbell', 'دمبل']], when: a => a.place === 'home' },
  { key: 'days', type: 'single', title: 'هفته‌ای چند روز می‌توانی تمرین کنی؟', why: 'برنامه بر اساس تعداد روزها چیده می‌شود.',
    options: [[3, '۳ روز'], [4, '۴ روز'], [5, '۵ روز']] },
  { key: 'weekdays', type: 'weekdays', title: 'کدام روزها برایت بهتر است؟', why: 'جلسه‌ها را روی همین روزها می‌چینیم، با استراحت کافی بینشان.' },
  { key: 'session_min', type: 'single', title: 'هر جلسه چقدر وقت داری؟', why: 'اگر وقتت کم است، حرکت‌های تکمیلی حذف می‌شوند تا جلسه کوتاه بماند.',
    options: [[30, '۳۰ دقیقه'], [45, '۴۵ دقیقه'], [60, '۶۰ دقیقه یا بیشتر']] },
  { key: 'pain', type: 'multi', note: true, title: 'جایی از بدنت درد یا آسیب دارد؟', why: 'برای جلسه‌هایی که به آن ناحیه فشار می‌آورند، نکته‌ی کوتاهی نشانت می‌دهیم.',
    options: [['none', 'ندارم'], ['knee', 'زانو'], ['back', 'کمر'], ['shoulder', 'شانه'], ['wrist', 'مچ دست'], ['neck', 'گردن']] },
  { key: 'conditions', type: 'multi', note: true, title: 'شرایط خاص سلامتی داری؟', why: 'تا موقع تمرین مراقب باشی؛ برای بعضی موارد، قبل از شروع یک یادآوری می‌بینی.',
    options: [['none', 'ندارم'], ['hypertension', 'فشار خون بالا'], ['diabetes', 'دیابت'], ['heart', 'بیماری قلبی'], ['asthma', 'آسم'],
      ['pregnancy', 'بارداری'], ['surgery', 'جراحی در ۶ ماه اخیر']] },
  { key: 'activity', type: 'single', title: 'بیرون از تمرین، روزت چقدر پرتحرک است؟', why: 'تحرک روزانه هم کالری می‌سوزاند و روی نیاز روزانه‌ات اثر دارد.',
    options: [['low', 'بیشتر نشسته'], ['mid', 'متوسط'], ['high', 'زیاد']] },
  { key: 'sleep', type: 'single', title: 'شب‌ها معمولاً چند ساعت می‌خوابی؟', why: 'خواب کافی برای ریکاوری عضله‌ها و انرژی روزانه مهم است.',
    options: [['lt6', 'کمتر از ۶ ساعت'], ['6to7', '۶ تا ۷ ساعت'], ['7to8', '۷ تا ۸ ساعت'], ['gt8', 'بیشتر از ۸ ساعت']] },
  { key: 'quit_reason', type: 'text', optional: true, title: 'قبلاً چه چیزی باعث شد تمرین را رها کنی؟', why: 'اختیاری است. کمک می‌کند این بار طوری پیش برویم که بمانی.',
    placeholder: 'مثلاً وقت نداشتم، نتیجه نگرفتم…' }
]
const BY_KEY = Object.fromEntries(QUESTIONS.map(q => [q.key, q]))

// The options a question shows for these answers: pregnancy only for a woman.
export const optionsOf = (q, a = {}) => (q.key === 'conditions' && a.sex === 'male' ? q.options.filter(([k]) => k !== 'pregnancy') : q.options)

// The questions that apply to these answers, in order.
export const visibleQuestions = (a = {}) => QUESTIONS.filter(q => !q.when || q.when(a))

// Pick or unpick one option of a multiple-choice list; 'none' stands alone.
export function toggle(list = [], key) {
  if (list.includes(key)) return list.filter(k => k !== key)
  return key === 'none' ? ['none'] : [...list.filter(k => k !== 'none'), key]
}

// What is wrong with this question's answer, in Persian; null when it can go on.
export function problem(q, a = {}) {
  const v = a[q.key]
  if (q.type === 'text') return null
  if (q.type === 'number') {
    if (v === '' || v == null || Number.isNaN(Number(v))) return 'یک عدد بنویس.'
    if (q.key === 'birth_year') { const age = ageOf(v); return age >= 13 && age <= 90 ? null : 'سال تولد را درست بنویس، مثلاً ۱۳۷۵.' }
    return v >= q.min && v <= q.max ? null : `عددی بین ${fa(q.min)} و ${fa(q.max)} بنویس.`
  }
  if (q.type === 'multi') return v?.length ? null : 'یکی را انتخاب کن.'
  if (q.type === 'weekdays') {
    const n = Number(a.days) || 0
    return v?.length === n ? null : `${fa(n)} روز انتخاب کن.`
  }
  return v == null || v === '' ? 'یکی را انتخاب کن.' : null
}
const fa = n => Number(n).toLocaleString('fa-IR', { useGrouping: false })

// Every question that applies is answered (the optional ones aside).
export const isComplete = (a = {}) => visibleQuestions(a).every(q => q.optional || !problem(q, a))

// Answers that no longer apply are dropped: a gym-goer has no home gear, a beginner no break.
// Weekdays no longer matching the number of days are cleared too.
export function tidy(a = {}) {
  const out = {}
  for (const q of visibleQuestions(a)) {
    if (a[q.key] !== undefined) out[q.key] = a[q.key]
    if (q.note && a[q.key + '_note']) out[q.key + '_note'] = a[q.key + '_note']
  }
  if (out.weekdays && out.weekdays.length !== Number(out.days)) delete out.weekdays
  if (out.conditions && out.sex === 'male') out.conditions = out.conditions.filter(k => k !== 'pregnancy')
  return out
}

// SPEC §3.4: a beginner has no or under six months of training, or has been away more than three.
export function levelOf(a = {}) {
  if (!a.experience) return null
  if (a.experience === 'none' || a.experience === 'lt6m' || a.break === 'gt3m') return 'beginner'
  return 'intermediate'
}
export const LEVEL_NAME = { beginner: 'مبتدی', intermediate: 'متوسط' }

// SPEC §3.5: these see a one-time «talk to your doctor» before the program, and are flagged
// «نیاز به توجه» on the dashboard.
const ATTENTION = ['heart', 'hypertension', 'pregnancy', 'surgery']
export const needsAttention = (a = {}) => (a.conditions || []).some(k => ATTENTION.includes(k))

// The calculator's input from the answers (lib/calculator.js).
export const calculatorInput = a => ({ sex: a.sex, birthYear: a.birth_year, height: a.height, weight: a.weight, goal: a.goal, activity: a.activity, days: a.days })

// The words of one answer, for showing it back.
export function answerText(q, a = {}) {
  const v = a[q.key]
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '—'
  const name = k => (q.type === 'weekdays' ? WEEKDAYS : optionsOf(q, a)).find(([o]) => o === k)?.[1] ?? k
  let text = Array.isArray(v) ? (q.type === 'weekdays' ? WEEKDAYS.filter(([d]) => v.includes(d)).map(([, n]) => n) : v.map(name)).join('، ')
    : q.type === 'number' ? fa(v) + (q.unit ? ' ' + q.unit : '') : q.type === 'text' ? v : name(v)
  if (q.note && a[q.key + '_note']) text += ` (${a[q.key + '_note']})`
  return text
}
export const question = key => BY_KEY[key]
