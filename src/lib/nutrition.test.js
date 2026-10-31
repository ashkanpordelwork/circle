import { describe, it, expect } from 'vitest'
import { missingMigration } from './nutrition.js'

describe('before 0011_nutrition.sql has run', () => {
  it('recognises a missing table or function, from PostgREST or Postgres', () => {
    expect(missingMigration({ code: 'PGRST205', message: "Could not find the table 'public.meals' in the schema cache" })).toBe(true)
    expect(missingMigration({ code: 'PGRST202', message: 'Could not find the function public.save_nutrition_plan' })).toBe(true)
    expect(missingMigration({ code: '42P01', message: 'relation "public.meal_logs" does not exist' })).toBe(true)
    expect(missingMigration({ message: 'relation "public.supplements" does not exist' })).toBe(true)
  })
  it('leaves every other error alone', () => {
    expect(missingMigration(null)).toBe(false)
    expect(missingMigration({ code: '42501', message: 'permission denied for table meals' })).toBe(false)
    expect(missingMigration({ code: '23505', message: 'duplicate key value violates unique constraint "meal_logs_once"' })).toBe(false)
    expect(missingMigration(new Error('Failed to fetch'))).toBe(false)
  })
})
