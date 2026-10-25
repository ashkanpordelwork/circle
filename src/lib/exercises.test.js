import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import { setExercises, exerciseName, exerciseNameEn, searchExercises, normText } from './exercises.js'

const all = JSON.parse(fs.readFileSync(new URL('../../public/exercises.json', import.meta.url), 'utf8'))
beforeAll(() => setExercises(all))

describe('exercise library in Persian', () => {
  it('every exercise has a Persian name and Persian steps', () => {
    for (const x of all) {
      expect(x.f, x.id).toMatch(/[؀-ۿ]/)
      expect(x.st.length, x.id).toBeGreaterThan(0)
      // Steps are Persian prose; only equipment brands like EZ / TRX stay Latin.
      for (const s of x.st) expect(s.replace(/EZ|TRX/g, ''), x.id).not.toMatch(/[A-Za-z]{3,}/)
    }
  })

  it('names: Persian first, English kept, unknown ids still readable', () => {
    expect(exerciseName('Barbell_Curl')).toBe('جلو بازو هالتر')
    expect(exerciseNameEn('Barbell_Curl')).toBe('Barbell Curl')
    expect(exerciseName('Gone_From_Upstream')).toBe('Gone From Upstream')
  })

  it('search finds Persian, English and run-together Persian words', () => {
    const ids = q => searchExercises(all, q).map(x => x.id)
    expect(ids('پرس سینه هالتر')).toContain('Barbell_Bench_Press_-_Medium_Grip')
    expect(ids('bench press')).toContain('Barbell_Bench_Press_-_Medium_Grip')
    expect(ids('جلوبازو هالتر')).toContain('Barbell_Curl')
    expect(ids('اسكوات')).toContain('Barbell_Squat')   // Arabic kāf typed on a non-Persian keyboard
    expect(ids('سینه').length).toBeGreaterThan(20)
  })

  it('normalises Arabic letters, half-spaces and Persian digits', () => {
    expect(normText('يك‌طرفه ۹۰')).toBe('یک طرفه 90')
  })
})
