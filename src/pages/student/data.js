// The signed-in student's plan, loaded once per screen.
import { supabase, must } from '../../lib/supabase.js'
import { toDraft } from '../../lib/plan.js'
import { loadExercises } from '../../lib/exercises.js'
import { scope } from '../../lib/scope.js'

export async function loadPlan() {
  await loadExercises()
  const routines = await must(supabase.from('routines').select('*').eq('student_id', scope.student))
  const items = routines.length ? await must(supabase.from('routine_items').select('*').in('routine_id', routines.map(r => r.id))) : []
  return toDraft(routines, items).map((r, i) => ({ ...r, position: i }))
}
