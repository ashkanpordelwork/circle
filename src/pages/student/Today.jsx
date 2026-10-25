import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { routinesForDay, DAY_NAMES, WEEK, fmtDate, todayISO, fmtTarget } from '../../lib/plan.js'
import { exerciseName } from '../../lib/exercises.js'
import { Page, Loading, Empty, useToast, errorText } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { Thumb } from '../../components/ExerciseInfo.jsx'
import { useMe } from '../../App.jsx'
import { loadPlan } from './data.js'

export default function Today() {
  const me = useMe()
  const nav = useNavigate()
  const toast = useToast()
  const [plan, setPlan] = useState(null)
  const [doneToday, setDoneToday] = useState([])
  useEffect(() => {
    (async () => {
      try {
        setPlan(await loadPlan())
        setDoneToday(await must(supabase.from('workouts').select('routine_id').eq('date', todayISO())))
      } catch (e) { toast(errorText(e), 'error'); setPlan([]) }
    })()
  }, [])
  const today = new Date().getDay()
  const title = `سلام ${me.student.full_name}`
  if (!plan) return <Page title={title} subtitle={fmtDate(todayISO())}><Loading /></Page>
  const todays = routinesForDay(plan, today)
  const next = !todays.length ? WEEK.map((_, k) => (today + k + 1) % 7).find(d => routinesForDay(plan, d).length) : undefined
  const done = new Set(doneToday.map(w => w.routine_id))

  return <Page title={title} subtitle={fmtDate(todayISO())}>
    {me.student.note?.trim() && <div className="card glass-lite">
      <div className="card-head"><div className="tile-icon orange"><Icon name="sticky_note_2" filled /></div><div className="headline">از طرف مربی</div></div>
      <div className="subhead" style={{ whiteSpace: 'pre-wrap' }}>{me.student.note}</div>
    </div>}

    {!plan.length ? <Empty icon="hourglass_top" title="برنامه‌ات در راه است">مربی هنوز برنامه را نفرستاده. به محض آماده شدن همین‌جا می‌بینی.</Empty>
      : !todays.length ? <div className="card glass-lite">
        <div className="card-head"><div className="tile-icon blue"><Icon name="bedtime" filled /></div>
          <div><div className="headline">امروز روز استراحت است</div>
            {next !== undefined && <div className="footnote">جلسه بعد: {DAY_NAMES[next]} — {routinesForDay(plan, next).map(r => r.name).join(' + ')}</div>}</div></div>
        <button className="btn glass interactive block" onClick={() => nav('/week')}><Icon name="calendar_month" />برنامه هفته</button>
      </div>
      : todays.map(r => <section key={r.id} className="card hero" aria-label={r.name}>
        <div className="hstack between">
          <div><div className="caption">تمرین امروز</div><h2 className="title">{r.name}</h2></div>
          {done.has(r.id) && <span className="pill on-hero"><Icon name="check" />انجام شد</span>}
        </div>
        <div className="footnote" style={{ margin: '0.25rem 0 1rem' }}>{r.items.length.toLocaleString('fa-IR')} حرکت · حدود {Math.max(15, Math.round(r.items.reduce((m, i) => m + i.sets * 2.2, 0))).toLocaleString('fa-IR')} دقیقه</div>
        <div className="group" style={{ background: 'rgba(255,255,255,0.16)', boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.4)' }}>
          {r.items.map((it, i) => <div key={i} className="row" style={{ '--sep-inset': '5.25rem' }}>
            <Thumb id={it.exercise_id} />
            <div className="content"><div className="title-text latin ellipsis" style={{ textAlign: 'right' }}>{exerciseName(it.exercise_id)}</div>
              <div className="sub">{fmtTarget(it)}</div></div>
          </div>)}
        </div>
        <button className="btn glass interactive block mt" style={{ '--glass-tint': 'rgba(255,255,255,0.92)', color: '#15803d' }} onClick={() => nav('/log/' + r.id)}>
          <Icon name="fitness_center" />{done.has(r.id) ? 'ثبت دوباره' : 'شروع تمرین'}</button>
      </section>)}
  </Page>
}
