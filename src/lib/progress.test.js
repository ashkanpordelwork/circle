import { describe, it, expect } from 'vitest'
import { motivation, recordsThisWeek, mainLifts, proteinAdherence } from './progress.js'

const TODAY = '2026-10-29'   // Thursday; the week began Saturday 2026-10-24
const W = (id, date) => ({ id, date })
const S = (workout_id, exercise_id, weight, reps) => ({ workout_id, exercise_id, weight, reps })
const name = id => ({ bench: 'پرس سینه', squat: 'اسکوات' })[id] || id

describe('the sentence of encouragement', () => {
  it('leads with a record this week', () => {
    const ws = [W('a', '2026-10-17'), W('b', '2026-10-27')]
    const ss = [S('a', 'bench', 60, 5), S('b', 'bench', 65, 5), S('a', 'squat', 100, 5), S('b', 'squat', 95, 5)]
    expect(recordsThisWeek(ws, ss, TODAY)).toEqual([{ exercise_id: 'bench', e1rm: 75.8, prev: 70 }])
    expect(motivation(ws, ss, TODAY, name)).toEqual({ kind: 'record', text: 'رکورد جدید در پرس سینه: یک‌تکرار تخمینی‌ات به ۷۵٫۸ کیلو رسید.' })
  })
  it('else says how much more volume than the same point last week', () => {
    // Last week up to Thursday: 1000 kg. This week: 1120 kg, no record.
    const ws = [W('a', '2026-10-18'), W('x', '2026-10-23'), W('b', '2026-10-26')]
    const ss = [S('a', 'squat', 100, 10), S('x', 'squat', 100, 10), S('b', 'squat', 80, 14)]
    expect(motivation(ws, ss, TODAY, name)).toEqual({ kind: 'volume', text: 'این هفته حجم تمرینت ۱۲٪ بیشتر از همین وقتِ هفته‌ی قبل است.' })
  })
  it('else the streak, else the sessions this week, else a nudge', () => {
    const ws = [W('a', '2026-10-15'), W('b', '2026-10-20'), W('c', '2026-10-25')]
    const ss = [S('a', 'squat', 100, 5), S('b', 'squat', 100, 5), S('c', 'squat', 90, 5)]
    expect(motivation(ws, ss, TODAY).kind).toBe('streak')
    expect(motivation([W('c', '2026-10-25')], [S('c', 'squat', 90, 5)], TODAY).text).toBe('این هفته ۱ جلسه تمرین کرده‌ای.')
    expect(motivation([W('a', '2026-09-01')], [], TODAY).kind).toBe('back')
    expect(motivation([], [], TODAY).kind).toBe('start')
  })
})

describe('the main lifts', () => {
  it('takes the most-trained lifts with an estimate, with best and change', () => {
    const ws = [W('a', '2026-10-01'), W('b', '2026-10-08'), W('c', '2026-10-15')]
    const ss = [S('a', 'bench', 60, 5), S('b', 'bench', 62.5, 5), S('c', 'bench', 65, 5), S('a', 'plank', 0, 60), S('b', 'plank', 0, 60), S('c', 'plank', 0, 60), S('c', 'squat', 100, 5)]
    const lifts = mainLifts(ws, ss, 3)
    expect(lifts.map(l => l.exercise_id)).toEqual(['bench', 'squat'])   // the plank has no estimate
    expect(lifts[0]).toMatchObject({ best: { e1rm: 75.8, date: '2026-10-15' }, change: 5.8 })
    expect(lifts[0].points.map(p => p.date)).toEqual(['2026-10-01', '2026-10-08', '2026-10-15'])
    expect(lifts[1].change).toBeNull()
  })
})

describe('protein kept', () => {
  it('counts the days of the last week that reached the target', () => {
    const logs = [{ date: '2026-10-29', protein: 100 }, { date: '2026-10-29', protein: 85 }, { date: '2026-10-27', protein: '180' }, { date: '2026-10-25', protein: 120 }, { date: '2026-10-20', protein: 300 }]
    const p = proteinAdherence(logs, 180, TODAY)
    expect(p).toMatchObject({ hit: 2, of: 7, share: 2 / 7 })
    expect(p.days.map(d => d.date)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'])
    expect(p.days.map(d => d.hit)).toEqual([false, false, false, false, true, false, true])
  })
  it('has nothing to say without a target', () => {
    expect(proteinAdherence([], 0, TODAY)).toBeNull()
    expect(proteinAdherence([], null, TODAY)).toBeNull()
  })
})
