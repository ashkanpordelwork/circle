import { describe, it, expect } from 'vitest'
import { insights, thisMonth, weightChange, activityGrid, muscleBalance, exerciseSeries, trainedExercises, periodStart } from './stats.js'

const TODAY = '2026-10-29'   // Thursday, 7 Aban 1405
const workouts = [
  { id: 'a', date: '2026-10-28', duration_sec: 3000, end_reason: '' },
  { id: 'b', date: '2026-10-20', duration_sec: 1800, end_reason: 'time' },
  { id: 'c', date: '2026-08-01' }
]
const sets = [
  { workout_id: 'a', exercise_id: 'bench', weight: 60, reps: 5 },
  { workout_id: 'a', exercise_id: 'bench', weight: 62.5, reps: 5 },
  { workout_id: 'a', exercise_id: 'squat', weight: 100, reps: 5 },
  { workout_id: 'b', exercise_id: 'bench', weight: 57.5, reps: 8 },
  { workout_id: 'c', exercise_id: 'pushup', weight: null, reps: 20 }
]
const muscles = id => ({ bench: ['chest', 'triceps'], squat: ['quadriceps'], pushup: ['chest'] })[id]

describe('stats', () => {
  it('covers a period up to today', () => {
    expect(periodStart('7', TODAY)).toBe('2026-10-23')
    expect(periodStart('all', TODAY)).toBeNull()
  })
  it('adds up a period', () => {
    expect(insights(workouts, sets, '7', TODAY)).toEqual({ sessions: 1, minutes: 50, avgMinutes: 50, sets: 3, reps: 15, volume: 1113, endedEarly: 0 })
    expect(insights(workouts, sets, '30', TODAY)).toMatchObject({ sessions: 2, minutes: 80, avgMinutes: 40, sets: 4, endedEarly: 1 })
    expect(insights(workouts, sets, 'all', TODAY)).toMatchObject({ sessions: 3, sets: 5, reps: 43 })
  })
  it('counts this Jalali month', () => {
    // Aban 1405 began on 2026-10-23.
    expect(thisMonth(workouts, TODAY)).toBe(1)
  })
  it('gives the 30-day weight change', () => {
    expect(weightChange([{ date: '2026-10-01', weight: 82 }, { date: '2026-10-28', weight: '80.6' }, { date: '2026-09-01', weight: 90 }], TODAY)).toBe(-1.4)
    expect(weightChange([{ date: '2026-10-28', weight: 80 }], TODAY)).toBeNull()
  })
  it('lays out the activity weeks, Saturday first, by sets done', () => {
    const g = activityGrid(workouts, sets, TODAY, 2)
    expect(g.length).toBe(2)
    expect(g[0][0].date).toBe('2026-10-17')
    expect(g[1][4]).toMatchObject({ date: '2026-10-28', sets: 3, level: 4 })
    expect(g[0][3]).toMatchObject({ date: '2026-10-20', sets: 1, level: 2 })
    expect(g[1][6]).toMatchObject({ date: '2026-10-30', future: true, level: 0 })
  })
  it('balances muscles by sets', () => {
    expect(muscleBalance(workouts, sets, '30', TODAY, muscles)).toEqual([
      { muscle: 'chest', sets: 3 }, { muscle: 'triceps', sets: 3 }, { muscle: 'quadriceps', sets: 1 }])
  })
  it('follows one exercise session by session', () => {
    expect(exerciseSeries(workouts, sets, 'bench')).toEqual([
      { date: '2026-10-20', best: 57.5, e1rm: 72.8, w: 57.5, r: 8 },
      { date: '2026-10-28', best: 62.5, e1rm: 72.9, w: 62.5, r: 5 }])
  })
  it('lists exercises most-trained first', () => {
    expect(trainedExercises(sets)).toEqual(['bench', 'squat', 'pushup'])
  })
})
