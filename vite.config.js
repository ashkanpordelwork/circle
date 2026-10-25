import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// E2E_REST (tests only): the address of a local PostgREST, served under /rest/v1 the way Supabase
// serves it, so the app can run against a throwaway database (scripts/e2e).
const rest = process.env.E2E_REST
export default defineConfig({
  plugins: [react()],
  server: rest ? { proxy: { '/rest/v1': { target: rest, rewrite: p => p.replace(/^\/rest\/v1/, '') } } } : {}
})
