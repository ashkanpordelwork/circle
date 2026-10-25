import { describe, it, expect } from 'vitest'
import { toCsv, workoutsCsv, weightsCsv } from './export.js'

const lines = csv => csv.slice(1).split('\r\n')

describe('export', () => {
  it('quotes what would break a CSV and starts with a BOM', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'he said "hi"'], ['line\nbreak', null]])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(lines(csv)).toEqual(['a,b', '"x,y","he said ""hi"""', '"line\nbreak",'])
  })
  it('one row per set, newest first; a workout with no sets still gets a row', () => {
    const names = { a: 'علی', b: 'سارا' }
    const ws = [
      { student_id: 'a', date: '2026-10-20', routine_name: 'پا', note: 'خوب بود', workout_sets: [
        { exercise_id: 'squat', set_index: 2, weight: 60, reps: 8 }, { exercise_id: 'squat', set_index: 1, weight: 50, reps: 10 }] },
      { student_id: 'b', date: '2026-10-24', routine_name: 'کل بدن', note: '', workout_sets: [] }
    ]
    const rows = lines(workoutsCsv(ws, names, id => id === 'squat' ? 'اسکات' : id))
    expect(rows[0].split(',')[0]).toBe('شاگرد')
    expect(rows.slice(1).map(r => r.split(','))).toEqual([
      ['سارا', '1405/08/02', '2026-10-24', 'کل بدن', '', '', '', '', ''],
      ['علی', '1405/07/28', '2026-10-20', 'پا', 'اسکات', '1', '50', '10', 'خوب بود'],
      ['علی', '1405/07/28', '2026-10-20', 'پا', 'اسکات', '2', '60', '8', '']
    ])
  })
  it('body weights', () => {
    expect(lines(weightsCsv([{ student_id: 'a', date: '2026-10-20', weight: 82.5 }], { a: 'علی' }))[1]).toBe('علی,1405/07/28,2026-10-20,82.5')
  })
})
