// The super admin's pages: the whole system at a glance, every coach, student and account, the
// access each one has, and what everybody has been doing. Everything here goes through the
// admin_* functions and «admin all» policies of supabase/migrations/0005_admin.sql; the database
// refuses all of it to anyone who is not an admin.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { useMe } from '../../App.jsx'
import { isPhone, normPhone } from '../../lib/phone.js'
import { fmtDate } from '../../lib/plan.js'
import { rolesOf, ROLE_LABEL, nameOf, ago, describe, byDay, inGroup, faPhone, peopleOf, inFilter } from '../../lib/admin.js'
import { Page, Loading, Empty, Confirm, useToast, errorText } from '../../components/ui.jsx'
import Sheet, { useSheet } from '../../components/Sheet.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import InviteCard from '../../components/InviteCard.jsx'

const fa = n => Number(n || 0).toLocaleString('fa-IR')
const rpc = (fn, args) => must(supabase.rpc(fn, args))
const day = ts => (ts ? fmtDate(String(ts).slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' }) : '—')

// Errors from the admin functions, in words.
export function adminError(e) {
  const m = String(e?.message || '')
  if (/students first/.test(m)) return 'اول شاگردهای این مربی را به مربی دیگری منتقل کنید.'
  if (/not yourself|own account/.test(m)) return 'این کار روی حساب خودتان ممکن نیست.'
  if (/coach or an admin/.test(m)) return 'این حساب مربی یا مدیر هم هست؛ از صفحه حساب‌ها مدیریتش کنید.'
  if (/invalid phone/.test(m)) return 'شماره موبایل معتبر نیست.'
  if (/admins only/.test(m)) return 'فقط مدیر سیستم به این بخش دسترسی دارد.'
  return errorText(e)
}

// Load once, reload after a change. Returns [data, reload].
function useLoad(fn, deps = []) {
  const toast = useToast()
  const [data, setData] = useState(null)
  const load = () => fn().then(setData).catch(e => { toast(adminError(e), 'error'); setData(false) })
  useEffect(() => { load() }, deps)
  return [data, load]
}

// Everyone's name by id, for sentences about admin actions.
async function loadNames() {
  const [users, students] = await Promise.all([rpc('admin_users'), must(supabase.from('students').select('id, full_name'))])
  const names = Object.fromEntries(users.map(u => [u.id, nameOf(u)]))
  for (const s of students) names[s.id] = s.full_name
  return { users, names }
}

function Row({ icon, tone = '', title, sub, trailing, onClick, danger, disabled }) {
  const Tag = onClick ? 'button' : 'div'
  return <Tag className={'row with-leading' + (onClick ? ' pressable' : '')} onClick={onClick} disabled={disabled}
    style={danger ? { color: 'var(--red)' } : null}>
    <div className={'tile-icon ' + tone}><Icon name={icon} /></div>
    <div className="content"><div className="title-text">{title}</div>{sub && <div className="sub">{sub}</div>}</div>
    {trailing ?? (onClick && <Disclosure />)}
  </Tag>
}

function ActivityRow({ ev, names }) {
  const nav = useNavigate()
  const d = describe(ev, names)
  return <Row icon={d.icon} tone={d.tone} title={d.text} sub={ago(ev.at)} onClick={d.to ? () => nav(d.to) : undefined} />
}

/* ---------- home: the whole system at a glance ---------- */

export function AdminHome() {
  const nav = useNavigate()
  const [data] = useLoad(async () => {
    const [st, ev, n] = await Promise.all([rpc('admin_stats'), rpc('admin_activity', { p_limit: 8 }), loadNames()])
    return { st, ev, names: n.names }
  })
  if (data === null) return <Page><Loading /></Page>
  if (!data) return <Page><Empty icon="admin_panel_settings" title="پنل مدیریت در دسترس نیست">migration شماره ۵ را در Supabase اجرا کنید.</Empty></Page>
  const { st, ev, names } = data
  const attention = [
    st.no_role > 0 && { icon: 'person_remove', tone: 'orange', title: `${fa(st.no_role)} حساب بدون نقش`, sub: 'ثبت‌نام کرده‌اند ولی نه مربی‌اند نه شاگرد', to: '/admin/people?f=none' },
    st.coaches_off > 0 && { icon: 'block', tone: 'red', title: `${fa(st.coaches_off)} مربی غیرفعال`, sub: 'دسترسی‌شان بسته است', to: '/admin/people?f=coach' },
    st.coach_phones_waiting > 0 && { icon: 'hourglass_top', tone: 'gray', title: `${fa(st.coach_phones_waiting)} مربی در انتظار ثبت‌نام`, sub: 'شماره داده شده، هنوز حساب نساخته‌اند', to: '/admin/people?f=waiting' },
    st.students_waiting > 0 && { icon: 'key', tone: 'gray', title: `${fa(st.students_waiting)} شاگرد در انتظار ثبت‌نام`, sub: 'کد دعوت گرفته‌اند ولی هنوز وارد نشده‌اند', to: '/admin/people?f=waiting' }
  ].filter(Boolean)
  return <Page>
    <section className="card hero" aria-label="کل سیستم">
      <div className="caption kicker">کل سیستم</div>
      <div className="hero-number tnum">{fa(st.users)}<span className="hero-of"> حساب</span></div>
      <div className="footnote">{fa(st.coaches)} مربی، {fa(st.students)} شاگرد، {fa(st.admins)} مدیر</div>
    </section>

    <div className="stats">
      <button className="stat glass-lite pressable" onClick={() => nav('/admin/people?f=coach')}>
        <div className="stat-icon"><Icon name="badge" /></div><div className="v">{fa(st.coaches)}</div><div className="l">مربی فعال</div></button>
      <button className="stat glass-lite pressable" onClick={() => nav('/admin/people?f=student')}>
        <div className="stat-icon blue"><Icon name="group" filled /></div><div className="v">{fa(st.students_linked)}</div><div className="l">شاگرد فعال</div></button>
      <button className="stat glass-lite pressable" onClick={() => nav('/admin/activity?g=training')}>
        <div className="stat-icon"><Icon name="fitness_center" /></div><div className="v">{fa(st.workouts_7d)}</div><div className="l">تمرین در ۷ روز</div></button>
      <button className="stat glass-lite pressable" onClick={() => nav('/admin/people')}>
        <div className="stat-icon orange"><Icon name="how_to_reg" /></div><div className="v">{fa(st.signups_7d)}</div><div className="l">ثبت‌نام در ۷ روز</div></button>
    </div>

    {attention.length > 0 && <div className="section">
      <div className="section-title">نیاز به بررسی</div>
      <div className="group glass-lite">{attention.map(a => <Row key={a.title} {...a} onClick={() => nav(a.to)} />)}</div>
    </div>}

    <div className="section">
      <div className="section-title">مدیریت</div>
      <div className="group glass-lite">
        <Row icon="group" title="افراد" sub={`${fa(st.coaches)} مربی، ${fa(st.students)} شاگرد، ${fa(st.users)} حساب`} onClick={() => nav('/admin/people')} />
        <Row icon="history" tone="gray" title="گزارش فعالیت" sub={`${fa(st.workouts)} تمرین، ${fa(st.sets)} ست ثبت‌شده`} onClick={() => nav('/admin/activity')} />
      </div>
    </div>

    <div className="section">
      <div className="section-title">آخرین فعالیت‌ها</div>
      {!ev.length ? <div className="group glass-lite"><div className="row"><div className="content sub">هنوز فعالیتی ثبت نشده است.</div></div></div>
        : <div className="group glass-lite">{ev.map((e, i) => <ActivityRow key={i} ev={e} names={names} />)}</div>}
      <button className="btn glass interactive block mt" onClick={() => nav('/admin/activity')}>همه فعالیت‌ها</button>
    </div>
  </Page>
}

/* ---------- coaches ---------- */

function PhoneSheet({ title, text, okText, onSubmit, onClose }) {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  return <Sheet title={title} onClose={onClose}><PhoneForm text={text} okText={okText} phone={phone} setPhone={setPhone} busy={busy} setBusy={setBusy} onSubmit={onSubmit} /></Sheet>
}
function PhoneForm({ text, okText, phone, setPhone, busy, setBusy, onSubmit }) {
  const { close } = useSheet()
  const toast = useToast()
  const bad = phone.length >= 4 && !isPhone(phone)
  const submit = async e => {
    e.preventDefault()
    if (!isPhone(phone)) return toast('شماره موبایل معتبر وارد کنید.', 'warning')
    setBusy(true)
    try { await onSubmit(normPhone(phone)); close() } catch (err) { toast(adminError(err), 'error') } finally { setBusy(false) }
  }
  return <form onSubmit={submit}>
    {text && <p className="subhead secondary" style={{ marginTop: 0 }}>{text}</p>}
    <div className="field"><label htmlFor="ph">شماره موبایل</label>
      <input id="ph" className={'input ltr' + (bad ? ' bad' : '')} inputMode="tel" placeholder="0912 123 4567" value={phone} autoFocus onChange={e => setPhone(e.target.value)} /></div>
    <button className="btn glass interactive prominent block" disabled={busy}>{busy ? 'کمی صبر کنید…' : okText}</button>
  </form>
}

function NameSheet({ initial, onSave, onClose }) {
  return <Sheet title="نام مربی" onClose={onClose}><NameForm initial={initial} onSave={onSave} /></Sheet>
}
function NameForm({ initial, onSave }) {
  const { close } = useSheet()
  const toast = useToast()
  const [name, setName] = useState(initial || '')
  return <form onSubmit={async e => { e.preventDefault(); if (!name.trim()) return; try { await onSave(name.trim()); close() } catch (err) { toast(adminError(err), 'error') } }}>
    <div className="field"><label htmlFor="cn">نام و نام خانوادگی</label>
      <input id="cn" className="input" value={name} maxLength={60} autoFocus onChange={e => setName(e.target.value)} /></div>
    <button className="btn glass interactive prominent block">ذخیره</button>
  </form>
}

// Pick a coach from a list: one sheet, one tap.
export function CoachPicker({ title, text, exclude, onPick, onClose }) {
  const [coaches] = useLoad(() => rpc('admin_users').then(us => us.filter(u => u.coach_active && u.id !== exclude)))
  return <Sheet title={title} onClose={onClose}><CoachPickerBody text={text} coaches={coaches} onPick={onPick} /></Sheet>
}
function CoachPickerBody({ text, coaches, onPick }) {
  const { close } = useSheet()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (coaches === null) return <Loading />
  if (!coaches?.length) return <p className="subhead secondary">مربی فعال دیگری نیست.</p>
  return <>
    {text && <p className="subhead secondary" style={{ marginTop: 0 }}>{text}</p>}
    <div className="group glass-lite">{coaches.map(c => <Row key={c.id} icon="badge" title={nameOf(c)} sub={`${fa(c.coach_students)} شاگرد`}
      disabled={busy} onClick={async () => { setBusy(true); try { await onPick(c); close() } catch (e) { toast(adminError(e), 'error'); setBusy(false) } }} />)}</div>
  </>
}

function AddStudentForm({ coaches, coach, setCoach, onAdded }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [added, setAdded] = useState(null)
  const [busy, setBusy] = useState(false)
  if (added) return <InviteCard student={added} />
  if (coaches === null) return <Loading />
  const submit = async e => {
    e.preventDefault()
    if (!coach) return toast('مربی را انتخاب کنید.', 'warning')
    if (!name.trim() || !isPhone(phone)) return toast('نام و شماره موبایل معتبر لازم است.', 'warning')
    setBusy(true)
    try {
      const s = await must(supabase.from('students').insert({ coach_id: coach, full_name: name.trim(), phone: normPhone(phone) }).select().single())
      setAdded(s); onAdded()
    } catch (err) { toast(adminError(err), 'error') } finally { setBusy(false) }
  }
  return <form onSubmit={submit}>
    <div className="field"><label>مربی</label>
      <div className="chips" data-no-drag style={{ flexWrap: 'wrap', overflow: 'visible', margin: 0, padding: 0 }}>{(coaches || []).map(c =>
        <button key={c.id} type="button" className={'chip glass-lite pressable' + (coach === c.id ? ' on' : '')} onClick={() => setCoach(c.id)}>{nameOf(c)}</button>)}</div></div>
    <div className="field"><label htmlFor="sn">نام</label><input id="sn" className="input" value={name} maxLength={60} onChange={e => setName(e.target.value)} /></div>
    <div className="field"><label htmlFor="sp">شماره موبایل</label><input id="sp" className="input ltr" inputMode="tel" placeholder="0912 123 4567" value={phone} onChange={e => setPhone(e.target.value)} /></div>
    <button className="btn glass interactive prominent block" disabled={busy}><Icon name="person_add" />{busy ? 'کمی صبر کنید…' : 'افزودن شاگرد'}</button>
  </form>
}

/* ---------- people: every coach, student and account in one list ---------- */

// One list instead of three («مربی‌ها», «شاگردها», «همه حساب‌ها»): accounts, students who have not
// signed up yet, and coach numbers waiting for their first sign-in, narrowed by a filter.
const PEOPLE_FILTERS = [['all', 'همه'], ['coach', 'مربی'], ['student', 'شاگرد'], ['waiting', 'منتظر ثبت‌نام'], ['none', 'بدون نقش'], ['admin', 'مدیر']]
const digitsOf = q => q.trim().replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\s+/g, '').toLowerCase()

function AddSheet({ onClose, onAdded }) {
  const [mode, setMode] = useState(null)
  const [coaches] = useLoad(() => rpc('admin_users').then(us => us.filter(u => u.coach_active)))
  const [coach, setCoach] = useState(null)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  return <Sheet title={mode === 'coach' ? 'مربی جدید' : mode === 'student' ? 'شاگرد جدید' : 'افزودن'} onClose={onClose}>
    {!mode ? <div className="group glass-lite">
      <Row icon="badge" title="مربی جدید" sub="با شماره موبایل؛ با اولین ثبت‌نام مربی می‌شود" onClick={() => setMode('coach')} />
      <Row icon="person_add" tone="blue" title="شاگرد جدید" sub="برای یکی از مربی‌ها، با کد دعوت" onClick={() => setMode('student')} />
    </div> : mode === 'coach'
      ? <PhoneForm text="اگر این شماره حساب دارد، همین حالا مربی می‌شود؛ اگر ندارد، با اولین ثبت‌نام." okText="مربی شود"
        phone={phone} setPhone={setPhone} busy={busy} setBusy={setBusy}
        onSubmit={async p => { await rpc('admin_grant_coach', { p_phone: p }); toast('دسترسی مربی داده شد', 'success'); onAdded() }} />
      : <AddStudentForm coaches={coaches} coach={coach} setCoach={setCoach} onAdded={onAdded} />}
  </Sheet>
}

export function AdminPeople() {
  const nav = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const f = params.get('f') || 'all'
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [revoking, setRevoking] = useState(null)
  const [data, reload] = useLoad(async () => {
    const [users, students, waiting] = await Promise.all([rpc('admin_users'),
      must(supabase.from('students').select('id, full_name, phone, active, user_id, coach_id').order('full_name')),
      rpc('admin_waiting_coaches')])
    return peopleOf({ users, students, waiting })
  })
  const shown = useMemo(() => {
    if (!data) return []
    const needle = digitsOf(q)
    return data.filter(x => inFilter(x, f) && (!needle || String(x.hay).replace(/\s+/g, '').toLowerCase().includes(needle)))
  }, [data, q, f])
  const add = <button className="icon-btn glass interactive" onClick={() => setAdding(true)} aria-label="افزودن"><Icon name="person_add" /></button>
  const row = x => {
    if (x.kind === 'phone') return <Row key={x.key} icon="hourglass_top" tone="gray" title={<span className="latin">{x.name}</span>}
      sub="مربی، منتظر اولین ثبت‌نام" trailing={<button className="btn plain small pressable" onClick={() => setRevoking(x.p)}>لغو</button>} />
    if (x.kind === 'student') return <Row key={x.key} icon="key" tone="gray" title={x.name}
      sub={`شاگرد ${x.coach || '—'}، ${x.s.active ? 'منتظر ثبت‌نام' : 'دسترسی بسته'}`} onClick={() => nav('/s/' + x.s.id)} />
    const u = x.u, r = x.roles
    const sub = [r.map(k => ROLE_LABEL[k]).join('، '), u.coach_active != null && `${fa(u.coach_students)} شاگرد`, `آخرین ورود ${ago(u.last_sign_in_at)}`].filter(Boolean).join('، ')
    return <Row key={x.key} icon={r.includes('admin') ? 'admin_panel_settings' : r.includes('coach') || r.includes('coach_off') ? 'badge' : r.includes('student') ? 'person' : 'person_remove'}
      tone={r.includes('none') ? 'orange' : r.includes('coach_off') ? 'gray' : r.includes('admin') ? 'red' : ''} title={x.name} sub={sub} onClick={() => nav('/admin/u/' + u.id)} />
  }
  return <Page title="افراد" back="/admin" actions={add}>
    <input className="input" placeholder="جستجو: نام، شماره یا مربی" value={q} onChange={e => setQ(e.target.value)} aria-label="جستجو" style={{ marginBottom: '1rem' }} />
    <div className="chips" data-no-drag>{PEOPLE_FILTERS.map(([k, l]) => <button key={k} className={'chip glass-lite pressable' + (f === k ? ' on' : '')}
      onClick={() => setParams(k === 'all' ? {} : { f: k }, { replace: true })}>{l} {data ? fa(data.filter(x => inFilter(x, k)).length) : ''}</button>)}</div>
    {data === null ? <Loading /> : !data ? null : !shown.length ? <Empty icon="group" title="کسی پیدا نشد" /> : <div className="section">
      <div className="group glass-lite">{shown.map(row)}</div>
    </div>}
    {adding && <AddSheet onClose={() => setAdding(false)} onAdded={reload} />}
    {revoking && <Confirm title="لغو دسترسی مربی؟" text={`شماره ${faPhone(revoking).replace(/ /g, '')} دیگر با ثبت‌نام مربی نمی‌شود.`} okText="لغو دسترسی" danger
      onOk={async () => { try { await rpc('admin_revoke_waiting_coach', { p_phone: revoking }); reload() } catch (e) { toast(adminError(e), 'error') } }} onClose={() => setRevoking(null)} />}
  </Page>
}

/* ---------- one person: who they are, what they may do; a coach's students too ---------- */

export function AdminUser() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const me = useMe()
  const [sheet, setSheet] = useState(null)
  const [invite, setInvite] = useState(null)
  const [data, reload] = useLoad(async () => {
    const [users, students] = await Promise.all([rpc('admin_users'),
      must(supabase.from('students').select('id, full_name, active, user_id').eq('coach_id', id).order('full_name'))])
    return { u: users.find(x => x.id === id) || null, students }
  }, [id])
  const back = '/admin/people'
  if (data === null) return <Page back={back}><Loading /></Page>
  if (!data?.u) return <Page back={back}><Empty icon="manage_accounts" title="این حساب پیدا نشد">ممکن است حذف شده باشد.</Empty></Page>
  const { u, students } = data
  const self = u.id === me.session.user.id
  const coach = u.coach_active != null
  const roles = rolesOf(u)
  const name = nameOf(u)
  const run = (fn, ok) => async () => { try { await fn(); if (ok) toast(ok, 'success'); reload() } catch (e) { toast(adminError(e), 'error') } }
  return <Page title={name} back={back}>
    <section className="card glass-lite">
      <div className="hstack wrap" style={{ marginBottom: '0.75rem' }}>{roles.map(r => <span key={r} className={'pill ' + (r === 'none' || r === 'coach_off' ? 'bad' : 'ok')}>{ROLE_LABEL[r]}</span>)}</div>
      <div className="kv"><span>شماره</span><b className="latin">{faPhone(u.phone) || '—'}</b></div>
      {!u.phone && <div className="kv"><span>ایمیل</span><b className="latin">{u.email}</b></div>}
      <div className="kv"><span>ثبت‌نام</span><b>{day(u.created_at)}</b></div>
      <div className="kv"><span>آخرین ورود</span><b>{ago(u.last_sign_in_at)}</b></div>
      {u.student_id && <div className="kv"><span>مربی</span><b>{u.student_coach?.trim() || '—'}</b></div>}
    </section>

    {u.student_id && <div className="section"><div className="group glass-lite">
      <Row icon="person" tone="blue" title="صفحه شاگرد" sub="برنامه، پیشرفت، پرونده" onClick={() => nav('/s/' + u.student_id)} />
    </div></div>}

    {coach && <div className="section">
      <div className="section-title">{fa(students.length)} شاگرد</div>
      {!students.length ? <div className="group glass-lite"><div className="row"><div className="content sub">این مربی هنوز شاگردی ندارد.</div></div></div>
        : <div className="group glass-lite">{students.map(s => <Row key={s.id} icon="person" tone={s.active && s.user_id ? '' : 'gray'} title={s.full_name}
          sub={!s.active ? 'دسترسی بسته' : s.user_id ? 'ثبت‌نام کرده' : 'هنوز ثبت‌نام نکرده'} onClick={() => nav('/s/' + s.id)} />)}</div>}
      {students.length > 0 && <button className="btn glass interactive block mt" onClick={() => setSheet('moveAll')}><Icon name="swap_horiz" />انتقال همه به مربی دیگر</button>}
    </div>}

    <div className="section">
      <div className="section-title">دسترسی‌ها</div>
      <div className="group glass-lite">
        {coach && <Row icon="edit_note" title="نام مربی" sub={u.coach_name?.trim() || 'بدون نام'} onClick={() => setSheet('name')} />}
        {!coach && u.phone && <Row icon="badge" title="مربی کردن" sub="می‌تواند شاگرد اضافه کند و برنامه بنویسد" onClick={run(() => rpc('admin_grant_coach', { p_phone: u.phone }), 'مربی شد')} />}
        {coach && !self && (u.coach_active
          ? <Row icon="block" tone="red" title="بستن دسترسی مربی" sub="شاگردها و برنامه‌ها می‌مانند و شاگردها به تمرین ادامه می‌دهند" onClick={() => setSheet('off')} />
          : <Row icon="play_arrow" title="باز کردن دسترسی مربی" onClick={run(() => rpc('admin_set_coach_active', { p_coach: u.id, p_active: true }), 'دسترسی باز شد')} />)}
        {coach && !self && <Row icon="person_remove" tone="red" title="حذف نقش مربی" sub={students.length ? 'اول شاگردها را منتقل کنید' : 'حساب می‌ماند، فقط مربی نیست'}
          disabled={students.length > 0} onClick={students.length ? undefined : () => setSheet('remove')} />}
        {u.phone && !self && (u.is_admin
          ? <Row icon="admin_panel_settings" tone="red" title="برداشتن از مدیرها" onClick={run(() => rpc('admin_set_admin', { p_phone: u.phone, p_on: false }), 'از مدیرها برداشته شد')} />
          : <Row icon="admin_panel_settings" tone="orange" title="مدیر کردن" sub="دسترسی کامل به همه سیستم" onClick={() => setSheet('admin')} />)}
        {u.student_id && !self && !coach && !u.is_admin && <Row icon="lock_reset" tone="blue" title="بازنشانی ورود" sub="برای رمز فراموش‌شده؛ کد دعوت تازه می‌گیرد" onClick={() => setSheet('reset')} />}
        {self && <div className="row"><div className="content sub">بقیه دسترسی‌های حساب خودتان را از اینجا نمی‌شود تغییر داد.</div></div>}
      </div>
    </div>

    {!self && <button className="btn glass interactive danger block" disabled={u.coach_students > 0} onClick={() => setSheet('delete')}><Icon name="delete" />حذف حساب</button>}
    {!self && u.coach_students > 0 && <div className="section-footer">برای حذف این حساب، اول شاگردهای این مربی را منتقل کنید.</div>}

    {sheet === 'name' && <NameSheet initial={u.coach_name} onClose={() => setSheet(null)}
      onSave={async n => { await rpc('admin_rename_coach', { p_coach: u.id, p_name: n }); reload() }} />}
    {sheet === 'off' && <Confirm title={`دسترسی ${name} بسته شود؟`} okText="بستن دسترسی" danger onClose={() => setSheet(null)}
      text="دیگر نمی‌تواند وارد پنل مربی شود. شاگردها، برنامه‌ها و سوابق دست نمی‌خورند و هر وقت بخواهید باز می‌شود."
      onOk={run(() => rpc('admin_set_coach_active', { p_coach: u.id, p_active: false }), 'دسترسی بسته شد')} />}
    {sheet === 'remove' && <Confirm title="نقش مربی حذف شود؟" okText="حذف نقش مربی" danger onClose={() => setSheet(null)}
      text="حساب باقی می‌ماند ولی دیگر مربی نیست. هر وقت بخواهید می‌توانید دوباره مربی‌اش کنید."
      onOk={run(() => rpc('admin_remove_coach', { p_coach: u.id }), 'نقش مربی حذف شد')} />}
    {sheet === 'moveAll' && <CoachPicker title="انتقال همه شاگردها" exclude={u.id} onClose={() => setSheet(null)}
      text={`${fa(students.length)} شاگرد با برنامه و سوابقشان به این مربی منتقل می‌شوند.`}
      onPick={async c => { for (const s of students) await rpc('admin_move_student', { p_student: s.id, p_coach: c.id }); toast(`به ${nameOf(c)} منتقل شدند`, 'success'); reload() }} />}
    {sheet === 'admin' && <Confirm title={`${name} مدیر شود؟`} okText="مدیر شود" onClose={() => setSheet(null)}
      text="مدیر همه حساب‌ها، شاگردها، برنامه‌ها و فعالیت‌ها را می‌بیند و می‌تواند هر دسترسی را تغییر دهد."
      onOk={run(() => rpc('admin_set_admin', { p_phone: u.phone, p_on: true }), 'مدیر شد')} />}
    {sheet === 'reset' && <Confirm title="ورود بازنشانی شود؟" okText="بازنشانی ورود" onClose={() => setSheet(null)}
      text="حساب فعلی حذف و یک کد دعوت تازه ساخته می‌شود. شاگرد با همان شماره دوباره ثبت‌نام می‌کند؛ برنامه و سوابقش می‌ماند."
      onOk={async () => {
        try {
          await rpc('admin_reset_login', { p_student: u.student_id })
          setInvite(await must(supabase.from('students').select('*').eq('id', u.student_id).single()))
        } catch (e) { toast(adminError(e), 'error') }
      }} />}
    {sheet === 'delete' && <Confirm title="حساب حذف شود؟" okText="حذف حساب" danger onClose={() => setSheet(null)}
      text={u.student_id ? 'حساب ورود حذف می‌شود؛ پرونده شاگرد و سوابقش می‌ماند و با کد دعوت تازه می‌تواند دوباره ثبت‌نام کند.' : 'این حساب برای همیشه حذف می‌شود.'}
      onOk={async () => { try { await rpc('admin_delete_user', { p_user: u.id }); toast('حساب حذف شد', 'success'); nav(back, { replace: true }) } catch (e) { toast(adminError(e), 'error') } }} />}
    {invite && <Sheet title="کد دعوت تازه" onClose={() => { setInvite(null); nav(back, { replace: true }) }}><InviteCard student={invite} /></Sheet>}
  </Page>
}

/* ---------- the activity of the whole system ---------- */

const GROUPS = [['all', 'همه'], ['access', 'ورود و ثبت‌نام'], ['training', 'تمرین'], ['plans', 'برنامه و پرسشنامه'], ['admin', 'کارهای مدیر']]

export function AdminActivity() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const g = params.get('g') || 'all'
  const [events, setEvents] = useState(null)
  const [names, setNames] = useState({})
  const [more, setMore] = useState(true)
  const [busy, setBusy] = useState(false)
  const page = async before => {
    setBusy(true)
    try {
      const ev = await rpc('admin_activity', { p_limit: 150, p_before: before || null })
      setEvents(cur => [...(before ? cur || [] : []), ...ev]); setMore(ev.length === 150)
    } catch (e) { toast(adminError(e), 'error'); setEvents(cur => cur || []) } finally { setBusy(false) }
  }
  useEffect(() => { page(); loadNames().then(n => setNames(n.names)).catch(() => {}) }, [])
  const shown = (events || []).filter(e => inGroup(e, g))
  return <Page title="گزارش فعالیت" back="/admin">
    <div className="chips" data-no-drag>{GROUPS.map(([k, l]) => <button key={k} className={'chip glass-lite pressable' + (g === k ? ' on' : '')}
      onClick={() => setParams(k === 'all' ? {} : { g: k }, { replace: true })}>{l}</button>)}</div>
    {events === null ? <Loading /> : !shown.length ? <Empty icon="history" title="فعالیتی نیست">{more ? 'فعالیت‌های قدیمی‌تر را ببینید.' : ''}</Empty>
      : byDay(shown).map(d => <div key={d.key} className="section">
        <div className="section-title">{d.label}</div>
        <div className="group glass-lite">{d.items.map((e, i) => <ActivityRow key={i} ev={e} names={names} />)}</div>
      </div>)}
    {events && more && <button className="btn glass interactive block" disabled={busy} onClick={() => page(events[events.length - 1]?.at)}>{busy ? 'کمی صبر کنید…' : 'قدیمی‌ترها'}</button>}
  </Page>
}
