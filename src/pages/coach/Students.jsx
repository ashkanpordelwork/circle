import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { scope } from '../../lib/scope.js'
import { supabase, must } from '../../lib/supabase.js'
import { overview, isoMinus, daysBetween } from '../../lib/dashboard.js'
import { todayISO, DAY_NAMES } from '../../lib/plan.js'
import { weekLabel } from '../../lib/program.js'
import { fmtJ } from '../../lib/jalali.js'
import { isPhone, normPhone } from '../../lib/phone.js'
import { Page, Loading, Empty, useToast, errorText } from '../../components/ui.jsx'
import Sheet from '../../components/Sheet.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import InviteCard from '../../components/InviteCard.jsx'

// The coach's home is their students. One list, ordered by who needs a look first, each row
// saying how that person's week is going — it used to be two tabs, «داشبورد» and «شاگردان»,
// listing the same people twice. Above it, the week in one number; below, who has not joined yet.

const fa = n => Number(n).toLocaleString('fa-IR')
const ago = (date, today) => {
  const d = daysBetween(date, today)
  return d <= 0 ? 'امروز' : d === 1 ? 'دیروز' : `${fa(d)} روز پیش`
}

// Planned sessions done this week, as a ring.
function Ring({ value }) {
  const r = 26, c = 2 * Math.PI * r
  return <div className="ring-stat">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} className="track" />
      <circle cx="32" cy="32" r={r} className="bar" strokeDasharray={c} strokeDashoffset={c * (1 - (value ?? 0))} />
    </svg>
    <div className="v">{value == null ? '—' : `${fa(Math.round(value * 100))}٪`}</div>
  </div>
}

// One student's week: what they have done, what they missed, what is next.
const STATUS = {
  behind: ['red', 'error'], noplan: ['gray', 'edit_note'], idle: ['orange', 'hourglass_top'],
  today: ['', 'today'], ontrack: ['', 'trending_up'], done: ['', 'check'],
  unwritten: ['orange', 'edit_note'], ended: ['orange', 'calendar_month'], waiting: ['gray', 'calendar_month']
}
function weekLine(x) {
  if (x.status === 'noplan') return 'هنوز برنامه‌ای ندارد'
  if (x.status === 'unwritten') return `${weekLabel(x.program.week)} هنوز نوشته نشده`
  if (x.status === 'ended') return 'برنامه تمام شده؛ برنامه بعدی را بنویسید'
  if (x.status === 'waiting') return `برنامه از ${fmtJ(x.program.next.start_date, false)} شروع می‌شود`
  if (x.program) {
    const p = x.program, tail = p.ending ? '، برنامه رو به پایان است' : ''
    if (x.status === 'behind') return `${fa(p.remaining)} جلسه مانده و ${fa(p.daysLeft)} روز فرصت${tail}`
    if (x.status === 'done') return `جلسه‌های ${weekLabel(p.week)} انجام شد${tail}`
    return `${weekLabel(p.week)}: ${fa(x.done)} از ${fa(x.planned)} جلسه، ${fa(p.daysLeft)} روز مانده${tail}`
  }
  const days = x.missed.map(d => DAY_NAMES[new Date(d + 'T12:00:00').getDay()])
  if (x.status === 'behind') return `${fa(x.missed.length)} جلسه عقب: ${[...new Set(days)].join('، ')}`
  if (x.status === 'idle') return x.idleDays == null ? 'هنوز تمرینی ثبت نکرده' : `${fa(x.idleDays)} روز بدون تمرین`
  if (x.status === 'today') return `امروز: ${x.today.join(' + ')}`
  if (x.status === 'done') return 'همه جلسه‌های این هفته انجام شد'
  return `${fa(x.done)} از ${fa(x.planned)} جلسه انجام شده`
}
function WeekRow({ x, onOpen }) {
  const [tone, icon] = STATUS[x.status]
  return <button className="row with-leading pressable" onClick={onOpen}>
    <div className={'tile-icon ' + tone}><Icon name={icon} /></div>
    <div className="content"><div className="title-text">{x.student.full_name}</div>
      <div className={'sub' + (x.status === 'behind' ? ' danger' : '')}>{weekLine(x)}</div></div>
    {x.sessions.length > 0 && <div className="pips" aria-label={`${fa(x.done)} از ${fa(x.planned)} جلسه`}>
      {x.sessions.map((s, i) => <span key={i} className={s.state} title={s.date ? DAY_NAMES[new Date(s.date + 'T12:00:00').getDay()] : s.name} />)}</div>}
    <Disclosure />
  </button>
}

function AddStudent({ onClose, onAdded }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(null)
  const phoneBad = phone.length >= 4 && !isPhone(phone)
  const add = async e => {
    e.preventDefault()
    if (!name.trim()) return toast('نام را وارد کنید.', 'warning')
    if (!isPhone(phone)) return toast('شماره موبایل معتبر وارد کنید.', 'warning')
    setBusy(true)
    try {
      const s = await must(supabase.from('students').insert({ full_name: name.trim(), phone: normPhone(phone) }).select().single())
      onAdded(s); setAdded(s); toast(`${s.full_name} اضافه شد`, 'success')
    } catch (err) { toast(errorText(err), 'error') } finally { setBusy(false) }
  }
  return <Sheet title={added ? 'دعوت شاگرد' : 'شاگرد جدید'} onClose={onClose}>
    {added ? <InviteCard student={added} /> : <form onSubmit={add}>
      <p className="subhead secondary" style={{ marginTop: 0 }}>بعد از افزودن، یک کد دعوت می‌گیرید که برای شاگرد می‌فرستید.</p>
      <div className="field"><label htmlFor="n">نام</label><input id="n" className="input" value={name} onChange={e => setName(e.target.value)} maxLength={60} autoFocus /></div>
      <div className="field"><label htmlFor="p">شماره موبایل</label>
        <input id="p" className="input ltr" type="tel" inputMode="tel" placeholder="0912 123 4567" value={phone} onChange={e => setPhone(e.target.value)} aria-invalid={phoneBad} />
        {phoneBad && <div className="caption" style={{ color: 'var(--red)' }}>شماره ۱۱ رقمی با ۰۹ شروع می‌شود.</div>}</div>
      <button className="btn glass interactive prominent block" disabled={busy}><Icon name="person_add" />افزودن شاگرد</button>
    </form>}
  </Sheet>
}

// Students who are not training yet: invited but not signed up, or switched off.
function OtherRow({ s, onOpen }) {
  return <button className="row with-leading pressable" onClick={onOpen}>
    <div className={'tile-icon ' + (s.active ? 'orange' : 'gray')}><Icon name={s.active ? 'hourglass_top' : 'person'} /></div>
    <div className="content"><div className="title-text">{s.full_name}</div>
      <div className="sub">{s.active ? 'کد دعوت را برایش بفرستید' : 'غیرفعال'}</div></div>
    <Disclosure />
  </button>
}

export default function Students() {
  const nav = useNavigate()
  const toast = useToast()
  const loc = useLocation()
  const [o, setO] = useState(null)
  // «شاگرد جدید» from elsewhere lands here with the form open.
  const [adding, setAdding] = useState(!!loc.state?.add)
  const [q, setQ] = useState('')
  const today = todayISO()
  const load = async () => {
    try {
      const [students, workouts, routines, programs] = await Promise.all([
        must(supabase.from('students').select('*').eq('coach_id', scope.uid).order('full_name')),
        must(supabase.from('workouts').select('id, student_id, routine_name, date, created_at, workout_sets(count), students!inner(coach_id)').eq('students.coach_id', scope.uid).gte('date', isoMinus(today, 60)).order('date', { ascending: false }).limit(1000)),
        // The athlete's own routines are theirs (0008): the week is judged by what the coach planned.
        must(supabase.from('routines').select('*, students!inner(coach_id)').eq('students.coach_id', scope.uid)).then(rs => rs.filter(r => r.owner !== 'self')),
        // Before migration 0006 there are no programs: weekday plans only.
        supabase.from('programs').select('id, student_id, start_date, weeks, per_week, students!inner(coach_id)').eq('students.coach_id', scope.uid).then(r => r.data || [])
      ])
      const names = Object.fromEntries(students.map(s => [s.id, s.full_name]))
      setO({ ...overview({ students, workouts, routines, programs, today }), names, students })
    } catch (e) { toast(errorText(e), 'error'); setO(false) }
  }
  useEffect(() => { load() }, [])

  const addBtn = <button className="icon-btn glass interactive" onClick={() => setAdding(true)} aria-label="شاگرد جدید"><Icon name="person_add" /></button>
  const sheet = adding && <AddStudent onClose={() => setAdding(false)} onAdded={() => load()} />
  if (o === null) return <Page><Loading /></Page>
  if (!o || !o.students.length) return <Page actions={addBtn}>
    <Empty icon="group" title="هنوز شاگردی ندارید">اولین شاگرد را با شماره موبایلش اضافه کنید.</Empty>
    <button className="btn glass interactive prominent block" onClick={() => setAdding(true)}><Icon name="person_add" />شاگرد جدید</button>
    {sheet}
  </Page>

  const match = s => !q || (s.full_name + (s.phone || '')).toLowerCase().includes(q.toLowerCase())
  const board = o.board.filter(x => match(x.student))
  const others = o.students.filter(s => !(s.active && s.user_id) && match(s)).sort((a, b) => b.active - a.active)
  const open = id => () => nav('/s/' + id)

  return <Page actions={addBtn}>
    {o.board.length > 0 && <section className="card hero" aria-label="این هفته">
      <div className="hstack between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="caption kicker">این هفته</div>
          <div className="hero-number tnum">{fa(o.sessionsDone)}<span className="hero-of"> از {fa(o.sessionsPlanned)} جلسه</span></div>
          <div className="footnote">{!o.sessionsPlanned ? 'هنوز برنامه‌ای برای این هفته نیست.' : o.behind ? `${fa(o.behind)} شاگرد از برنامه عقب است.` : 'همه طبق برنامه پیش می‌روند.'}</div>
        </div>
        <div style={{ textAlign: 'center' }}><Ring value={o.adherence} /><div className="caption">پایبندی تا امروز</div></div>
      </div>
    </section>}

    {o.students.length > 5 && <div className="field">
      <input className="input" placeholder="جستجوی نام یا شماره" value={q} onChange={e => setQ(e.target.value)} aria-label="جستجوی شاگرد" /></div>}

    {board.length > 0 && <div className="section">
      <div className="section-title">{fa(o.board.length)} شاگرد در حال تمرین</div>
      <div className="group glass-lite">{board.map(x => <WeekRow key={x.student.id} x={x} onOpen={open(x.student.id)} />)}</div>
      <div className="section-footer pips-legend">
        <span><i className="pip done" />انجام شد</span><span><i className="pip missed" />جا ماند</span>
        <span><i className="pip today" />امروز</span><span><i className="pip" />پیش رو</span></div>
    </div>}

    {others.length > 0 && <div className="section">
      <div className="section-title">هنوز شروع نکرده‌اند</div>
      <div className="group glass-lite">{others.map(s => <OtherRow key={s.id} s={s} onOpen={open(s.id)} />)}</div>
    </div>}

    {!q && o.recent.length > 0 && <div className="section">
      <div className="section-title">آخرین تمرین‌ها</div>
      <div className="group glass-lite">{o.recent.slice(0, 5).map(w => <button key={w.id} className="row with-leading pressable" onClick={open(w.student_id)}>
        <div className="tile-icon"><Icon name="fitness_center" /></div>
        <div className="content"><div className="title-text">{o.names[w.student_id] || 'شاگرد'}</div>
          <div className="sub">{w.routine_name || 'تمرین'} · {ago(w.date, today)}</div></div>
        {w.workout_sets?.[0]?.count != null && <span className="pill">{fa(w.workout_sets[0].count)} ست</span>}
        <Disclosure />
      </button>)}</div>
    </div>}
    {sheet}
  </Page>
}
