import { describe, expect, it } from 'vitest'
import { toDraft, toPayload, blankLog, logToRows, summarize, routinesForDay, isEmail, WEEK, fmtTarget, setText, showNum, readNum, needsWeight, canTick, normTempo, fmtTempo, tempoWords } from './plan.js'

const routines = [{ id: 'r2', name: 'B', days: [1], position: 1 }, { id: 'r1', name: 'A', days: [6, 3], position: 0 }]
const items = [
  { routine_id: 'r1', exercise_id: 'Squat', sets: 3, reps: '8-10', weight: 60, rest_sec: null, note: '', position: 1 },
  { routine_id: 'r1', exercise_id: 'Lunge', sets: 2, reps: '12', weight: null, rest_sec: 90, note: 'x', position: 0 }
]

describe('plan helpers', () => {
  it('week starts on Saturday', () => expect(WEEK[0]).toBe(6))
  it('toDraft orders routines and items by position', () => {
    const d = toDraft(routines, items)
    expect(d.map(r => r.id)).toEqual(['r1', 'r2'])
    expect(d[0].items.map(i => i.exercise_id)).toEqual(['Lunge', 'Squat'])
    expect(d[0].items[0].weight).toBe('')
  })
  it('toPayload turns blanks into null and clamps sets', () => {
    const p = toPayload([{ id: 'r', name: '  ', days: [3, 3, 9], items: [{ exercise_id: 'e', sets: '99', reps: '', weight: '', rest_sec: '60', note: '' }] }])
    expect(p[0].name).toBe('برنامه')
    expect(p[0].days).toEqual([3])
    expect(p[0].items[0]).toMatchObject({ sets: 20, reps: '10', weight: null, rest_sec: 60 })
  })
  it('routinesForDay', () => expect(routinesForDay(routines, 3).map(r => r.id)).toEqual(['r1']))
  it('blankLog prefills reps; the weight starts empty with last time (or the plan) as a hint', () => {
    const r = toDraft(routines, items)[0]
    const log = blankLog(r, [{ exercise_id: 'Squat', set_index: 1, reps: 9, weight: 65 }])
    expect(log[1].sets).toHaveLength(3)
    expect(log[1].sets[0]).toMatchObject({ reps: 9, weight: '', hint: 65 })
    expect(log[1].sets[1]).toMatchObject({ reps: 8, weight: '', hint: 60 })
  })
  it('a set can be ticked only once its weight is in (reps for bodyweight work)', () => {
    expect(needsWeight({ weight: 60 }, 'barbell')).toBe(true)
    expect(needsWeight({ weight: '' }, 'barbell')).toBe(true)
    expect(needsWeight({ weight: '' }, 'body only')).toBe(false)
    expect(needsWeight({ weight: 10 }, 'body only')).toBe(true)   // weighted pull-ups
    expect(canTick({ weight: '', reps: 8 }, true)).toBe(false)
    expect(canTick({ weight: '۶۰', reps: 8 }, true)).toBe(true)
    expect(canTick({ weight: 0, reps: 8 }, true)).toBe(true)
    expect(canTick({ weight: '', reps: '' }, false)).toBe(false)
    expect(canTick({ weight: '', reps: 12 }, false)).toBe(true)
  })
  it('tempo: four phases, stored compact, shown with dashes and in words', () => {
    expect(normTempo('3-1-x-0')).toBe('31X0')
    expect(normTempo('۳۰۱۰')).toBe('3010')
    expect(normTempo('301')).toBe('')
    expect(fmtTempo('3010')).toBe('۳-۰-۱-۰')
    expect(tempoWords('3010')).toBe('۳ ثانیه پایین آوردن · بدون مکث پایین · ۱ ثانیه بالا بردن · بدون مکث بالا')
    expect(tempoWords('20X0')).toContain('بالا بردن انفجاری')
    expect(fmtTarget({ sets: 4, reps: '8', weight: '', tempo: '3010' })).toBe('۴ × ۸ · تمپو ۳-۰-۱-۰')
    const p = toPayload([{ id: 'r', name: 'x', days: [], items: [{ exercise_id: 'e', sets: 3, reps: '8', weight: '', rest_sec: '', tempo: '3-1-1-0', note: '' }] }])
    expect(p[0].items[0].tempo).toBe('3110')
  })
  it('logToRows keeps only ticked sets and numbers them', () => {
    const rows = logToRows('w', [{ exercise_id: 'e', sets: [{ done: false, reps: 5, weight: 1 }, { done: true, reps: '8', weight: '' }] }])
    expect(rows).toEqual([{ workout_id: 'w', exercise_id: 'e', set_index: 1, reps: 8, weight: null }])
  })
  it('summarize', () => {
    const s = summarize([{ exercise_id: 'e', reps: 10, weight: 50 }, { exercise_id: 'e', reps: 8, weight: 60 }]).get('e')
    expect(s).toMatchObject({ sets: 2, volume: 980 })
    expect(s.best.weight).toBe(60)
  })
  it('reads Persian digits and decimal comma', () => {
    const p = toPayload([{ id: 'r', name: 'x', days: [], items: [{ exercise_id: 'e', sets: '۴', reps: '۸-۱۰', weight: '۶۲٫۵', rest_sec: '', note: '' }] }])
    expect(p[0].items[0]).toMatchObject({ sets: 4, reps: '8-10', weight: 62.5 })
    expect(logToRows('w', [{ exercise_id: 'e', sets: [{ done: true, reps: '۱۲', weight: '۴۰' }] }])[0]).toMatchObject({ reps: 12, weight: 40 })
  })
  it('display text uses Persian digits throughout', () => {
    expect(fmtTarget({ sets: 3, reps: '8-12', weight: 62.5 })).toBe('۳ × ۸-۱۲ · ۶۲٫۵ کیلو')
    expect(fmtTarget({ sets: 4, reps: '10', weight: '' })).toBe('۴ × ۱۰')
    expect(setText({ reps: 10, weight: 60 })).toBe('۶۰ کیلو × ۱۰')
    expect(setText({ reps: 15, weight: null })).toBe('۱۵ تکرار')
    expect(fmtTarget({ sets: '۴', reps: '۸', weight: '۶۰' })).toBe('۴ × ۸ · ۶۰ کیلو')   // typed on a Persian keyboard
    expect(readNum(showNum('62.5'))).toBe('62.5')
  })
  it('isEmail', () => { expect(isEmail('a@gmail.com')).toBe(true); expect(isEmail('a@b')).toBe(false) })
})

