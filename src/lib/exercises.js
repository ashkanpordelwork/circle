// The exercise library: yuhonas/free-exercise-db (public domain), trimmed by
// scripts/build-exercises.mjs into public/exercises.json and loaded once on first use.
// Images come from jsDelivr at a pinned commit, so they never change under a plan.

const COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
const IMG_BASE = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${COMMIT}/exercises/`

export const imageUrl = path => IMG_BASE + path

export const MUSCLES = {
  abdominals: 'شکم', abductors: 'دورکننده ران', adductors: 'نزدیک‌کننده ران', biceps: 'جلو بازو',
  calves: 'ساق پا', chest: 'سینه', forearms: 'ساعد', glutes: 'سرینی', hamstrings: 'همسترینگ',
  lats: 'زیربغل', 'lower back': 'پایین کمر', 'middle back': 'میانه پشت', neck: 'گردن',
  quadriceps: 'چهارسر ران', shoulders: 'سرشانه', traps: 'ذوزنقه', triceps: 'پشت بازو'
}
export const EQUIPMENT = {
  barbell: 'هالتر', dumbbell: 'دمبل', other: 'سایر', 'body only': 'وزن بدن', cable: 'سیم‌کش',
  machine: 'دستگاه', kettlebells: 'کتل‌بل', bands: 'کش', 'medicine ball': 'مدیسین‌بال',
  'exercise ball': 'توپ تعادلی', 'foam roll': 'فوم‌رولر', 'e-z curl bar': 'هالتر EZ'
}
export const CATEGORIES = {
  strength: 'قدرتی', stretching: 'کششی', plyometrics: 'پلایومتریک', powerlifting: 'پاورلیفتینگ',
  'olympic weightlifting': 'وزنه‌برداری', strongman: 'استرانگمن', cardio: 'هوازی'
}
export const LEVELS = { beginner: 'مبتدی', intermediate: 'متوسط', expert: 'پیشرفته' }

let cache = null
let byId = null
// Each entry: n English name, f Persian name, st Persian steps (see scripts/build-exercises.mjs).
export function setExercises(list) {
  cache = list
  byId = new Map(list.map(x => [x.id, x]))
  return list
}
export async function loadExercises() {
  if (cache) return cache
  const r = await fetch(import.meta.env.BASE_URL + 'exercises.json')
  return setExercises(await r.json())
}
export const exerciseById = id => byId?.get(id) || null
// The English name; for an id the library may not know (a renamed upstream entry) the id itself,
// readable and never blank.
export const exerciseNameEn = id => exerciseById(id)?.n || String(id).replace(/_/g, ' ')
// The Persian name, falling back to the English one.
export const exerciseName = id => exerciseById(id)?.f || exerciseNameEn(id)

// Arabic ي/ك, half-spaces and Persian digits all read as what a Persian keyboard types.
export const normText = s => String(s).toLowerCase()
  .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u064B-\u0652]/g, '')
  .replace(/[\u200c\u200f\u200e]/g, ' ')
  .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))

// Search by Persian or English words in any order, or by a muscle / equipment word.
// "جلوبازو" finds "جلو بازو": every word is also tried against the text without spaces.
export function searchExercises(list, query, { muscle = '', equipment = '' } = {}) {
  const words = normText(query).trim().split(/\s+/).filter(Boolean)
  return list.filter(x => {
    if (muscle && !x.m.includes(muscle)) return false
    if (equipment && x.e !== equipment) return false
    if (!words.length) return true
    const hay = normText([x.f || '', x.n, ...x.m.map(m => MUSCLES[m] || m), EQUIPMENT[x.e] || x.e, CATEGORIES[x.c] || x.c].join(' '))
    const tight = hay.replace(/\s+/g, '')
    return words.every(w => hay.includes(w) || tight.includes(w))
  })
}
