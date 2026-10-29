import './og/test-library.js'
import { describe, it, expect } from 'vitest'
import { historyOf } from './smart.js'
import { buildSession, lastSetsOf, nextOpen, summarize, readDraft, writeDraft, dropDraft, DEFAULT_REST } from './session.js'

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'
const PUSHUP = 'Pushups'
const eq = id => (id === PUSHUP ? 'body only' : 'barbell')
const routine = (items, id = 'r1') => ({ id, items })
const item = (over = {}) => ({ exercise_id: BENCH, sets: 3, reps: '5', weight: '', rest_sec: '', progression: 'linear', ...over })

function hist(rows) {
  const workouts = [], sets = []
  rows.forEach(([date, routineId, id, w, ...reps], i) => {
    workouts.push({ id: 'w' + i, date, routine_id: routineId })
    reps.forEach((r, k) => sets.push({ workout_id: 'w' + i, exercise_id: id, set_index: k + 1, reps: r, weight: w }))
  })
  return historyOf(workouts, sets)
}

describe('building the session', () => {
  it('starts every set at the suggested weight, with last time beside it', () => {
    const [ex] = buildSession(routine([item()]), hist([['2026-10-01', 'r1', BENCH, 60, 5, 5, 5]]), eq)
    expect(ex.suggestion.kind).toBe('up')
    expect(ex.sets).toEqual([0, 1, 2].map(() => ({ weight: 62.5, reps: 5, done: false, prev: { w: 60, r: 5 } })))
    expect(ex.rest).toBe(DEFAULT_REST)
  })
  it('uses the plan\'s weight the first time, and its rest', () => {
    const [ex] = buildSession(routine([item({ weight: 40, rest_sec: 120 })]), hist([]), eq)
    expect(ex.sets[0]).toMatchObject({ weight: 40, reps: 5, prev: null })
    expect(ex.rest).toBe(120)
  })
  it('keeps the plan\'s weight when the exercise has no rule', () => {
    const [ex] = buildSession(routine([item({ weight: 50, progression: 'off' })]), hist([['2026-10-01', 'r1', BENCH, 60, 5, 5, 5]]), eq)
    expect(ex.sets[0].weight).toBe(50)
  })
  it('aims at the top of a range under linear progression', () => {
    const [ex] = buildSession(routine([item({ reps: '6-8', weight: 60 })]), hist([]), eq)
    expect(ex.sets[0].reps).toBe(8)
  })
  it('starts a range at its bottom, and climbs it under double progression', () => {
    const fresh = buildSession(routine([item({ reps: '8-12', progression: 'double', weight: 30 })]), hist([]), eq)
    expect(fresh[0].sets[0]).toMatchObject({ weight: 30, reps: 8 })
    const [ex] = buildSession(routine([item({ reps: '8-12', progression: 'double' })]), hist([['2026-10-01', 'r1', BENCH, 30, 9, 9, 9]]), eq)
    expect(ex.sets[0]).toMatchObject({ weight: 30, reps: 10 })
  })
  it('asks no weight of a bodyweight exercise', () => {
    const [ex] = buildSession(routine([item({ exercise_id: PUSHUP, reps: '10' })]), hist([]), eq)
    expect(ex.weighted).toBe(false)
    expect(ex.sets[0]).toMatchObject({ weight: '', reps: 10 })
  })
  it('reads last time from this routine first, else from anywhere', () => {
    const h = hist([['2026-10-01', 'r2', BENCH, 50, 8], ['2026-10-02', 'r1', BENCH, 60, 5], ['2026-10-03', 'r2', BENCH, 52.5, 8]])
    expect(lastSetsOf(h, BENCH, 'r1')).toEqual([{ w: 60, r: 5, done: true }])
    expect(lastSetsOf(h, BENCH, 'r9')).toEqual([{ w: 52.5, r: 8, done: true }])
  })
})

describe('during and after', () => {
  const log = [{ exercise_id: BENCH, sets: [{ weight: 60, reps: 5, done: true }, { weight: 60, reps: 5, done: false }] },
    { exercise_id: PUSHUP, sets: [{ weight: '', reps: 12, done: false }] }]
  it('finds the next set to do', () => {
    expect(nextOpen(log)).toEqual([0, 1])
    expect(nextOpen([{ sets: [{ done: true }] }])).toBeNull()
  })
  it('adds up the done sets, and the one-rep max records', () => {
    const before = hist([['2026-10-01', 'r1', BENCH, 55, 5]])
    expect(summarize(log, before, 1500)).toEqual({ sets: 1, planned: 3, reps: 5, volume: 300, minutes: 25, records: [{ exercise_id: BENCH, y: 70, w: 60, r: 5, prev: 64.2 }] })
    expect(summarize(log, hist([['2026-10-01', 'r1', BENCH, 80, 5]])).records).toEqual([])
  })
  it('keeps a session in progress on the device, until it is stale', () => {
    const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }
    writeDraft(storage, 'r1', { log: [{ sets: [{ done: false }] }], note: '', startedAt: 1000 })
    expect(readDraft(storage, 'r1', 2000)).toBeNull()   // nothing ticked: start fresh
    writeDraft(storage, 'r1', { log, note: 'x', startedAt: 1000 })
    expect(readDraft(storage, 'r1', 2000)).toMatchObject({ note: 'x' })
    expect(readDraft(storage, 'r1', 1000 + 13 * 3600e3)).toBeNull()
    dropDraft(storage, 'r1')
    expect(readDraft(storage, 'r1', 2000)).toBeNull()
  })
})
