import { describe, it, expect } from 'vitest'
import { QUESTIONS, visibleQuestions, toggle, problem, isComplete, tidy, levelOf, needsAttention, calculatorInput, answerText, optionsOf, question } from './questionnaire.js'

const full = {
  sex: 'female', birth_year: 1370, height: 165, weight: 62, goal: 'fat_loss', experience: '6m2y', break: 'lt3m',
  place: 'home', home_gear: ['chair', 'table'], days: 3, weekdays: [6, 1, 3], session_min: 45,
  pain: ['knee'], pain_note: 'زانوی چپ', conditions: ['none'], activity: 'mid', sleep: '6to7'
}

describe('the questionnaire', () => {
  it('has the 17 questions of the spec, in order', () => {
    expect(QUESTIONS.map(q => q.key)).toEqual(['sex', 'birth_year', 'height', 'weight', 'goal', 'experience', 'break', 'place',
      'home_gear', 'days', 'weekdays', 'session_min', 'pain', 'conditions', 'activity', 'sleep', 'quit_reason'])
    for (const q of QUESTIONS) expect(q.why, q.key).toBeTruthy()
  })

  it('asks a follow-up only when it applies', () => {
    const keys = a => visibleQuestions(a).map(q => q.key)
    expect(keys({ experience: 'none', place: 'gym' })).not.toContain('break')
    expect(keys({ experience: 'none', place: 'gym' })).not.toContain('home_gear')
    expect(keys({ experience: 'gt2y', place: 'home' })).toEqual(expect.arrayContaining(['break', 'home_gear']))
  })

  it('«ندارم» stands alone in a list', () => {
    expect(toggle(['knee', 'back'], 'none')).toEqual(['none'])
    expect(toggle(['none'], 'knee')).toEqual(['knee'])
    expect(toggle(['knee', 'back'], 'knee')).toEqual(['back'])
  })

  it('says what is missing, in Persian', () => {
    expect(problem(question('sex'), {})).toBe('یکی را انتخاب کن.')
    expect(problem(question('height'), { height: 90 })).toBe('عددی بین ۱۲۰ و ۲۳۰ بنویس.')
    expect(problem(question('birth_year'), { birth_year: 1300 })).toMatch(/سال تولد/)
    expect(problem(question('weekdays'), { days: 3, weekdays: [6, 1] })).toBe('۳ روز انتخاب کن.')
    expect(problem(question('weekdays'), { days: 3, weekdays: [6, 1, 3] })).toBeNull()
    expect(problem(question('quit_reason'), {})).toBeNull()   // optional
  })

  it('is complete once every question that applies is answered', () => {
    expect(isComplete(full)).toBe(true)
    expect(isComplete({ ...full, sleep: undefined })).toBe(false)
    expect(isComplete({ ...full, place: 'gym', home_gear: undefined })).toBe(true)
  })

  it('drops answers that no longer apply', () => {
    const t = tidy({ ...full, place: 'gym', days: 4 })
    expect(t.home_gear).toBeUndefined()   // a gym-goer has no home gear
    expect(t.weekdays).toBeUndefined()    // three weekdays no longer fit four days
    expect(t.pain_note).toBe('زانوی چپ')
    expect(tidy({ ...full, experience: 'none' }).break).toBeUndefined()
    expect(tidy({ ...full, sex: 'male', conditions: ['pregnancy', 'asthma'] }).conditions).toEqual(['asthma'])
  })

  it('works out the level as the spec says', () => {
    expect(levelOf({ experience: 'none' })).toBe('beginner')
    expect(levelOf({ experience: 'lt6m', break: 'training' })).toBe('beginner')
    expect(levelOf({ experience: 'gt2y', break: 'gt3m' })).toBe('beginner')   // away too long
    expect(levelOf({ experience: '6m2y', break: 'lt3m' })).toBe('intermediate')
    expect(levelOf({})).toBeNull()
  })

  it('flags the conditions that need a doctor first', () => {
    expect(needsAttention({ conditions: ['asthma'] })).toBe(false)
    expect(needsAttention({ conditions: ['asthma', 'hypertension'] })).toBe(true)
    expect(needsAttention({ conditions: ['surgery'] })).toBe(true)
  })

  it('feeds the calculator and reads back in Persian', () => {
    expect(calculatorInput(full)).toEqual({ sex: 'female', birthYear: 1370, height: 165, weight: 62, goal: 'fat_loss', activity: 'mid', days: 3 })
    expect(answerText(question('weekdays'), full)).toBe('شنبه، دوشنبه، چهارشنبه')
    expect(answerText(question('pain'), full)).toBe('زانو (زانوی چپ)')
    expect(answerText(question('height'), full)).toBe('۱۶۵ سانتی‌متر')
    expect(optionsOf(question('conditions'), { sex: 'male' }).some(([k]) => k === 'pregnancy')).toBe(false)
  })
})
