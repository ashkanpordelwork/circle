import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { TEMPLATES } from './templates.js'
import { RULES } from './smart.js'

const ids = new Set(JSON.parse(readFileSync(new URL('../../public/exercises.json', import.meta.url))).map(x => x.id))

describe('ready-made routines', () => {
  it('use only exercises the library has, with a rule each', () => {
    for (const t of TEMPLATES) for (const i of t.items) {
      expect(ids.has(i.exercise_id), `${t.key}: ${i.exercise_id}`).toBe(true)
      expect(RULES).toContain(i.progression)
    }
  })
  it('climb a rep range by double progression', () => {
    for (const t of TEMPLATES) for (const i of t.items) if (i.reps.includes('-')) expect(i.progression).toBe('double')
  })
})
