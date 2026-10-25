// Appearance: dark (the default), light, or auto (follow the phone). The choice is kept on this
// device; index.html applies it before first paint with the same rules as resolveTheme.
export const THEMES = ['dark', 'light', 'auto']
const KEY = 'theme'
const COLORS = { dark: '#05070a', light: '#eef1f4' }

export const resolveTheme = (pref, systemLight) =>
  pref === 'light' || (pref === 'auto' && systemLight) ? 'light' : 'dark'

export function getThemePref() {
  try { const v = localStorage.getItem(KEY); return THEMES.includes(v) ? v : 'dark' } catch { return 'dark' }
}

const lightQuery = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null)

export function applyTheme(pref = getThemePref()) {
  const t = resolveTheme(pref, !!lightQuery()?.matches)
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', COLORS[t])
  return t
}

export function setThemePref(pref) {
  try { localStorage.setItem(KEY, pref) } catch { /* private mode: applies for this visit only */ }
  applyTheme(pref)
}

// In auto mode, follow the phone when it switches between light and dark.
export function watchSystemTheme() {
  lightQuery()?.addEventListener?.('change', () => { if (getThemePref() === 'auto') applyTheme('auto') })
}
