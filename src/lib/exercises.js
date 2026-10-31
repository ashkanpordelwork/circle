// The exercise library: openGym's (hasaneyldrm/exercises-dataset) with Persian names, built by
// scripts/build-exercises.mjs into public/exercises.json and loaded once on first use. The older
// free-exercise-db entries stay in the file for plans that still hold them: one with a twin in the
// new library answers as that twin; one without is shown as it was but never offered again.
// Images and animations come from jsDelivr at pinned commits, so they never change under a plan.
// They belong to their owners (see public/EXERCISES_LICENSE.txt), not to this app.

const OG_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/'
const OLD_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/'

// A still picture: the new library's thumbnail, or an old entry's start photo.
export const thumbUrl = x => (typeof x?.img === 'string' ? OG_BASE + 'images/' + x.img : x?.img?.[0] ? OLD_BASE + x.img[0] : null)
// The moving picture: the new library's animation; old entries have photos only.
export const gifUrl = x => (x?.gif ? OG_BASE + 'videos/' + x.gif : null)
export const photoUrls = x => (Array.isArray(x?.img) ? x.img.map(p => OLD_BASE + p) : [])

export const MUSCLES = {
  abdominals: 'شکم', abductors: 'دورکننده ران', adductors: 'نزدیک‌کننده ران', biceps: 'جلو بازو',
  calves: 'ساق پا', chest: 'سینه', forearms: 'ساعد', glutes: 'سرینی', hamstrings: 'همسترینگ',
  lats: 'زیربغل', 'lower back': 'پایین کمر', 'middle back': 'میانه پشت', neck: 'گردن',
  quadriceps: 'چهارسر ران', shoulders: 'سرشانه', traps: 'ذوزنقه', triceps: 'پشت بازو'
}
export const EQUIPMENT = {
  'body weight': 'وزن بدن', dumbbell: 'دمبل', barbell: 'هالتر', cable: 'سیم‌کش', 'leverage machine': 'دستگاه',
  'smith machine': 'اسمیت', kettlebell: 'کتل‌بل', band: 'کش', 'resistance band': 'کش مقاومتی', 'ez barbell': 'هالتر EZ',
  'olympic barbell': 'هالتر المپیک', 'trap bar': 'ترپ‌بار', 'stability ball': 'توپ تعادلی', 'bosu ball': 'بوسو',
  'medicine ball': 'مدیسین‌بال', 'sled machine': 'دستگاه پرس پا', weighted: 'وزنه اضافه', assisted: 'کمکی',
  rope: 'طناب', roller: 'فوم‌رولر', 'wheel roller': 'چرخ شکم', hammer: 'پتک', tire: 'لاستیک',
  'stationary bike': 'دوچرخه ثابت', 'elliptical machine': 'الپتیکال', 'stepmill machine': 'دستگاه پله',
  'skierg machine': 'دستگاه اسکی', 'upper body ergometer': 'ارگومتر دست',
  // The older library's words, for plans that still hold its exercises.
  other: 'سایر', 'body only': 'وزن بدن', machine: 'دستگاه', kettlebells: 'کتل‌بل', bands: 'کش',
  'exercise ball': 'توپ تعادلی', 'foam roll': 'فوم‌رولر', 'e-z curl bar': 'هالتر EZ'
}
// The equipment the picker offers as filters, most used first.
export const EQUIPMENT_FILTERS = ['body weight', 'dumbbell', 'barbell', 'cable', 'leverage machine', 'smith machine',
  'kettlebell', 'band', 'ez barbell', 'stability ball', 'medicine ball', 'sled machine', 'weighted']
export const CATEGORIES = {
  strength: 'قدرتی', stretching: 'کششی', plyometrics: 'پلایومتریک', powerlifting: 'پاورلیفتینگ',
  'olympic weightlifting': 'وزنه‌برداری', strongman: 'استرانگمن', cardio: 'هوازی'
}
export const LEVELS = { beginner: 'مبتدی', intermediate: 'متوسط', expert: 'پیشرفته' }

let cache = null
let byId = null
// The file holds every entry (see scripts/build-exercises.mjs); the list handed out holds only the
// ones to offer. Every id still resolves: an old one with a twin answers as the twin.
export function setExercises(all) {
  byId = new Map(all.map(x => [x.id, x]))
  cache = all.filter(x => !x.to && !x.old)
  return cache
}
export async function loadExercises() {
  if (cache) return cache
  const r = await fetch(import.meta.env.BASE_URL + 'exercises.json')
  return setExercises(await r.json())
}
export function exerciseById(id) {
  const x = byId?.get(id)
  return (x?.to ? byId.get(x.to) : x) || null
}
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
