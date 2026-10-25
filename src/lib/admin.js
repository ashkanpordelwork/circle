// The admin's screens, as plain functions: who each account is, searching them, and the activity
// log in words. The data comes from the admin_* functions in supabase/migrations/0005_admin.sql.

const fa = n => Number(n).toLocaleString('fa-IR')
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const toLatin = s => String(s ?? '').replace(/[۰-۹]/g, d => FA_DIGITS.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
export const faPhone = p => (p ? String(p).replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3').replace(/\d/g, d => FA_DIGITS[d]) : '')

// An account's roles in the app, most important first.
export function rolesOf(u) {
  const r = []
  if (u.is_admin) r.push('admin')
  if (u.coach_active === true) r.push('coach')
  if (u.coach_active === false) r.push('coach_off')
  if (u.student_id) r.push('student')
  if (!r.length) r.push('none')
  return r
}
export const ROLE_LABEL = { admin: 'مدیر', coach: 'مربی', coach_off: 'مربی غیرفعال', student: 'شاگرد', none: 'بدون نقش' }

// A number used as a name is written in one piece, or its groups come out reversed in RTL text.
export const nameOf = u => u.coach_name?.trim() || u.student_name || faPhone(u.phone).replace(/ /g, '') || u.email || 'حساب'

// filter: all | coach | student | admin | none; q: part of a name or number, in either digits.
export function filterUsers(users, filter = 'all', q = '') {
  const needle = toLatin(q).trim().toLowerCase().replace(/\s+/g, '')
  return users.filter(u => {
    const roles = rolesOf(u)
    if (filter === 'coach' && !roles.some(r => r === 'coach' || r === 'coach_off')) return false
    if (filter !== 'all' && filter !== 'coach' && !roles.includes(filter)) return false
    if (!needle) return true
    const hay = [u.coach_name, u.student_name, u.phone, u.email].filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, '')
    return hay.includes(needle)
  })
}

// "۳ ساعت پیش" — how long ago, in the largest unit that fits.
export function ago(ts, now = Date.now()) {
  if (!ts) return 'هرگز'
  const s = Math.max(0, (now - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'همین حالا'
  if (s < 3600) return `${fa(Math.floor(s / 60))} دقیقه پیش`
  if (s < 86400) return `${fa(Math.floor(s / 3600))} ساعت پیش`
  if (s < 86400 * 30) return `${fa(Math.floor(s / 86400))} روز پیش`
  if (s < 86400 * 365) return `${fa(Math.floor(s / 86400 / 30))} ماه پیش`
  return `${fa(Math.floor(s / 86400 / 365))} سال پیش`
}

// Activity kinds the admin can filter by.
export const ACTIVITY_GROUPS = {
  all: null,
  access: ['signup', 'login'],
  training: ['workout'],
  plans: ['plan', 'intake', 'student_added'],
  admin: 'admin:'
}
export const inGroup = (ev, g) => {
  const k = ACTIVITY_GROUPS[g]
  return !k || (typeof k === 'string' ? ev.kind.startsWith(k) : k.includes(ev.kind))
}

// One line of the log: icon, tone, the sentence, and where tapping it leads.
// names: { [uuid]: name } for the people an admin action was about.
export function describe(ev, names = {}) {
  const who = ev.who || 'کسی'
  const to = ev.student_id ? '/s/' + ev.student_id : ev.coach_id ? '/admin/c/' + ev.coach_id : null
  switch (ev.kind) {
    case 'signup': return { icon: 'how_to_reg', tone: 'blue', text: `${who} ثبت‌نام کرد`, to }
    case 'login': return { icon: 'login', tone: 'gray', text: `${who} وارد شد`, to }
    case 'workout': return { icon: 'fitness_center', tone: '', text: `${who} تمرین کرد${ev.detail ? `: ${ev.detail}` : ''}`, to }
    case 'plan': return { icon: 'edit_note', tone: 'blue', text: `برنامه ${who} به‌روز شد${ev.detail ? ` (مربی: ${ev.detail})` : ''}`, to }
    case 'intake': return { icon: 'assignment', tone: 'orange', text: `${who} پرسشنامه را پر کرد`, to }
    case 'student_added': return { icon: 'person_add', tone: '', text: `«${who}» به شاگردها اضافه شد`, to }
  }
  let d = {}
  try { d = typeof ev.detail === 'string' ? JSON.parse(ev.detail || '{}') : ev.detail || {} } catch { /* plain text */ }
  const n = id => names[id] || 'یک حساب'
  // In one piece: with spaces, the groups of a number get reordered inside Persian text.
  const ph = faPhone(d.phone).replace(/ /g, '')
  const action = {
    coach_granted: `دسترسی مربی داد به ${ph}`,
    coach_on: `دسترسی مربی ${n(d.coach)} را باز کرد`,
    coach_off: `دسترسی مربی ${n(d.coach)} را بست`,
    coach_revoked: `شماره ${ph} را از مربی‌ها برداشت`,
    coach_renamed: `نام مربی را «${d.name || ''}» گذاشت`,
    coach_removed: `نقش مربی ${ph || n(d.coach)} را حذف کرد`,
    student_moved: `${n(d.student)} را از ${n(d.from)} به ${n(d.coach)} منتقل کرد`,
    login_reset: `ورود ${n(d.student)} را بازنشانی کرد`,
    user_deleted: `حساب ${ph || d.email || ''} را حذف کرد`,
    admin_added: `${ph} را مدیر کرد`,
    admin_removed: `${ph} را از مدیرها برداشت`,
    plan_saved: `برنامه ${n(d.student)} را ویرایش کرد`
  }[ev.kind.slice('admin:'.length)] || ev.kind
  return { icon: 'admin_panel_settings', tone: 'red', text: `${who}: ${action}`, to }
}

// Events under day headings: «امروز», «دیروز», then the date.
export function byDay(events, now = new Date()) {
  const key = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}` }
  const today = key(now), yesterday = key(new Date(now.getTime() - 86400000))
  const out = []
  for (const ev of events) {
    const k = key(ev.at)
    const label = k === today ? 'امروز' : k === yesterday ? 'دیروز'
      : new Date(ev.at).toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!out.length || out[out.length - 1].key !== k) out.push({ key: k, label, items: [] })
    out[out.length - 1].items.push(ev)
  }
  return out
}
