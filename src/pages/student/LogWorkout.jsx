import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { blankLog, logToRows, todayISO, fmtTarget, faDigits, showNum, readNum } from '../../lib/plan.js'
import { exerciseName } from '../../lib/exercises.js'
import { Page, Loading, useToast, errorText, haptic } from '../../components/ui.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import ExerciseInfo, { Thumb } from '../../components/ExerciseInfo.jsx'
import { useMe } from '../../App.jsx'
import { loadPlan } from './data.js'

// The rest timer: a floating capsule with a ring that empties as the rest runs out.
function Rest({ total, left, onSkip, onAdd }) {
  const r = 18, c = 2 * Math.PI * r
  return <div className="float-bar no-tabbar"><div className="rest" role="timer" aria-live="off">
    <svg className="ring" viewBox="0 0 44 44" aria-hidden="true">
      <circle className="track" cx="22" cy="22" r={r} />
      <circle className="bar" cx="22" cy="22" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - left / total)} />
    </svg>
    <div className="time">{faDigits(Math.floor(left / 60))}:{faDigits(String(left % 60).padStart(2, '0'))}<div className="caption" style={{ fontWeight: 500 }}>استراحت</div></div>
    <button className="btn small pressable" onClick={onAdd}>+۱۵ ث</button>
    <button className="btn small primary pressable" onClick={onSkip}>رد کردن</button>
  </div></div>
}

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
  const [rest, setRest] = useState(null)   // { total, endsAt }
  const [, tick] = useState(0)
  const timer = useRef(0)

  useEffect(() => {
    (async () => {
      try {
        const r = (await loadPlan()).find(x => x.id === routineId)
        if (!r) { toast('این روتین پیدا نشد', 'error'); return nav('/') }
        const last = await must(supabase.from('workouts').select('id').eq('routine_id', routineId).order('date', { ascending: false }).limit(1))
        const lastSets = last.length ? await must(supabase.from('workout_sets').select('*').eq('workout_id', last[0].id)) : []
        setRoutine(r); setLog(blankLog(r, lastSets))
      } catch (e) { toast(errorText(e), 'error') }
    })()
  }, [routineId])

  // Counts down from the clock, not from ticks, so a backgrounded tab still ends on time.
  useEffect(() => {
    if (!rest) return
    timer.current = setInterval(() => {
      if (Date.now() >= rest.endsAt) { setRest(null); haptic([30, 80, 30]); toast('استراحت تمام شد — ست بعدی', 'info') } else tick(t => t + 1)
    }, 250)
    return () => clearInterval(timer.current)
  }, [rest])

  if (!log) return <Page title="ثبت تمرین" back noTabbar><Loading /></Page>

  const setVal = (e, s, k, v) => setLog(l => l.map((x, i) => i !== e ? x : { ...x, sets: x.sets.map((y, j) => (j === s ? { ...y, [k]: v } : y)) }))
  const toggle = (e, s) => {
    const was = log[e].sets[s].done
    setVal(e, s, 'done', !was)
    if (!was) {
      haptic(10)   // the same frame the tick appears
      const secs = Number(routine.items[e].rest_sec) || 90
      setRest({ total: secs, endsAt: Date.now() + secs * 1000 })
    }
  }
  const doneCount = log.reduce((n, x) => n + x.sets.filter(s => s.done).length, 0)
  const totalSets = log.reduce((n, x) => n + x.sets.length, 0)
  const save = async () => {
    if (!doneCount) return toast('حداقل یک ست را تیک بزن.', 'warning')
    setBusy(true)
    try {
      const w = await must(supabase.from('workouts').insert({ student_id: me.student.id, routine_id: routine.id, routine_name: routine.name, date: todayISO(), note }).select().single())
      await must(supabase.from('workout_sets').insert(logToRows(w.id, log)))
      toast('آفرین! تمرین ثبت شد', 'success')
      nav('/')
    } catch (e) { toast(errorText(e), 'error'); setBusy(false) }
  }
  const left = rest ? Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000)) : 0

  return <Page title={routine.name} subtitle={`${doneCount.toLocaleString('fa-IR')} از ${totalSets.toLocaleString('fa-IR')} ست`} back noTabbar>
    {log.map((ex, e) => {
      const plan = routine.items[e]
      return <div key={e} className="card">
        <button className="row pressable" style={{ padding: 0, marginBottom: '0.75rem' }} onClick={() => setInfo(ex.exercise_id)}>
          <Thumb id={ex.exercise_id} />
          <div className="content"><div className="title-text latin ellipsis" style={{ textAlign: 'right', fontWeight: 650 }}>{exerciseName(ex.exercise_id)}</div>
            <div className="sub">هدف: {fmtTarget(plan)}</div>
            {plan.note && <div className="sub">{plan.note}</div>}</div>
          <Disclosure />
        </button>
        <div className="set-grid head"><span className="n">ست</span><span>وزن (کیلو)</span><span>تکرار</span><span /></div>
        {ex.sets.map((s, k) => <div key={k} className={'set-grid' + (s.done ? ' done' : '')}>
          <span className="n">{(k + 1).toLocaleString('fa-IR')}</span>
          <input className="input num" inputMode="decimal" value={showNum(s.weight ?? '')} onChange={v => setVal(e, k, 'weight', readNum(v.target.value))} aria-label={`وزن ست ${k + 1}`} />
          <input className="input num" inputMode="numeric" value={showNum(s.reps ?? '')} onChange={v => setVal(e, k, 'reps', readNum(v.target.value))} aria-label={`تکرار ست ${k + 1}`} />
          <button className={'check pressable' + (s.done ? ' on' : '')} onClick={() => toggle(e, k)} aria-pressed={s.done} aria-label={`ست ${k + 1} انجام شد`}>
            <Icon name="check" /></button>
        </div>)}
        <button className="btn plain small pressable mt" onClick={() => setLog(l => l.map((x, i) => i !== e ? x : { ...x, sets: [...x.sets, { ...x.sets[x.sets.length - 1], done: false }] }))}>
          <Icon name="add" />ست اضافه</button>
      </div>
    })}
    <div className="section">
      <div className="section-title">یادداشت برای مربی</div>
      <textarea className="input" style={{ background: 'var(--bg-elevated)' }} placeholder="اختیاری — حس تمرین، درد، هر چیزی که مربی باید بداند" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} />
    </div>
    <button className="btn primary block pressable" disabled={busy} onClick={save}><Icon name="check_circle" />{busy ? 'در حال ثبت…' : 'پایان و ثبت تمرین'}</button>
    {/* Room below the last button for the rest capsule, so nothing hides behind it. */}
    {rest && <div style={{ height: '5.5rem' }} aria-hidden="true" />}
    {rest && <Rest total={rest.total} left={left} onSkip={() => setRest(null)} onAdd={() => setRest(r => ({ total: r.total + 15, endsAt: r.endsAt + 15000 }))} />}
    {info && <ExerciseInfo id={info} onClose={() => setInfo(null)} />}
  </Page>
}
