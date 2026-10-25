// Builds public/exercises.json from yuhonas/free-exercise-db (public domain, The Unlicense).
//   node scripts/build-exercises.mjs            # downloads the pinned commit
//   node scripts/build-exercises.mjs file.json  # or reads a local copy
// Only the fields the app uses are kept, under short keys; images stay on the CDN (lib/exercises.js).
import fs from 'node:fs'

export const COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
const src = process.argv[2]
const raw = src
  ? JSON.parse(fs.readFileSync(src, 'utf8'))
  : await (await fetch(`https://raw.githubusercontent.com/yuhonas/free-exercise-db/${COMMIT}/dist/exercises.json`)).json()

const out = raw.map(x => ({
  id: x.id,
  n: x.name,
  m: x.primaryMuscles || [],
  s: x.secondaryMuscles || [],
  e: x.equipment || 'other',
  c: x.category,
  l: x.level,
  img: x.images || [],
  st: x.instructions || []
}))
fs.writeFileSync(new URL('../public/exercises.json', import.meta.url), JSON.stringify(out))
console.log(`${out.length} exercises → public/exercises.json`)
