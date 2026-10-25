import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { overview, isoMinus, daysBetween } from '../../lib/dashboard.js'
import { todayISO, fmtDate, DAY_SHORT } from '../../lib/plan.js'
import { Page, Loading, Empty, useToast, errorText } from '../../components/ui.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import { useMe } from '../../App.jsx'

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

export default function Dashboard() {
  const me = useMe()
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
          must(supabase.from('routines').select('student_id, days'))
        ])
        const names = Object.fromEntries(students.map(s => [s.id, s.full_name]))
        setO({ ...overview({ students, workouts, routines, today }), names })
      } catch (e) { toast(errorText(e), 'error'); setO(false) }
    })()
  }, [])

  const hello = `سلام ${me.coach.full_name || 'مربی'} · ${fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}`
  if (o === null) return <Page title="داشبورد" subtitle={hello}><Loading /></Page>
  if (!o || !o.total) return <Page title="داشبورد" subtitle={hello}>
    <Empty icon="group" title="هنوز شاگردی ندارید">اولین شاگرد را اضافه کنید تا آمار تمرین‌ها اینجا نمایش داده شود.</Empty>
    <button className="btn glass interactive prominent block" onClick={() => nav('/students')}><Icon name="person_add" />افزودن شاگرد</button>
  </Page>

  const peak = Math.max(1, ...o.perDay.map(d => d.count))
  return <Page title="داشبورد" subtitle={hello}>
    <section className="card hero" aria-label="این هفته">
      <div className="hstack between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="caption kicker">۷ روز اخیر</div>
          <div className="hero-number tnum">{fa(o.week)}</div>
          <div className="footnote">تمرین ثبت‌شده توسط {fa(o.activeThisWeek)} شاگرد</div>
        </div>
        <div style={{ textAlign: 'center' }}><Ring value={o.adherence} /><div className="caption">پایبندی به برنامه</div></div>
      </div>
      <div className="bars" role="img" aria-label={'تمرین‌های هر روز: ' + o.perDay.map(d => fa(d.count)).join('، ')}>
        {o.perDay.map(d => <div key={d.date} className={'bar-col' + (d.date === today ? ' today' : '')}>
          <div className="bar-track"><div className="bar-fill" style={{ height: `${(d.count / peak) * 100}%` }} /></div>
          <div className="bar-n tnum">{d.count ? fa(d.count) : ''}</div>
          <div className="bar-d">{DAY_SHORT[new Date(d.date + 'T12:00:00').getDay()]}</div>
        </div>)}
      </div>
    </section>

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
      <div className="section-title">نیاز به پیگیری</div>
      <div className="group glass-lite">
        {!o.idle.length ? <div className="row with-leading"><div className="tile-icon"><Icon name="check" /></div>
          <div className="content"><div className="title-text">همه فعال‌اند</div><div className="sub">همه شاگردها در هفته اخیر تمرین کرده‌اند.</div></div></div>
          : o.idle.map(x => <button key={x.student.id} className="row with-leading pressable" onClick={() => nav('/s/' + x.student.id)}>
            <div className="tile-icon orange"><Icon name="error" /></div>
            <div className="content"><div className="title-text">{x.student.full_name}</div>
              <div className="sub">{x.days == null ? 'هنوز تمرینی ثبت نکرده' : `${fa(x.days)} روز بدون تمرین`}</div></div>
            <Disclosure />
          </button>)}
      </div>
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
