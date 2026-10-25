import { describe, it, expect } from 'vitest'
import { programEnd, weekOf, weekRange, pickPrograms, nextStart, overlaps, weekSessions, weekFilled, setItems, addExercises,
  copyWeek, copySession, resize, seedFrom, seedFromWeekdays, toProgramPayload, studentWeek, newProgramDraft } from './program.js'

const p = { id: 'p1', start_date: '2026-10-23', weeks: 4, per_week: 3 }   // 1 to 28 Aban 1405

describe('program dates', () => {
  it('four weeks from the start, week by week', () => {
    expect(programEnd(p)).toBe('2026-11-19')
    expect([weekOf(p, '2026-10-22'), weekOf(p, '2026-10-23'), weekOf(p, '2026-10-29'), weekOf(p, '2026-10-30'), weekOf(p, '2026-11-19'), weekOf(p, '2026-11-20')])
      .toEqual([null, 1, 1, 2, 4, null])
    expect(weekRange(p, 2)).toEqual(['2026-10-30', '2026-11-05'])
  })
  it('the current, next and past programs; where a new one starts', () => {
    const old = { id: 'p0', start_date: '2026-09-01', weeks: 4, per_week: 3 }
    const later = { id: 'p2', start_date: '2026-11-20', weeks: 4, per_week: 3 }
    const r = pickPrograms([old, later, p], '2026-11-01')
    expect([r.current.id, r.next.id, r.past.map(x => x.id)]).toEqual(['p1', 'p2', ['p0']])
    expect(nextStart([old, p], '2026-11-01')).toBe('2026-11-20')
    expect(nextStart([old], '2026-11-01')).toBe('2026-11-01')
    expect(overlaps([p], '2026-11-15', 4)).toBe(true)
    expect(overlaps([p], '2026-11-20', 4)).toBe(false)
    expect(overlaps([p], '2026-11-15', 4, 'p1')).toBe(false)
  })
})

describe('writing a program', () => {
  const d0 = newProgramDraft({}, '2026-10-23', 4, 3)
  it('sessions appear numbered and fill as exercises are added', () => {
    expect(weekSessions(d0, 1).map(s => [s.session, s.items.length])).toEqual([[1, 0], [2, 0], [3, 0]])
    const d = addExercises(addExercises(d0, 1, 2, ['bench', 'row']), 1, 2, ['curl'])
    expect(weekSessions(d, 1)[1].items.map(i => i.exercise_id)).toEqual(['bench', 'row', 'curl'])
    expect(weekFilled(d, 1)).toBe(1)
    expect(d.sessions).toHaveLength(1)
    expect(d0.sessions).toHaveLength(0)   // never changed in place
  })
  it('copies a week forward, replacing, and one session to other weeks', () => {
    let d = addExercises(addExercises(d0, 1, 1, ['squat']), 1, 2, ['bench'])
    d = addExercises(d, 2, 3, ['run'])
    d = copyWeek(d, 1, [2, 3])
    expect(weekSessions(d, 2).map(s => s.items.map(i => i.exercise_id))).toEqual([['squat'], ['bench'], []])
    expect(weekFilled(d, 3)).toBe(2)
    d = setItems(d, 2, 1, items => items.map(i => ({ ...i, weight: 62.5 })))
    expect(weekSessions(d, 1)[0].items[0].weight).toBe('')   // the copy is its own
    d = copySession(d, 1, 2, [4])
    expect(weekSessions(d, 4).map(s => s.items.length)).toEqual([0, 1, 0])
  })
  it('a shorter program drops what no longer fits', () => {
    const d = resize(addExercises(addExercises(d0, 4, 1, ['a']), 1, 3, ['b']), { weeks: 3, per_week: 2 })
    expect([d.program.weeks, d.program.per_week, d.sessions.length]).toEqual([3, 2, 0])
  })
  it('starts from the last program\'s last week, or from a weekday plan', () => {
    let prev = addExercises(addExercises(d0, 1, 1, ['old']), 4, 1, ['squat'])
    prev = addExercises(prev, 4, 2, ['bench'])
    const d = seedFrom(newProgramDraft({}, '2026-11-20', 4, 2), prev)
    expect([1, 4].map(w => weekSessions(d, w).map(s => s.items.map(i => i.exercise_id)))).toEqual([[['squat'], ['bench']], [['squat'], ['bench']]])
    const wk = [{ days: [1], items: [{ exercise_id: 'mon' }] }, { days: [6], items: [{ exercise_id: 'sat' }] }, { days: [], items: [] }]
    expect(weekSessions(seedFromWeekdays(d0, wk), 3).map(s => s.items.map(i => i.exercise_id))).toEqual([['sat'], ['mon'], []])
  })
  it('saves only sessions with exercises, with clean numbers', () => {
    const d = setItems(addExercises(d0, 2, 1, ['squat']), 2, 1, items => items.map(i => ({ ...i, sets: '۴', reps: '۸', weight: '۶۲٫۵' })))
    expect(toProgramPayload(d)).toEqual([{ id: d.sessions[0].id, week: 2, session: 1, items: [{ exercise_id: 'squat', sets: 4, reps: '8', weight: 62.5, rest_sec: null, tempo: '', note: '' }] }])
  })
})

describe('the student\'s week', () => {
  it('this week\'s sessions in order, what is done, what is next', () => {
    const sessions = [{ id: 's12', program_id: 'p1', week: 1, session: 2 }, { id: 's11', program_id: 'p1', week: 1, session: 1 }, { id: 's21', program_id: 'p1', week: 2, session: 1 }]
    const w = studentWeek(p, sessions, new Set(['s11']), '2026-10-27')
    expect([w.week, w.list.map(s => [s.session, s.done]), w.next.id, w.daysLeft]).toEqual([1, [[1, true], [2, false]], 's12', 3])
    expect(studentWeek(p, sessions, new Set(), '2026-12-01')).toBe(null)
  })
})
