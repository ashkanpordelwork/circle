import './og/test-library.js'
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { extractCode, validatePlan, matchExercise, indexLibrary, previewPlan, unresolved, routineItems, PLAN_PROMPT } from './importPlan.js'
import { setExercises } from './exercises.js'

// What the page gets from loadExercises(): only the exercises on offer.
const LIB = setExercises(JSON.parse(readFileSync(new URL('../../public/exercises.json', import.meta.url))))
const INDEX = indexLibrary(LIB)

// The example from the brief: five days of training, five meals, three supplements.
const day = (name, days, exercises) => ({ name, days, exercises: exercises.map(([n, sets, reps, rest]) => ({ name: n, sets, reps, rest_sec: rest, note: '' })) })
const item = (name, amount, calories, protein, carbs, fat) => ({ name, amount, calories, protein, carbs, fat })
const SAMPLE = {
  version: 1,
  workouts: [
    day('روز ۱ - سینه و پشت بازو', ['شنبه'], [['Barbell Bench Press', 4, '6-8', 120], ['Incline Dumbbell Press', 3, '8-10', 90], ['Tricep Pushdown', 3, '10-12', 60]]),
    day('روز ۲ - پشت و جلو بازو', ['یکشنبه'], [['Lat Pulldown', 4, '8-10', 90], ['Barbell Row', 4, '6-8', 120], ['Hammer Curl', 3, '10-12', 60]]),
    day('روز ۳ - پا', ['دوشنبه'], [['Back Squat', 4, '5', 180], ['Romanian Deadlift', 3, '8', 120], ['Leg Curl', 3, '12', 60]]),
    day('روز ۴ - سرشانه', ['چهارشنبه'], [['Overhead Press', 4, '6-8', 120], ['Lateral Raise', 4, '12-15', 45], ['Face Pull', 3, '15', 45]]),
    day('روز ۵ - کل بدن', ['پنج‌شنبه'], [['Deadlift', 3, '5', 180], ['Pull Up', 3, '8', 90], ['Plank', 3, '45', 45]])
  ],
  nutrition: {
    targets: { calories: 2800, protein: 180, carbs: 320, fat: 80 },
    meals: [
      { name: 'صبحانه', time: '08:00', items: [item('تخم‌مرغ', '۴ عدد', 280, 24, 2, 20), item('نان سبوس‌دار', '۲ کف دست', 200, 7, 38, 3)] },
      { name: 'میان‌وعده', time: '11:00', items: [item('ماست یونانی', '۲۰۰ گرم', 190, 20, 8, 9)] },
      { name: 'ناهار', time: '14:00', items: [item('مرغ', '۲۰۰ گرم', 330, 62, 0, 7), item('برنج', '۲۰۰ گرم', 260, 5, 56, 1)] },
      { name: 'بعد از تمرین', time: '18:30', items: [item('شیک پروتئین', '۱ اسکوپ', 120, 25, 3, 1), item('موز', '۱ عدد', 105, 1, 27, 0)] },
      { name: 'شام', time: '21:00', items: [item('ماهی', '۱۸۰ گرم', 300, 40, 0, 15)] }
    ]
  },
  supplements: [
    { name: 'کراتین', dose: '۵ گرم', times: ['بعد از تمرین'] },
    { name: 'ویتامین D', dose: '۱۰۰۰ واحد', times: ['08:00'] },
    { name: 'امگا ۳', dose: '۱ عدد', times: ['ناهار', 'شام'] }
  ]
}

describe('getting the code out of pasted text', () => {
  it('takes it from a ``` block surrounded by chat', () => {
    const text = 'بفرما، برنامه‌ات:\n```json\n' + JSON.stringify(SAMPLE, null, 2) + '\n```\nموفق باشی!'
    expect(extractCode(text).data.workouts).toHaveLength(5)
  })
  it('takes the outermost braces when there is no block', () => {
    expect(extractCode('این هم کد: {"version":1,"workouts":[]} تمام').data).toEqual({ version: 1, workouts: [] })
  })
  it('forgives curly quotes, Persian digits in numbers and a trailing comma', () => {
    expect(extractCode('{“version”: ۱, “workouts”: [],}').data).toEqual({ version: 1, workouts: [] })
  })
  it('says what is wrong in Persian when there is nothing usable', () => {
    expect(extractCode('   ').error).toMatch(/بچسبان/)
    expect(extractCode('سلام، برنامه‌ات آماده است').error).toMatch(/کدی پیدا نشد/)
    expect(extractCode('{"version": 1, "workouts": [').error).toMatch(/کامل نیست/)
  })
})

describe('checking the plan', () => {
  it('accepts the full example and cleans it', () => {
    const { plan, errors } = validatePlan(SAMPLE)
    expect(errors).toEqual([])
    expect(plan.workouts[0]).toMatchObject({ name: 'روز ۱ - سینه و پشت بازو', days: [6] })
    expect(plan.workouts[4].days).toEqual([4])                 // «پنج‌شنبه» with a half-space
    expect(plan.nutrition.targets).toEqual({ calories: 2800, protein: 180, carbs: 320, fat: 80 })
    expect(plan.supplements[1].times).toEqual(['08:00'])
  })
  it('takes numbers written as text, in Persian digits', () => {
    const { plan } = validatePlan({ version: 1, workouts: [{ name: 'الف', exercises: [{ name: 'Squat', sets: '۴', reps: '۸-۱۰', rest_sec: '۹۰' }] }],
      nutrition: { targets: { calories: '۲۵۰۰', protein: '۱۵۰', carbs: 300, fat: 70 }, meals: [{ name: 'شام', time: '۲۱:۰۰', items: [] }] } })
    expect(plan.workouts[0].exercises[0]).toMatchObject({ sets: 4, reps: '8-10', rest_sec: 90 })
    expect(plan.nutrition.targets.calories).toBe(2500)
    expect(plan.nutrition.meals[0].time).toBe('21:00')
  })
  it('leaves days out when there are none: sessions go in order', () => {
    expect(validatePlan({ workouts: [{ name: 'الف', exercises: [{ name: 'Squat', sets: 3, reps: 5 }] }] }).plan.workouts[0].days).toEqual([])
  })
  it('names each problem and where it is, in Persian', () => {
    const { errors } = validatePlan({ version: 2, workouts: [{ name: '', days: ['فردا'], exercises: [{ name: 'Squat', sets: 0, reps: 'زیاد' }] }],
      nutrition: { targets: { calories: 'خیلی', protein: 1, carbs: 1, fat: 1 }, meals: [{ name: 'صبحانه', time: 'صبح', items: [{ name: 'نان', calories: -1 }] }] },
      supplements: [{ dose: '۵ گرم' }] })
    expect(errors).toEqual([
      'نسخه‌ی 2 پشتیبانی نمی‌شود؛ نسخه باید ۱ باشد.',
      'تمرین ۱: نام ندارد.',
      'تمرین ۱: روز «فردا» شناخته نشد.',
      'تمرین ۱، حرکت ۱: تعداد ست باید عددی از ۱ تا ۲۰ باشد.',
      'تمرین ۱، حرکت ۱: تکرار باید عدد یا بازه باشد، مثلاً 8 یا "6-8".',
      'هدف روزانه: کالری باید عدد باشد.',
      'وعده ۱: زمان «صبح» باید مثل 08:00 باشد.',
      'وعده ۱، قلم ۱: «calories» باید عدد باشد.',
      'مکمل ۱: نام ندارد.'
    ])
  })
  it('refuses a code with nothing in it', () => {
    expect(validatePlan({ version: 1 }).errors).toEqual(['کد هیچ تمرین، وعده یا مکملی ندارد.'])
    expect(validatePlan([]).errors[0]).toMatch(/شیء JSON/)
  })
})

describe('matching exercise names to the library', () => {
  const m = name => matchExercise(name, INDEX)
  it('is sure of the library\'s own names, in English or Persian, ignoring case and spacing', () => {
    expect(m('Barbell Squat')).toMatchObject({ status: 'sure', exercise_id: '0043' })
    expect(m('barbell   squat')).toMatchObject({ status: 'sure', exercise_id: '0043' })
    expect(m('اسکوات هالتر')).toMatchObject({ status: 'sure', exercise_id: '0043' })
    expect(m('Leg Press')).toMatchObject({ status: 'sure', exercise_id: '0739' })
    expect(m('dumbbell hammer curl')).toMatchObject({ status: 'sure', exercise_id: '0313' })
  })
  it('is sure of the common names an AI writes, mapped to the plain lift', () => {
    expect(m('Barbell Bench Press').exercise_id).toBe('0025')
    expect(m('Lat Pulldown').exercise_id).toBe('0150')
    expect(m('OHP').exercise_id).toBe('1457')
    expect(m('Pull-Ups').exercise_id).toBe('0652')
    expect(m('Chest Fly').exercise_id).toBe('0308')
    expect(m('Plank').exercise_id).toBe('Plank')                  // no twin in the new library: the old entry stays on offer
  })
  it('offers a close name for a yes, with other candidates', () => {
    const r = m('Barbel Hip Thrusts')                           // a typo and a plural
    expect(r.status === 'sure' || r.status === 'maybe').toBe(true)
    expect(r.exercise_id).toBe('Barbell_Hip_Thrust')
    const q = m('Cable Fly Crossover')
    expect(q.status).toBe('maybe')
    expect(q.candidates.length).toBeGreaterThan(0)
  })
  it('says when nothing is close', () => {
    expect(m('Zercher Carry Pogo')).toMatchObject({ status: 'missing' })
    expect(m('')).toMatchObject({ status: 'missing', candidates: [] })
  })
})

describe('the preview', () => {
  it('imports the full example without errors, in three groups', () => {
    const { preview, errors } = previewPlan('```\n' + JSON.stringify(SAMPLE) + '\n```', LIB)
    expect(errors).toEqual([])
    expect(preview.workouts).toHaveLength(5)
    expect(preview.nutrition.meals).toHaveLength(5)
    expect(preview.supplements).toHaveLength(3)
    const { sure, maybe, missing } = preview.counts
    expect(sure + maybe + missing).toBe(15)
    expect(sure).toBeGreaterThanOrEqual(13)
  })
  it('is ready once every exercise is settled, and turns a workout into routine items', () => {
    const { preview } = previewPlan(JSON.stringify({ workouts: [{ name: 'الف', exercises: [{ name: 'Squat', sets: 4, reps: '5' }, { name: 'Zercher Carry Pogo', sets: 3, reps: '8-10', rest_sec: 60 }] }] }), LIB)
    expect(unresolved(preview)).toBe(1)
    preview.workouts[0].exercises[1].match = { status: 'sure', exercise_id: '0336', candidates: [] }
    expect(unresolved(preview)).toBe(0)
    expect(routineItems(preview.workouts[0])).toEqual([
      { exercise_id: '0043', sets: 4, reps: '5', weight: '', rest_sec: '', tempo: '', note: '', progression: 'linear' },
      { exercise_id: '0336', sets: 3, reps: '8-10', weight: '', rest_sec: 60, tempo: '', note: '', progression: 'double' }])
  })
  it('passes errors through', () => {
    expect(previewPlan('سلام', LIB).errors[0]).toMatch(/کدی پیدا نشد/)
  })
})

describe('the prompt to copy', () => {
  it('asks for exactly the version 1 shape, in one code block', () => {
    expect(PLAN_PROMPT).toMatch(/"version": 1/)
    expect(PLAN_PROMPT).toMatch(/فقط و فقط یک بلوک کد/)
    const block = /```json\n([\s\S]*?)```/.exec(PLAN_PROMPT)[1]
    expect(validatePlan(JSON.parse(block)).errors).toEqual([])
  })
})
