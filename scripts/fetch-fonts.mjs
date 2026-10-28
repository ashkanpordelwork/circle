// Downloads the icon font into public/fonts, so it is served from the site itself (Google Fonts is
// slow or filtered for many users in Iran). The text font, IRANYekan, is not downloadable: its
// files are kept in public/fonts (iranyekan-*.woff2, iranyekan.css).
//   node scripts/fetch-fonts.mjs
// Material Symbols is subset to the icons in ICONS — add a name there when you use a new icon,
// then run this again. Names must stay in alphabetical order (Google Fonts requires it).
import fs from 'node:fs'

export const ICONS = [
  'add', 'admin_panel_settings', 'arrow_downward', 'arrow_outward', 'arrow_upward', 'assignment',
  'badge', 'bedtime', 'block', 'calendar_month', 'check', 'check_circle', 'chevron_left',
  'chevron_right', 'close', 'content_copy', 'dashboard', 'delete', 'download', 'edit_note', 'error',
  'exercise', 'expand_less', 'expand_more', 'fitness_center', 'flag', 'group', 'healing', 'history',
  'hourglass_top', 'how_to_reg', 'info', 'key', 'lock', 'lock_reset', 'login', 'logout',
  'manage_accounts', 'medical_information', 'monitor_weight', 'monitoring', 'person', 'person_add', 'person_remove',
  'play_arrow', 'refresh', 'restaurant', 'search', 'settings', 'share', 'smartphone', 'sticky_note_2',
  'swap_horiz', 'swipe_right', 'timer', 'today', 'trending_down', 'trending_up', 'undo', 'visibility',
  'visibility_off', 'warning'
]
const sorted = [...ICONS].sort()
if (sorted.join() !== ICONS.join()) throw new Error('ICONS must be sorted: ' + sorted.join(', '))

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
const out = new URL('../public/fonts/', import.meta.url)

async function grab(cssUrl, file) {
  const css = await (await fetch(cssUrl, { headers: { 'User-Agent': UA } })).text()
  const src = /src:\s*url\((https:[^)]+)\)\s*format\('woff2'\)/.exec(css)?.[1]
  if (!src) throw new Error('no woff2 in ' + cssUrl + '\n' + css.slice(0, 300))
  const buf = Buffer.from(await (await fetch(src)).arrayBuffer())
  fs.writeFileSync(new URL(file, out), buf)
  console.log(file, (buf.length / 1024).toFixed(0) + ' KB')
}

await grab(`https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..600,0..1,0&icon_names=${ICONS.join(',')}&display=block`, 'material-symbols-rounded.woff2')
