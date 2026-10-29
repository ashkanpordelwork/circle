// Tests run without a browser: load Circle's exercise library from disk before anything asks.
import { readFileSync } from 'node:fs'
import { setExercises } from '../exercises.js'
import { setLibrary } from './exercises.js'

const list = JSON.parse(readFileSync(new URL('../../../public/exercises.json', import.meta.url)))
setExercises(list)
setLibrary(list)
