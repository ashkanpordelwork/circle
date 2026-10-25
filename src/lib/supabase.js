import { createClient } from '@supabase/supabase-js'

// Both values are public by design (the anon key only reaches what row level security allows).
// Set them in .env.local for development and in Vercel → Settings → Environment Variables.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configured = !!(url && key)
export const supabase = configured ? createClient(url, key) : null

// Supabase answers errors as { error }; the pages want a throw they can catch and show.
export async function must(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}
