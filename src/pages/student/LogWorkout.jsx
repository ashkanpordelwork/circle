import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { blankLog, logToRows, todayISO, fmtTarget, tempoWords, needsWeight, canTick } from '../../lib/plan.js'
import { exerciseById, loadExercises } from '../../lib/exercises.js'
import { WeightField, IntField } from '../../components/Wheel.jsx'
import { Page, Loading, useToast, errorText, haptic } from '../../components/ui.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import ExerciseInfo, { Thumb, ExName } from '../../components/ExerciseInfo.jsx'
import { useMe } from '../../App.jsx'
import { loadPlan, sessionTitle } from './data.js'

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

  useEffect(() => {
    (async () => {
      try {
        await loadExercises()   // equipment decides whether a set needs a weight
        const r = (await loadPlan()).find(x => x.id === routineId)
        if (!r) { toast('این برنامه پیدا نشد', 'error'); return nav('/') }
        const last = await must(supabase.from('workouts').select('id').eq('student_id', me.student.id).eq('routine_id', routineId).order('date', { ascending: false }).limit(1))
        const lastSets = last.length ? await must(supabase.from('workout_sets').select('*').eq('workout_id', last[0].id)) : []
        setRoutine(r); setLog(blankLog(r, lastSets))
      } catch (e) { toast(errorText(e), 'error') }
    })()
  }, [routineId])

  if (!log) return <Page title="ثبت تمرین" back noTabbar><Loading /></Page>

  const setVal = (e, s, k, v) => setLog(l => l.map((x, i) => i !== e ? x : { ...x, sets: x.sets.map((y, j) => (j === s ? { ...y, [k]: v } : y)) }))
  // No timer: the student rests as long as they need. Ticking only marks the set done.
  const toggle = (e, s) => {
    const was = log[e].sets[s].done
    setVal(e, s, 'done', !was)
    if (!was) haptic(10)   // the same frame the tick appears
  }
  const doneCount = log.reduce((n, x) => n + x.sets.filter(s => s.done).length, 0)
  const totalSets = log.reduce((n, x) => n + x.sets.length, 0)
  const save = async () => {
    if (!doneCount) return toast('حداقل یک ست را تیک بزن.', 'warning')
    setBusy(true)
    try {
      const w = await must(supabase.from('workouts').insert({ student_id: me.student.id, routine_id: routine.id, routine_name: sessionTitle(routine), date: todayISO(), note }).select().single())
      await must(supabase.from('workout_sets').insert(logToRows(w.id, log)))
      toast('آفرین! تمرین ثبت شد', 'success')
      nav('/')
    } catch (e) { toast(errorText(e), 'error'); setBusy(false) }
  }

  return <Page title={sessionTitle(routine)} subtitle={`${doneCount.toLocaleString('fa-IR')} از ${totalSets.toLocaleString('fa-IR')} ست`} back noTabbar>
    {log.map((ex, e) => {
      const plan = routine.items[e]
      const wNeeded = needsWeight(plan, exerciseById(ex.exercise_id)?.e)
      return <div key={e} className="card glass-lite">
        <button className="row pressable" style={{ padding: 0, marginBottom: '0.75rem' }} onClick={() => setInfo(ex.exercise_id)}>
          <Thumb id={ex.exercise_id} />
          <div className="content"><ExName id={ex.exercise_id} style={{ fontWeight: 650 }} />
            <div className="sub">برنامه: {fmtTarget(plan)}</div>
            {plan.tempo && <div className="sub tempo-line"><Icon name="timer" />{tempoWords(plan.tempo)}</div>}
            {plan.note && <div className="sub">{plan.note}</div>}</div>
          <Disclosure />
        </button>
        <div className="set-grid head"><span className="n">ست</span><span>وزن (کیلو)</span><span>تکرار</span><span /></div>
        {ex.sets.map((s, k) => {
          const ready = canTick(s, wNeeded)
          return <div key={k} className={'set-grid' + (s.done ? ' done' : '')}>
            <span className="n">{(k + 1).toLocaleString('fa-IR')}</span>
            {wNeeded
              ? <WeightField value={s.weight} hint={s.hint} onChange={v => setVal(e, k, 'weight', v)} title={`وزن ست ${(k + 1).toLocaleString('fa-IR')}`} ariaLabel={`وزن ست ${k + 1}`} />
              : <span className="input pick static">وزن بدن</span>}
            <IntField value={s.reps} onChange={v => setVal(e, k, 'reps', v)} title={`تکرار ست ${(k + 1).toLocaleString('fa-IR')}`} max={100} fallback={10} unit="تکرار" ariaLabel={`تکرار ست ${k + 1}`} />
            <button className={'check pressable' + (s.done ? ' on' : ready ? ' ready' : '')} disabled={!s.done && !ready} onClick={() => toggle(e, k)}
              aria-pressed={s.done} aria-label={ready || s.done ? `ست ${k + 1} انجام شد` : `اول وزن ست ${k + 1} را وارد کن`}>
              <Icon name="check" /></button>
          </div>
        })}
        <button className="btn plain small pressable mt" onClick={() => setLog(l => l.map((x, i) => i !== e ? x : { ...x, sets: [...x.sets, { ...x.sets[x.sets.length - 1], done: false }] }))}>
          <Icon name="add" />افزودن ست</button>
      </div>
    })}
    <div className="section">
      <div className="section-title">یادداشت برای مربی</div>
      <textarea className="input" style={{ background: 'var(--lite-fill)', boxShadow: 'inset 0 1px 0.5px var(--glass-specular)' }} placeholder="اختیاری — حس تمرین، درد، هر چیزی که مربی باید بداند" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} />
    </div>
    <button className="btn glass interactive prominent block" disabled={busy} onClick={save}><Icon name="check_circle" />{busy ? 'در حال ثبت…' : 'پایان و ثبت تمرین'}</button>
    {info && <ExerciseInfo id={info} onClose={() => setInfo(null)} />}
  </Page>
}
