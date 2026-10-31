import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import { setExercises, exerciseById, exerciseName, exerciseNameEn, searchExercises, normText, thumbUrl, gifUrl, MUSCLES } from './exercises.js'

const all = JSON.parse(fs.readFileSync(new URL('../../public/exercises.json', import.meta.url), 'utf8'))
let list
beforeAll(() => { list = setExercises(all) })

describe('exercise library in Persian', () => {
  it('offers the openGym library, each with a Persian name, a picture and Circle muscle words', () => {
    expect(list.filter(x => x.gif).length).toBe(1324)
    for (const x of list) {
      expect(x.f, x.id).toMatch(/[؀-ۿ]/)
      expect(thumbUrl(x), x.id).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\//)
      for (const m of [...x.m, ...x.s]) expect(MUSCLES[m], `${x.id} ${m}`).toBeTruthy()
      // Steps, where there are any, are Persian prose; only equipment brands like EZ / TRX stay Latin.
      for (const s of x.st) expect(s.replace(/EZ|TRX/g, ''), x.id).not.toMatch(/[A-Za-z]{3,}/)
    }
    expect(gifUrl(exerciseById('0025'))).toMatch(/videos\/0025-.*\.gif$/)
  })

  it('an old id answers as its twin; one without a twin still shows, but is not offered', () => {
    expect(exerciseById('Barbell_Bench_Press_-_Medium_Grip').id).toBe('0025')
    expect(exerciseName('Barbell_Bench_Press_-_Medium_Grip')).toBe('پرس سینه هالتر')
    expect(exerciseName('Atlas_Stones')).toMatch(/[؀-ۿ]/)
    expect(list.some(x => x.id === 'Atlas_Stones' || x.id === 'Barbell_Bench_Press_-_Medium_Grip')).toBe(false)
    expect(list.some(x => x.id === 'Plank')).toBe(true)   // an everyday move the new library lacks
  })

  it('names: Persian first, English kept, unknown ids still readable', () => {
    expect(exerciseName('0031')).toBe('جلو بازو هالتر')
    expect(exerciseNameEn('0031')).toBe('Barbell curl')
    expect(exerciseName('Gone_From_Upstream')).toBe('Gone From Upstream')
  })

  it('every offered Persian name is different', () => {
    const seen = new Map()
    for (const x of list) { expect(seen.get(x.f), `${x.id} ${x.f}`).toBeUndefined(); seen.set(x.f, x.id) }
  })

  it('search finds Persian, English and run-together Persian words', () => {
    const ids = q => searchExercises(list, q).map(x => x.id)
    expect(ids('پرس سینه هالتر')).toContain('0025')
    expect(ids('bench press')).toContain('0025')
    expect(ids('جلوبازو هالتر')).toContain('0031')
    expect(ids('اسكوات')).toContain('0043')   // Arabic kāf typed on a non-Persian keyboard
    expect(ids('سینه').length).toBeGreaterThan(20)
  })

  it('normalises Arabic letters, half-spaces and Persian digits', () => {
    expect(normText('يك‌طرفه ۹۰')).toBe('یک طرفه 90')
  })
})
