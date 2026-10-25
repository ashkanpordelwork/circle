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
export async function loadExercises() {
  if (cache) return cache
  const r = await fetch(import.meta.env.BASE_URL + 'exercises.json')
  cache = await r.json()
  byId = new Map(cache.map(x => [x.id, x]))
  return cache
}
export const exerciseById = id => byId?.get(id) || null
// A name for an id the library may not know (a renamed upstream entry): readable, never blank.
export const exerciseName = id => exerciseById(id)?.n || String(id).replace(/_/g, ' ')

// Search by English words in any order, or by a Persian muscle / equipment word.
export function searchExercises(list, query, { muscle = '', equipment = '' } = {}) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return list.filter(x => {
    if (muscle && !x.m.includes(muscle)) return false
    if (equipment && x.e !== equipment) return false
    if (!words.length) return true
    const hay = [x.n, ...x.m.map(m => MUSCLES[m] || m), EQUIPMENT[x.e] || x.e, CATEGORIES[x.c] || x.c].join(' ').toLowerCase()
    return words.every(w => hay.includes(w))
  })
}
