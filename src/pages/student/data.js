// The signed-in student's plan, loaded once per screen: their monthly programs (if any) and every
// session — program sessions carry program_id / week / session, weekday ones their days.
import { supabase, must } from '../../lib/supabase.js'
import { toDraft } from '../../lib/plan.js'
import { loadExercises } from '../../lib/exercises.js'
import { scope } from '../../lib/scope.js'
import { weekLabel, sessionLabel } from '../../lib/program.js'

export async function loadPlan() {
  await loadExercises()
  const routines = await must(supabase.from('routines').select('*').eq('student_id', scope.student))
  const items = routines.length ? await must(supabase.from('routine_items').select('*').in('routine_id', routines.map(r => r.id))) : []
  return toDraft(routines, items).map((r, i) => ({ ...r, position: i }))
}

// Before migration 0006 there is no programs table: weekday plans only.
export async function loadPrograms() {
  const { data, error } = await supabase.from('programs').select('*').eq('student_id', scope.student).order('start_date')
  return error ? [] : data
}

// Sessions of the coach's programs, the coach's weekday plan (used only while there is no program at
// all), and the athlete's own routines.
export async function loadStudentPlan() {
  const [plan, programs] = await Promise.all([loadPlan(), loadPrograms()])
  const coach = plan.filter(r => r.owner !== 'self')
  return {
    programs,
    sessions: coach.filter(r => r.program_id),
    weekdays: programs.length ? [] : coach.filter(r => !r.program_id),
    mine: plan.filter(r => r.owner === 'self')   // the athlete's own routines (0008_athletes.sql)
  }
}

// What a session is called on the student's screens: «هفته ۲، جلسه ۱», or the weekday plan's name.
export const sessionTitle = r => (r.program_id ? `${weekLabel(r.week)}، ${sessionLabel(r.session)}` : r.name)
