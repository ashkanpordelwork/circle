// «محاسبه‌گر نیاز روزانه»: calories and protein for a day, from body and goal (SPEC §3.8).
// Mifflin-St Jeor for the resting burn, an activity factor on top, then the goal.
import { toJalali } from './jalali.js'

export const GOALS = { fat_loss: 'کاهش چربی', muscle: 'عضله‌سازی', health: 'سلامت و انرژی' }
export const ACTIVITY = { low: 'بیشتر نشسته', mid: 'متوسط', high: 'زیاد' }
const FACTOR = { low: 1.2, mid: 1.375, high: 1.55 }
const GOAL_CHANGE = { fat_loss: -0.15, muscle: 0.1, health: 0 }
const PROTEIN_PER_KG = { fat_loss: 2.0, muscle: 1.8, health: 1.4 }

// A birth year in either calendar: under 1700 it is Jalali (۱۳۷۰), else Gregorian (1991).
export function ageOf(birthYear, today = new Date()) {
  const y = Number(birthYear)
  const [jy] = toJalali(today.getFullYear(), today.getMonth() + 1, today.getDate())
  return y < 1700 ? jy - y : today.getFullYear() - y
}

const round = (v, step) => Math.round(v / step) * step

// What is missing or out of range, in Persian; [] when the input can be worked out.
export function checkInput({ sex, birthYear, height, weight, goal, activity, days }, today = new Date()) {
  const errors = []
  if (!['male', 'female'].includes(sex)) errors.push('جنسیت را انتخاب کن.')
  const age = ageOf(birthYear, today)
  if (!birthYear || !(age >= 13 && age <= 90)) errors.push('سال تولد را درست بنویس (مثلاً ۱۳۷۵).')
  if (!(height >= 120 && height <= 230)) errors.push('قد باید بین ۱۲۰ تا ۲۳۰ سانتی‌متر باشد.')
  if (!(weight >= 30 && weight <= 250)) errors.push('وزن باید بین ۳۰ تا ۲۵۰ کیلو باشد.')
  if (!GOALS[goal]) errors.push('هدفت را انتخاب کن.')
  if (!ACTIVITY[activity]) errors.push('فعالیت روزانه‌ات را انتخاب کن.')
  if (days != null && days !== '' && ![3, 4, 5].includes(Number(days))) errors.push('روزهای تمرین ۳، ۴ یا ۵ است.')
  return errors
}

// → { bmr, tdee, calories, protein }: calories rounded to 50, protein to 5 grams.
// days: training days a week; 4 or 5 add 0.1 to the activity factor.
export function dailyNeeds({ sex, birthYear, height, weight, goal, activity, days }, today = new Date()) {
  const age = ageOf(birthYear, today)
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161)
  const factor = FACTOR[activity] + (Number(days) >= 4 ? 0.1 : 0)
  const tdee = bmr * factor
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories: round(tdee * (1 + GOAL_CHANGE[goal]), 50),
    protein: round(weight * PROTEIN_PER_KG[goal], 5)
  }
}
