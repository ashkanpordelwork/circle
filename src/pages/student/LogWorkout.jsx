import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { blankLog, logToRows, todayISO } from '../../lib/plan.js'
import { exerciseName } from '../../lib/exercises.js'
import { Loading, useToast, errorText } from '../../components/ui.jsx'
import ExerciseInfo, { Frames } from '../../components/ExerciseInfo.jsx'
import { useMe } from '../../App.jsx'
import { loadPlan } from './data.js'

export default function LogWorkout() {
  const { routineId } = useParams()
  const me = useMe()
  const nav = useNavigate()
  const toast = useToast()
  const [routine, setRoutine] = useState(null)
  const [log, setLog] = useState(null)
  const [note, setNote] = useState('')
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rest, setRest] = useState(0)
  useEffect(() => {
    (async () => {
      try {
        const r = (await loadPlan()).find(x => x.id === routineId)
        if (!r) { toast('این روتین پیدا نشد'); return nav('/') }
        // Prefill from the last time this routine was logged.
        const last = await must(supabase.from('workouts').select('id').eq('routine_id', routineId).order('date', { ascending: false }).limit(1))
        const lastSets = last.length ? await must(supabase.from('workout_sets').select('*').eq('workout_id', last[0].id)) : []
        setRoutine(r); setLog(blankLog(r, lastSets))
      } catch (e) { toast(errorText(e)) }
    })()
  }, [routineId])
  useEffect(() => {
    if (rest <= 0) return
    const t = setTimeout(() => setRest(s => s - 1), 1000)
    if (rest === 1 && navigator.vibrate) navigator.vibrate(300)
    return () => clearTimeout(t)
  }, [rest])
  if (!log) return <Loading />

  const setVal = (e, s, k, v) => setLog(l => l.map((x, i) => i !== e ? x : { ...x, sets: x.sets.map((y, j) => (j === s ? { ...y, [k]: v } : y)) }))
  const tick = (e, s) => {
    const was = log[e].sets[s].done
    setVal(e, s, 'done', !was)
    const restSec = Number(routine.items[e].rest_sec) || 90
    if (!was) setRest(restSec)
  }
  const doneCount = log.reduce((n, x) => n + x.sets.filter(s => s.done).length, 0)
  const save = async () => {
    if (!doneCount) return toast('حداقل یک ست را تیک بزن.')
    setBusy(true)
    try {
      const w = await must(supabase.from('workouts').insert({ student_id: me.student.id, routine_id: routine.id, routine_name: routine.name, date: todayISO(), note }).select().single())
      await must(supabase.from('workout_sets').insert(logToRows(w.id, log)))
      toast('آفرین! تمرین ثبت شد 💪')
      nav('/')
    } catch (e) { toast(errorText(e)); setBusy(false) }
  }

  return <>
    <div className="hdr">
      <div><h1>{routine.name}</h1><div className="sub">{doneCount.toLocaleString('fa-IR')} ست انجام شد</div></div>
      <button className="icon-btn" onClick={() => nav(-1)} aria-label="بازگشت">›</button>
    </div>
    {rest > 0 && <div className="card row between" style={{ borderColor: 'var(--acc)', position: 'sticky', top: 8, zIndex: 5 }}>
      <span>⏱️ استراحت: <b>{rest.toLocaleString('fa-IR')}</b> ثانیه</span>
      <button className="btn sm" onClick={() => setRest(0)}>رد کردن</button>
    </div>}
    {log.map((ex, e) => {
      const plan = routine.items[e]
      return <div key={e} className="card">
        <div className="ex-head">
          <button className="btn ghost" style={{ padding: 0 }} onClick={() => setInfo(ex.exercise_id)} aria-label="نمایش حرکت"><Frames id={ex.exercise_id} small /></button>
          <div className="grow"><div className="ltr" style={{ fontWeight: 700 }}>{exerciseName(ex.exercise_id)}</div>
            <div className="small muted">هدف: {plan.sets.toLocaleString('fa-IR')} × {plan.reps}{plan.weight !== '' ? ` · ${plan.weight} kg` : ''}</div>
            {plan.note && <div className="small muted">💬 {plan.note}</div>}</div>
        </div>
        <div className="set-row small muted"><span className="n">#</span><span>وزن (kg)</span><span>تکرار</span><span /></div>
        {ex.sets.map((s, k) => <div key={k} className="set-row">
          <span className="n">{(k + 1).toLocaleString('fa-IR')}</span>
          <input className="input" inputMode="decimal" value={s.weight ?? ''} onChange={v => setVal(e, k, 'weight', v.target.value)} aria-label={`وزن ست ${k + 1}`} />
          <input className="input" inputMode="numeric" value={s.reps ?? ''} onChange={v => setVal(e, k, 'reps', v.target.value)} aria-label={`تکرار ست ${k + 1}`} />
          <button className={'check' + (s.done ? ' on' : '')} onClick={() => tick(e, k)} aria-pressed={s.done} aria-label={`ست ${k + 1} انجام شد`}>✓</button>
        </div>)}
        <button className="btn sm ghost" onClick={() => setLog(l => l.map((x, i) => i !== e ? x : { ...x, sets: [...x.sets, { ...x.sets[x.sets.length - 1], done: false }] }))}>+ ست اضافه</button>
      </div>
    })}
    <div className="card"><textarea className="input" placeholder="یادداشت برای مربی (اختیاری) — حس تمرین، درد، …" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} /></div>
    <button className="btn primary block" disabled={busy} onClick={save}>{busy ? 'در حال ثبت…' : 'پایان و ثبت تمرین'}</button>
    {info && <ExerciseInfo id={info} onClose={() => setInfo(null)} />}
  </>
}
