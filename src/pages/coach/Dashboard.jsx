import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { overview, isoMinus, daysBetween } from '../../lib/dashboard.js'
import { todayISO, DAY_NAMES } from '../../lib/plan.js'
import { Page, Loading, Empty, useToast, errorText } from '../../components/ui.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'

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
  today: ['', 'today'], ontrack: ['', 'trending_up'], done: ['', 'check']
}
function weekLine(x) {
  if (x.status === 'noplan') return 'هنوز برنامه‌ای ندارد'
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
      {x.sessions.map((s, i) => <span key={i} className={s.state} title={DAY_NAMES[new Date(s.date + 'T12:00:00').getDay()]} />)}</div>}
    <Disclosure />
  </button>
}

export default function Dashboard() {
  const nav = useNavigate()
  const toast = useToast()
  const [o, setO] = useState(null)
  const today = todayISO()
  useEffect(() => {
    (async () => {
      try {
        const [students, workouts, routines] = await Promise.all([
          must(supabase.from('students').select('id, full_name, user_id, active').order('full_name')),
          must(supabase.from('workouts').select('id, student_id, routine_name, date, created_at, workout_sets(count)').gte('date', isoMinus(today, 60)).order('date', { ascending: false }).limit(1000)),
          must(supabase.from('routines').select('student_id, name, days'))
        ])
        const names = Object.fromEntries(students.map(s => [s.id, s.full_name]))
        setO({ ...overview({ students, workouts, routines, today }), names })
      } catch (e) { toast(errorText(e), 'error'); setO(false) }
    })()
  }, [])

  if (o === null) return <Page><Loading /></Page>
  if (!o || !o.total) return <Page>
    <Empty icon="group" title="هنوز شاگردی ندارید">اولین شاگرد را اضافه کنید تا آمار تمرین‌ها اینجا نمایش داده شود.</Empty>
    <button className="btn glass interactive prominent block" onClick={() => nav('/students')}><Icon name="person_add" />افزودن شاگرد</button>
  </Page>

  return <Page>
    <section className="card hero" aria-label="این هفته">
      <div className="hstack between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="caption kicker">این هفته</div>
          <div className="hero-number tnum">{fa(o.sessionsDone)}<span className="hero-of"> از {fa(o.sessionsPlanned)} جلسه</span></div>
          <div className="footnote">{!o.sessionsPlanned ? 'هنوز برنامه‌ای برای این هفته نیست.' : o.behind ? `${fa(o.behind)} شاگرد از برنامه عقب است.` : 'همه طبق برنامه پیش می‌روند.'}</div>
        </div>
        <div style={{ textAlign: 'center' }}><Ring value={o.adherence} /><div className="caption">پایبندی تا امروز</div></div>
      </div>
    </section>

    {o.board.length > 0 && <div className="section">
      <div className="section-title">شاگردها در این هفته</div>
      <div className="group glass-lite">{o.board.map(x => <WeekRow key={x.student.id} x={x} onOpen={() => nav('/s/' + x.student.id)} />)}</div>
      <div className="section-footer pips-legend">
        <span><i className="pip done" />انجام شد</span><span><i className="pip missed" />جا ماند</span>
        <span><i className="pip today" />امروز</span><span><i className="pip" />پیش رو</span></div>
    </div>}

    <div className="stats">
      <button className="stat glass-lite pressable" onClick={() => nav('/students')}>
        <div className="stat-icon"><Icon name="group" filled /></div><div className="v">{fa(o.live)}</div><div className="l">شاگرد فعال</div></button>
      <button className="stat glass-lite pressable" onClick={() => nav('/students')}>
        <div className="stat-icon orange"><Icon name="hourglass_top" /></div><div className="v">{fa(o.pending)}</div><div className="l">منتظر ثبت‌نام</div></button>
      <div className="stat glass-lite">
        <div className="stat-icon blue"><Icon name="trending_up" /></div><div className="v">{fa(o.activeThisWeek)}<span className="of"> از {fa(o.live)}</span></div><div className="l">تمرین کرده‌اند (این هفته)</div></div>
      <div className="stat glass-lite">
        <div className="stat-icon"><Icon name="fitness_center" /></div><div className="v">{fa(o.month)}</div><div className="l">تمرین در ۳۰ روز</div></div>
    </div>

    <div className="section">
      <div className="section-title">آخرین تمرین‌ها</div>
      {!o.recent.length ? <div className="group glass-lite"><div className="row"><div className="content sub">هنوز تمرینی ثبت نشده است.</div></div></div>
        : <div className="group glass-lite">{o.recent.map(w => <button key={w.id} className="row with-leading pressable" onClick={() => nav('/s/' + w.student_id)}>
          <div className="tile-icon"><Icon name="fitness_center" /></div>
          <div className="content"><div className="title-text">{o.names[w.student_id] || 'شاگرد'}</div>
            <div className="sub">{w.routine_name || 'تمرین'} · {ago(w.date, today)}</div></div>
          {w.workout_sets?.[0]?.count != null && <span className="pill">{fa(w.workout_sets[0].count)} ست</span>}
          <Disclosure />
        </button>)}</div>}
    </div>
  </Page>
}
