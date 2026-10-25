import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { routinesForDay, DAY_NAMES, WEEK } from '../../lib/plan.js'
import { exerciseName } from '../../lib/exercises.js'
import { Loading, useToast, errorText } from '../../components/ui.jsx'
import ExerciseInfo, { Frames } from '../../components/ExerciseInfo.jsx'
import { loadPlan } from './data.js'

export default function Week() {
  const nav = useNavigate()
  const toast = useToast()
  const [plan, setPlan] = useState(null)
  const [info, setInfo] = useState(null)
  useEffect(() => { loadPlan().then(setPlan).catch(e => { toast(errorText(e)); setPlan([]) }) }, [])
  if (!plan) return <Loading />
  const today = new Date().getDay()
  return <>
    <div className="hdr"><h1>برنامه هفته</h1></div>
    {!plan.length && <div className="empty">هنوز برنامه‌ای نداری.</div>}
    {plan.length > 0 && WEEK.map(d => {
      const rs = routinesForDay(plan, d)
      return <div key={d} className="card" style={d === today ? { borderColor: 'var(--acc)' } : null}>
        <div className="row between"><b>{DAY_NAMES[d]}{d === today ? ' (امروز)' : ''}</b>{!rs.length && <span className="pill">استراحت</span>}</div>
        {rs.map(r => <div key={r.id} style={{ marginTop: 10 }}>
          <div className="row between"><span style={{ fontWeight: 700 }}>{r.name}</span><button className="btn sm" onClick={() => nav('/log/' + r.id)}>ثبت تمرین</button></div>
          <div className="list" style={{ marginTop: 8 }}>{r.items.map((it, i) => <button key={i} className="item" onClick={() => setInfo(it.exercise_id)}>
            <Frames id={it.exercise_id} small />
            <div className="grow"><div className="t ltr">{exerciseName(it.exercise_id)}</div>
              <div className="s">{it.sets.toLocaleString('fa-IR')} ست × {it.reps}{it.weight !== '' ? ` · ${it.weight} kg` : ''}{it.rest_sec !== '' ? ` · استراحت ${it.rest_sec} ثانیه` : ''}</div>
              {it.note && <div className="s">💬 {it.note}</div>}</div>
          </button>)}</div>
        </div>)}
      </div>
    })}
    {info && <ExerciseInfo id={info} onClose={() => setInfo(null)} />}
  </>
}
