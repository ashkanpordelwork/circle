import './og/test-library.js'
import { describe, it, expect } from 'vitest'
import { repsOf, cfgOf, historyOf, suggest, whyFa, estimate1RM, e1rmSeries, best1RM } from './smart.js'

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'
const SQUAT = 'Barbell_Squat'
const item = (over = {}) => ({ exercise_id: BENCH, sets: 3, reps: '5', weight: 60, progression: 'linear', ...over })

// Sessions as [date, weight, ...reps of the ticked sets].
function hist(id, rows, routine = 'r1') {
  const workouts = [], sets = []
  rows.forEach(([date, w, ...reps], i) => {
    workouts.push({ id: 'w' + i, date, routine_id: routine })
    reps.forEach((r, k) => sets.push({ workout_id: 'w' + i, exercise_id: id, set_index: k + 1, reps: r, weight: w }))
  })
  return historyOf(workouts, sets)
}

describe('reading Circle into the engine', () => {
  it('reads a single rep count and a range, in either digits', () => {
    expect(repsOf('10')).toEqual({ reps: 10 })
    expect(repsOf('۸-۱۲')).toEqual({ reps: 12, repsMin: 8 })
    expect(repsOf('12-8')).toEqual({ reps: 12, repsMin: 8 })
    expect(repsOf('')).toEqual({})
  })
  it('makes a config from a routine item, linear by default', () => {
    expect(cfgOf({ exercise_id: BENCH, sets: 4, reps: '8-10', weight: '' })).toEqual({ id: BENCH, mode: 'reps', sets: 4, reps: 10, repsMin: 8, prog: 'linear' })
    expect(cfgOf(item({ progression: 'double', increment: 1.25 }))).toMatchObject({ prog: 'double', inc: 1.25, weight: 60 })
  })
  it('orders sessions oldest first and groups each exercise\'s ticked sets', () => {
    const h = historyOf(
      [{ id: 'b', date: '2026-10-05' }, { id: 'a', date: '2026-10-01', routine_id: 'r' }],
      [{ workout_id: 'a', exercise_id: BENCH, set_index: 2, reps: 5, weight: 60 }, { workout_id: 'a', exercise_id: BENCH, set_index: 1, reps: 6, weight: 60 }])
    expect(h.workouts.map(w => w.d)).toEqual(['2026-10-01', '2026-10-05'])
    expect(h.workouts[0]).toMatchObject({ routineId: 'r', entries: [{ id: BENCH, sets: [{ w: 60, r: 6, done: true }, { w: 60, r: 5, done: true }] }] })
  })
})

describe('the next weight, and why', () => {
  it('starts from the plan when nothing is logged', () => {
    const p = suggest(hist(BENCH, []), item(), 'r1')
    expect(p.kind).toBe('first')
    expect(p.why).toBe('هنوز چیزی ثبت نشده؛ این جلسه نقطه‌ی شروع است.')
  })
  it('adds 2.5 kg after every rep of every set', () => {
    const p = suggest(hist(BENCH, [['2026-10-01', 60, 5, 5, 5]]), item(), 'r1')
    expect(p).toMatchObject({ kind: 'up', weight: 62.5 })
    expect(p.why).toBe('دفعه‌ی قبل همه‌ی تکرارها کامل شد؛ ۲٫۵ کیلو اضافه کن.')
  })
  it('takes the bigger step for a lower-body lift', () => {
    expect(suggest(hist(SQUAT, [['2026-10-01', 100, 5, 5, 5]]), item({ exercise_id: SQUAT, weight: 100 }), 'r1')).toMatchObject({ kind: 'up', weight: 105 })
  })
  it('holds the weight when a set was skipped — an unticked set is a miss', () => {
    expect(suggest(hist(BENCH, [['2026-10-01', 60, 5, 5]]), item(), 'r1')).toMatchObject({ kind: 'hold', weight: 60 })
  })
  it('lightens the load after three missed sessions in a row', () => {
    const p = suggest(hist(BENCH, [['2026-10-01', 60, 5, 5, 3], ['2026-10-03', 60, 5, 4, 3], ['2026-10-05', 60, 5, 4, 4]]), item(), 'r1')
    expect(p.kind).toBe('deload')
    expect(p.weight).toBeLessThan(60)
    expect(p.why).toMatch(/^۳ جلسه پیشرفت نکردی/)
  })
  it('climbs reps inside the range under double progression, then adds weight', () => {
    const it8 = item({ reps: '8-12', progression: 'double', weight: 40 })
    expect(suggest(hist(BENCH, [['2026-10-01', 40, 9, 8, 8]]), it8, 'r1')).toMatchObject({ kind: 'hold', weight: 40, reps: 9 })
    expect(suggest(hist(BENCH, [['2026-10-01', 40, 12, 12, 12]]), it8, 'r1')).toMatchObject({ kind: 'up', weight: 42.5, reps: 8 })
  })
  it('says nothing when the exercise has no rule', () => {
    expect(suggest(hist(BENCH, [['2026-10-01', 60, 5, 5, 5]]), item({ progression: 'off' }), 'r1')).toMatchObject({ kind: 'off', why: '' })
  })
  it('has a Persian sentence for every reason the engine can give', () => {
    expect(whyFa(['Stalled {0} sessions — deload to {1} {2}.', 3, 52.5, 'kg'])).toBe('۳ جلسه پیشرفت نکردی؛ وزنه را به ۵۲٫۵ کیلو برسان.')
  })
})

describe('estimated one-rep max', () => {
  it('uses Epley up to 12 reps, and a single is the measurement itself', () => {
    expect(estimate1RM(60, 5)).toBe(70)
    expect(estimate1RM(100, 1)).toBe(100)
    expect(estimate1RM(40, 15)).toBeNull()
    expect(estimate1RM(0, 5)).toBeNull()
  })
  it('keeps the best set of each session, and the best of all', () => {
    const h = hist(BENCH, [['2026-10-01', 60, 5, 3], ['2026-10-03', 62.5, 5]])
    expect(e1rmSeries(h, BENCH)).toEqual([{ d: '2026-10-01', y: 70, w: 60, r: 5 }, { d: '2026-10-03', y: 72.9, w: 62.5, r: 5 }])
    expect(best1RM(h, BENCH)).toMatchObject({ y: 72.9 })
  })
})
