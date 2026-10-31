// Tests run without a browser: load Circle's exercise library from disk before anything asks.
import { readFileSync } from 'node:fs'
import { setExercises } from '../exercises.js'
import { setLibrary } from './exercises.js'

const all = JSON.parse(readFileSync(new URL('../../../public/exercises.json', import.meta.url)))
setLibrary(setExercises(all))
