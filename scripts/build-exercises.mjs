// Builds public/exercises.json: openGym's exercise library (hasaneyldrm/exercises-dataset, the one
// openGym itself downloads) with Persian names, plus the older free-exercise-db entries that
// routines and logged workouts may still point at.
//   node scripts/build-exercises.mjs                      # downloads both pinned sources
//   node scripts/build-exercises.mjs og.json old.json     # or reads local copies
//
// Each entry, under short keys:
//   new   { id, n English, f Persian, m primary muscles, s secondary, e equipment, c category,
//           bp body part, img thumbnail, gif animation, st Persian steps }
//   old   an exercise that has a twin in the new library: just { id, to: new id }
//   old   one without a twin: its full free-exercise-db entry, marked old: 1 (never offered
//         again, only shown where a plan still holds it), except the everyday moves the new
//         library lacks (KEEP), which stay on offer
// Persian names: scripts/exercises-og-fa.json. Old → new twins: scripts/exercise-aliases.json.
// A new entry with no Persian steps of its own borrows its old twin's.
// Images and animations are not copied anywhere: the app loads them from jsDelivr (lib/exercises.js).
import fs from 'node:fs'

export const OG_COMMIT = '7455efae41b330c265e7cd4b78dfa848e7ce5ebd'
export const OLD_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'))
const load = async (path, url) => (path ? JSON.parse(fs.readFileSync(path, 'utf8')) : (await fetch(url)).json())

const og = await load(process.argv[2], `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${OG_COMMIT}/data/exercises.json`)
const old = await load(process.argv[3], `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${OLD_COMMIT}/dist/exercises.json`)
const faNames = read('./exercises-og-fa.json')
const oldFa = read('./exercises-fa.json')
const aliases = read('./exercise-aliases.json')

// openGym's muscle words → Circle's muscle keys (lib/exercises.js MUSCLES).
const TARGET = {
  abs: 'abdominals', quads: 'quadriceps', lats: 'lats', calves: 'calves', pectorals: 'chest', glutes: 'glutes',
  hamstrings: 'hamstrings', adductors: 'adductors', abductors: 'abductors', triceps: 'triceps', biceps: 'biceps',
  spine: 'lower back', 'upper back': 'middle back', delts: 'shoulders', forearms: 'forearms', traps: 'traps',
  'serratus anterior': 'chest', 'levator scapulae': 'neck'
}
const MUSCLE = {
  ...TARGET, shoulders: 'shoulders', deltoids: 'shoulders', 'rear deltoids': 'shoulders', 'rotator cuff': 'shoulders',
  quadriceps: 'quadriceps', chest: 'chest', 'upper chest': 'chest', core: 'abdominals', obliques: 'abdominals',
  abdominals: 'abdominals', 'lower abs': 'abdominals', 'hip flexors': 'abdominals', 'lower back': 'lower back', back: 'lower back',
  rhomboids: 'middle back', trapezius: 'traps', 'latissimus dorsi': 'lats', brachialis: 'biceps', ankles: 'calves', feet: 'calves',
  'ankle stabilizers': 'calves', soleus: 'calves', shins: 'calves', wrists: 'forearms', 'wrist flexors': 'forearms',
  'wrist extensors': 'forearms', hands: 'forearms', 'grip muscles': 'forearms', sternocleidomastoid: 'neck',
  groin: 'adductors', 'inner thighs': 'adductors'
}
const unknown = new Set()
const muscle = w => MUSCLE[w] || (unknown.add(w), null)
const file = p => String(p || '').replace(/^.*\//, '')
const title = s => s.charAt(0).toUpperCase() + s.slice(1)

// Everyday moves with no twin in the new library: still offered, under the new equipment words.
const KEEP = new Set(['Plank', 'Barbell_Hip_Thrust', 'Side_Bridge', 'Bodyweight_Squat', 'Superman',
  'Step-up_with_Knee_Raise', 'Incline_Push-Up_Wide'])
const KEEP_EQ = { 'body only': 'body weight', barbell: 'barbell' }

// Old Persian steps, lent to each new twin that has none.
const lent = {}
for (const [from, to] of Object.entries(aliases)) if (!lent[to] && oldFa[from]?.st?.length) lent[to] = oldFa[from].st

const fresh = og.map(x => {
  const m = [TARGET[x.target]].filter(Boolean)
  const s = [...new Set([x.muscle_group, ...(x.secondary_muscles || [])].map(muscle).filter(k => k && !m.includes(k)))]
  const c = x.body_part === 'cardio' ? 'cardio' : /stretch|pose|yoga/i.test(x.name) ? 'stretching' : 'strength'
  return { id: x.id, n: title(x.name), f: faNames[x.id] || title(x.name), m, s, e: x.equipment, c, bp: x.body_part,
    img: file(x.image), gif: file(x.gif_url), st: lent[x.id] || [] }
})
const ids = new Set(fresh.map(x => x.id))
const legacy = old.map(x => (aliases[x.id] && ids.has(aliases[x.id])
  ? { id: x.id, to: aliases[x.id] }
  : { id: x.id, n: x.name, f: oldFa[x.id]?.f || x.name, m: x.primaryMuscles || [], s: x.secondaryMuscles || [],
    e: x.equipment || 'other', c: x.category, l: x.level, img: x.images || [], st: oldFa[x.id]?.st || x.instructions || [],
    ...(KEEP.has(x.id) ? { e: KEEP_EQ[x.equipment] || x.equipment } : { old: 1 }) }))

for (const id of KEEP) if (!legacy.some(x => x.id === id && !x.old && !x.to)) throw new Error(`KEEP: ${id} is not an old entry without a twin`)
const missing = fresh.filter(x => !faNames[x.id]).map(x => x.id)
if (missing.length) console.warn(`no Persian name for ${missing.length}: ${missing.join(', ')}`)
if (unknown.size) console.warn(`muscles with no Circle key: ${[...unknown].join(', ')}`)
fs.writeFileSync(new URL('../public/exercises.json', import.meta.url), JSON.stringify([...fresh, ...legacy]))
console.log(`${fresh.length} exercises (${fresh.filter(x => x.st.length).length} with Persian steps), ` +
  `${legacy.filter(x => x.to).length} old ids linked, ${legacy.filter(x => x.old).length} old kept → public/exercises.json`)
