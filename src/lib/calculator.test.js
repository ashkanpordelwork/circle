import { describe, it, expect } from 'vitest'
import { ageOf, checkInput, dailyNeeds } from './calculator.js'

const TODAY = new Date(2026, 9, 31)   // 9 آبان ۱۴۰۵
const base = { sex: 'male', birthYear: 1375, height: 180, weight: 80, goal: 'health', activity: 'low', days: 3 }

describe('daily needs calculator', () => {
  it('reads a Jalali or a Gregorian birth year', () => {
    expect(ageOf(1375, TODAY)).toBe(30)
    expect(ageOf(1996, TODAY)).toBe(30)
  })

  it('Mifflin-St Jeor, times the activity factor', () => {
    // 10×80 + 6.25×180 − 5×30 + 5 = 1780; ×1.2 = 2136 → 2150
    expect(dailyNeeds(base, TODAY)).toEqual({ bmr: 1780, tdee: 2136, calories: 2150, protein: 110 })
    // Woman: −161 instead of +5 → 1614; ×1.375 = 2219 → 2200
    expect(dailyNeeds({ ...base, sex: 'female', activity: 'mid' }, TODAY).calories).toBe(2200)
  })

  it('four or five training days add 0.1 to the factor', () => {
    // 1780 × 1.3 = 2314 → 2300
    expect(dailyNeeds({ ...base, days: 4 }, TODAY).calories).toBe(2300)
    expect(dailyNeeds({ ...base, days: 5 }, TODAY).tdee).toBe(2314)
  })

  it('the goal moves calories and protein', () => {
    // 2136 × 0.85 = 1816 → 1800; 80 × 2.0 = 160
    expect(dailyNeeds({ ...base, goal: 'fat_loss' }, TODAY)).toMatchObject({ calories: 1800, protein: 160 })
    // 2136 × 1.1 = 2350 → 2350; 80 × 1.8 = 144 → 145
    expect(dailyNeeds({ ...base, goal: 'muscle' }, TODAY)).toMatchObject({ calories: 2350, protein: 145 })
  })

  it('says what is missing, in Persian', () => {
    expect(checkInput(base, TODAY)).toEqual([])
    expect(checkInput({ ...base, sex: '', height: 90, goal: 'x' }, TODAY)).toEqual([
      'جنسیت را انتخاب کن.', 'قد باید بین ۱۲۰ تا ۲۳۰ سانتی‌متر باشد.', 'هدفت را انتخاب کن.'])
    expect(checkInput({ ...base, birthYear: '' }, TODAY)[0]).toMatch(/سال تولد/)
  })
})
