// Nutrition and supplements (0011_nutrition.sql).
//
// Until that migration has run, its tables and save_nutrition_plan() are not there. The screens
// that use them ask missingMigration() about any error: if it says so, they hide the nutrition
// parts and show NUTRITION_SETUP instead of breaking.

const MISSING = /Could not find the (table|function)|relation .* does not exist|schema cache/i

// Is this error "the table or function is not there yet"? (PostgREST answers PGRST205 for a table,
// PGRST202 for a function; Postgres itself 42P01 / 42883.)
export function missingMigration(error) {
  if (!error) return false
  return ['PGRST205', 'PGRST202', '42P01', '42883'].includes(error.code) || MISSING.test(String(error.message || ''))
}

export const NUTRITION_SETUP = 'تغذیه و مکمل هنوز فعال نشده: فایل 0011_nutrition.sql را یک بار در Supabase اجرا کن.'
