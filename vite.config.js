import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// E2E_REST (tests only): the address of a local PostgREST, served under /rest/v1 the way Supabase
// serves it, so the app can run against a throwaway database (scripts/e2e).
const rest = process.env.E2E_REST
// BASE_PATH: the folder the site is served from. GitHub Pages serves a project repository under
// /<repo>/, so the Pages workflow sets it to /circle/; Vercel and local development use /.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: rest ? { proxy: { '/rest/v1': { target: rest, rewrite: p => p.replace(/^\/rest\/v1/, '') } } } : {}
})
