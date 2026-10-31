// openGym's exercise helpers, answered from Circle's own library (lib/exercises.js).
// progression.js only needs to know an exercise's body part (for the load step), its equipment
// (bodyweight, a real load, or an assistance machine) and whether it is cardio; everything else
// openGym keeps about an exercise stays out. The library loads once (lib/exercises.js); until it
// has, every lookup answers "unknown", which the engine treats as an ordinary loaded lift.
import { exerciseById } from '../exercises.js'

// The older library's equipment words → the ones openGym's rules are written in. The new
// library already uses openGym's words, so they pass through unchanged.
const EQ = {
  'body only': 'body weight', bands: 'band', barbell: 'barbell', 'e-z curl bar': 'ez barbell',
  dumbbell: 'dumbbell', kettlebells: 'kettlebell', cable: 'cable', machine: 'leverage machine',
  'medicine ball': 'medicine ball', 'exercise ball': 'stability ball', 'foam roll': 'roller', other: 'other'
}
// An old entry's first primary muscle → openGym's body part (a new entry carries its own).
// Legs, back and glutes take the bigger step.
const BP = {
  quadriceps: 'upper legs', hamstrings: 'upper legs', adductors: 'upper legs', abductors: 'upper legs',
  calves: 'lower legs', glutes: 'glutes', lats: 'back', 'middle back': 'back', 'lower back': 'back',
  traps: 'back', chest: 'chest', shoulders: 'shoulders', biceps: 'upper arms', triceps: 'upper arms',
  forearms: 'lower arms', abdominals: 'waist', neck: 'neck'
}
export const shapeOf = x => x && {
  id: x.id, n: x.n, eq: EQ[x.e] || x.e || '',
  bp: x.bp || (x.c === 'cardio' ? 'cardio' : BP[(x.m || [])[0]] || '')
}

// EXIDX[id] like openGym's index; EXDB the whole list (the tests pick lifts from it).
export const EXIDX = new Proxy({}, { get: (_, id) => (typeof id === 'string' ? shapeOf(exerciseById(id)) || undefined : undefined) })
export const EXDB = []
export function setLibrary(list) { EXDB.length = 0; EXDB.push(...list.map(shapeOf)) }

const of = idOrEx => (typeof idOrEx === 'string' ? EXIDX[idOrEx] : idOrEx)
export const isCardio = idOrEx => of(idOrEx)?.bp === 'cardio'
const BODYWEIGHT_EQ = new Set(['body weight', 'band', 'resistance band'])
export const isBodyweightEq = idOrEx => BODYWEIGHT_EQ.has(of(idOrEx)?.eq)
const LOADED_EQ = new Set(['barbell', 'ez barbell', 'olympic barbell', 'trap bar', 'dumbbell', 'kettlebell', 'cable', 'leverage machine', 'smith machine', 'sled machine', 'weighted'])
export const isLoadedEq = idOrEx => LOADED_EQ.has(of(idOrEx)?.eq)

// An assistance machine takes load off you: less is harder (openGym issue #232). Only a machine
// whose name says "assisted"; `assisted` on a config overrides it either way.
const assistedShape = ex => (typeof ex?.assisted === 'boolean' ? ex.assisted : ex?.eq === 'leverage machine' && /\bassist(ed)?\b/i.test(String(ex?.n || '')))
export function isAssisted(idOrEx) {
  if (!idOrEx) return false
  if (typeof idOrEx === 'string') return !!assistedShape(EXIDX[idOrEx])
  if (typeof idOrEx.assisted === 'boolean') return idOrEx.assisted
  if (typeof idOrEx.target?.assisted === 'boolean') return idOrEx.target.assisted
  const known = idOrEx.id ? EXIDX[idOrEx.id] : null
  return !!assistedShape(known || idOrEx)
}
