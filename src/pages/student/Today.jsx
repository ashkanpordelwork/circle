import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { routinesForDay, DAY_NAMES, WEEK, fmtDate, todayISO } from '../../lib/plan.js'
import { exerciseName } from '../../lib/exercises.js'
import { Loading, useToast, errorText } from '../../components/ui.jsx'
import { Frames } from '../../components/ExerciseInfo.jsx'
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
      } catch (e) { toast(errorText(e)); setPlan([]) }
    })()
  }, [])
  if (!plan) return <Loading />
  const today = new Date().getDay()
  const todays = routinesForDay(plan, today)
  // The next day with something on it, for a rest day.
  const next = !todays.length && WEEK.map((_, k) => (today + k + 1) % 7).find(d => routinesForDay(plan, d).length)
  const done = new Set(doneToday.map(w => w.routine_id))

  return <>
    <div className="hdr"><div>
      <h1>سلام {me.student.full_name} 👋</h1>
      <div className="sub">{fmtDate(todayISO())}</div>
    </div></div>
    {me.student.note?.trim() && <div className="card" style={{ borderColor: 'var(--acc)' }}>
      <h2>📌 از طرف مربی</h2>
      <div style={{ whiteSpace: 'pre-wrap' }}>{me.student.note}</div>
    </div>}
    {!plan.length ? <div className="empty"><div className="big">⏳</div>مربی هنوز برنامه‌ات را نفرستاده. به محض آماده شدن، اینجا نمایش داده می‌شود.</div>
      : !todays.length ? <div className="card"><h2>😌 امروز استراحت است</h2>
        {next !== undefined && <div className="muted">جلسه بعد: {DAY_NAMES[next]} — {routinesForDay(plan, next).map(r => r.name).join(' + ')}</div>}
        <button className="btn block" style={{ marginTop: 12 }} onClick={() => nav('/week')}>دیدن برنامه هفته</button>
      </div>
      : todays.map(r => <div key={r.id} className="card">
        <div className="row between"><h2 style={{ margin: 0 }}>🏋️ {r.name}</h2>{done.has(r.id) && <span className="pill ok">✓ انجام شد</span>}</div>
        <div className="list" style={{ margin: '12px 0' }}>{r.items.map((it, i) => <div key={i} className="row">
          <Frames id={it.exercise_id} small />
          <div className="grow"><div className="ltr" style={{ fontWeight: 600 }}>{exerciseName(it.exercise_id)}</div>
            <div className="small muted">{it.sets.toLocaleString('fa-IR')} ست × {it.reps} تکرار{it.weight !== '' ? ` · ${it.weight} kg` : ''}</div></div>
        </div>)}</div>
        <button className="btn primary block" onClick={() => nav('/log/' + r.id)}>{done.has(r.id) ? 'ثبت دوباره' : 'شروع و ثبت تمرین'}</button>
      </div>)}
  </>
}
