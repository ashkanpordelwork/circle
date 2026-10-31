import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { todayISO, tempoWords, faDigits, toNumber, kg, newItem } from '../../lib/plan.js'
import { exerciseById, loadExercises, MUSCLES, EQUIPMENT } from '../../lib/exercises.js'
import { historyOf, cfgOf, RULE_NAME } from '../../lib/smart.js'
import { weightIncrement } from '../../lib/og/progression.js'
import { buildSession, nextOpen, doneSets, totalSets, summarize, END_REASONS, readDraft, writeDraft, dropDraft } from '../../lib/session.js'
import { Page, Loading, useToast, errorText, haptic } from '../../components/ui.jsx'
import Sheet from '../../components/Sheet.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import ExerciseInfo, { ExName, Frames } from '../../components/ExerciseInfo.jsx'
import Stepper from '../../components/Stepper.jsx'
import RestTimer, { clock } from '../../components/RestTimer.jsx'
import { useMe } from '../../App.jsx'
import { loadPlan, sessionTitle } from './data.js'
import ExercisePicker from '../../components/ExercisePicker.jsx'
import { saveMine } from './Routines.jsx'
import { ReadinessSheet } from '../../components/Readiness.jsx'

// A workout in progress, one exercise at a time: today's suggested weight and why, each set with
// last time beside it, a rest timer after every tick. It survives closing the app (kept on the
// device until saved or thrown away), and ending early asks why — that goes to the coach.

const fa = n => Number(n).toLocaleString('fa-IR')
const store = typeof localStorage === 'undefined' ? null : localStorage

export default function LogWorkout() {
  const { routineId } = useParams()
  const me = useMe()
  const nav = useNavigate()
  const toast = useToast()
  const [routine, setRoutine] = useState(null)
  const [history, setHistory] = useState(null)
  const [log, setLog] = useState(null)
  const [note, setNote] = useState('')
  const [startedAt, setStartedAt] = useState(Date.now())
  const [at, setAt] = useState(0)            // the exercise on screen
  const [rest, setRest] = useState(null)     // { endsAt, total }
  const [sheet, setSheet] = useState(null)   // 'note' | 'end'
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [done, setDone] = useState(null)     // the summary, once saved
  const [, tick] = useState(0)

  useEffect(() => {
    (async () => {
      try {
        await loadExercises()
        const r = (await loadPlan()).find(x => x.id === routineId)
        if (!r) { toast('این جلسه پیدا نشد', 'error'); return nav('/') }
        // Everything logged of these exercises before: the suggestion and last time come from it.
        const ids = [...new Set(r.items.map(i => i.exercise_id))]
        const ws = await must(supabase.from('workouts').select('id, date, created_at, routine_id').eq('student_id', me.student.id).order('date', { ascending: false }).limit(200))
        const sets = ws.length && ids.length ? await must(supabase.from('workout_sets').select('workout_id, exercise_id, set_index, reps, weight').in('workout_id', ws.map(w => w.id)).in('exercise_id', ids)) : []
        const h = historyOf(ws, sets)
        setRoutine(r); setHistory(h)
        const draft = store && readDraft(store, routineId)
        // Exercises added during an instant workout make the session longer than the routine.
        if (draft && draft.log.length >= r.items.length) {
          setLog(draft.log); setNote(draft.note || ''); setStartedAt(draft.startedAt); setAt(Math.min(draft.at || 0, r.items.length - 1))
          toast('تمرین نیمه‌کاره‌ات ادامه پیدا کرد', 'info')
        } else {
          setLog(buildSession(r, h, id => exerciseById(id)?.e).map((e, i) => ({ ...e, item: r.items[i] })))
          // A fresh session asks once a day how the athlete feels (skippable; before 0009, never).
          const { data: check, error } = await supabase.from('readiness_checks').select('date').eq('student_id', me.student.id).eq('date', todayISO()).maybeSingle()
          if (!error && !check) setSheet('ready')
        }
      } catch (e) { toast(errorText(e), 'error') }
    })()
  }, [routineId])

  // The clock in the navbar.
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(t) }, [])
  // Kept on the device after every change, until saved or thrown away.
  useEffect(() => { if (log && !done && store) writeDraft(store, routineId, { log, note, startedAt, at }) }, [log, note, at])

  // Room under the last buttons while the rest timer floats there.
  useEffect(() => { document.documentElement.classList.toggle('has-rest', !!rest); return () => document.documentElement.classList.remove('has-rest') }, [!!rest])
  const open = useMemo(() => (log ? nextOpen(log) : null), [log])
  if (!log) return <Page title="ثبت تمرین" back noTabbar><Loading /></Page>
  if (done) return <Summary s={done} title={sessionTitle(routine)} coach={!!me.student.coach_id} onDone={() => nav('/', { replace: true })} />

  // Another exercise, mid-session: it starts like any other, from its history.
  const addExercise = id => {
    const item = newItem(id)
    const [entry] = buildSession({ id: routine.id, items: [item] }, history, y => exerciseById(y)?.e)
    setLog(l => { setAt(l.length); return [...l, { ...entry, item }] })
  }
  const picker = picking && <ExercisePicker routineName={sessionTitle(routine)} added={log.map(e => e.exercise_id)} onPick={addExercise} onClose={() => setPicking(false)} />

  // Leaving an instant workout before its first exercise leaves no empty routine behind.
  const leaveEmpty = async () => {
    store && dropDraft(store, routineId)
    if (routine.owner === 'self' && !routine.items.length) await supabase.from('routines').delete().eq('id', routine.id)
    nav(-1)
  }
  // An instant workout starts empty: the first exercise is the first thing to do.
  if (!log.length) return <Page title={sessionTitle(routine)} subtitle={clock((Date.now() - startedAt) / 1000)} back={leaveEmpty} noTabbar>
    <div className="card glass-lite">
      <div className="headline">اولین حرکت را اضافه کن</div>
      <p className="subhead secondary">حرکت‌ها را حین تمرین یکی‌یکی اضافه کن؛ آخر کار همین‌ها روتینت می‌شوند.</p>
      <button className="btn glass interactive prominent block" onClick={() => setPicking(true)}><Icon name="add" />افزودن حرکت</button>
    </div>
    {picker}
  </Page>

  const ex = log[at]
  const item = ex.item || routine.items[at] || newItem(ex.exercise_id)
  const x = exerciseById(ex.exercise_id)
  const step = weightIncrement(cfgOf(item), 'kg')
  const nDone = doneSets(log), nAll = totalSets(log)
  const elapsed = (Date.now() - startedAt) / 1000

  const edit = fn => setLog(l => l.map((e, i) => (i !== at ? e : { ...e, sets: fn(e.sets) })))
  const setVal = (s, k, v) => edit(sets => sets.map((y, j) => (j === s ? { ...y, [k]: v } : y)))
  const toggle = s => {
    const was = ex.sets[s].done
    // A ticked set with nothing in it would save as nothing: the weight comes first.
    if (!was && ex.weighted && toNumber(ex.sets[s].weight) == null) return toast('اول وزنه‌ی این ست را بنویس.', 'warning')
    setVal(s, 'done', !was)
    if (!was) {
      haptic(10)
      const last = s === ex.sets.length - 1 && at === log.length - 1
      if (!last) setRest({ endsAt: Date.now() + ex.rest * 1000, total: ex.rest })
      // The last set of this exercise ticked: on to the next one.
      if (s === ex.sets.length - 1 && at < log.length - 1 && ex.sets.every((y, j) => j === s || y.done)) setTimeout(() => setAt(a => Math.min(a + 1, log.length - 1)), 350)
    }
  }
  const addSet = () => edit(sets => [...sets, { ...sets[sets.length - 1], done: false, prev: null }])
  const removeSet = () => edit(sets => (sets.length > 1 && !sets[sets.length - 1].done ? sets.slice(0, -1) : sets))

  const save = async reason => {
    if (!nDone) return toast('حداقل یک ست را تیک بزن.', 'warning')
    setBusy(true)
    const duration = Math.round((Date.now() - startedAt) / 1000)
    const base = { student_id: me.student.id, routine_id: routine.id, routine_name: sessionTitle(routine), date: todayISO(), note }
    try {
      let w
      try {
        w = await must(supabase.from('workouts').insert({ ...base, started_at: new Date(startedAt).toISOString(), duration_sec: Math.min(duration, 86400), end_reason: reason || '' }).select().single())
      } catch (e) {
        // Before migration 0007 the workout has no time or reason: save it without them.
        if (!/started_at|duration_sec|end_reason|column/i.test(String(e?.message))) throw e
        w = await must(supabase.from('workouts').insert(base).select().single())
      }
      const rows = []
      for (const e of log) {
        let n = 0
        for (const s of e.sets) {
          if (!s.done) continue
          rows.push({ workout_id: w.id, exercise_id: e.exercise_id, set_index: ++n, reps: toNumber(s.reps) == null ? null : Math.round(toNumber(s.reps)), weight: e.weighted ? toNumber(s.weight) : null })
        }
      }
      await must(supabase.from('workout_sets').insert(rows))
      // Exercises added to one of the athlete's own routines stay in it for next time.
      if (routine.owner === 'self' && log.length > routine.items.length) {
        const added = log.slice(routine.items.length).map(e => ({ ...e.item, sets: e.sets.length, reps: String(toNumber(e.sets[0]?.reps) ?? e.item.reps) }))
        await saveMine(routine.id, routine.name, [...routine.items, ...added]).catch(() => {})
      }
      store && dropDraft(store, routineId)
      setRest(null); setSheet(null)
      setDone(summarize(log, history, duration))
      haptic([20, 60, 20])
    } catch (e) { toast(errorText(e), 'error'); setBusy(false) }
  }
  const finish = () => (open ? setSheet('end') : save(''))
  const discard = () => { store && dropDraft(store, routineId); nav('/', { replace: true }) }
  // Back with nothing ticked just leaves; with sets done, it is ending early.
  const leave = () => (nDone ? setSheet('end') : discard())

  const p = ex.suggestion
  const showTip = p && p.kind !== 'off' && p.why
  return <Page title={sessionTitle(routine)} subtitle={`${clock(elapsed)} · ${fa(nDone)} از ${fa(nAll)} ست`} back={leave} noTabbar
    actions={<button className="btn glass interactive prominent small" onClick={finish} disabled={busy}><Icon name="check" />پایان</button>}>
    <div className="workout-progress" aria-hidden="true"><span style={{ transform: `scaleX(${nAll ? nDone / nAll : 0})` }} /></div>

    <div className="ex-head">
      <div className="caption">حرکت {fa(at + 1)} از {fa(log.length)}</div>
      <div className="ex-pips" aria-hidden="true">{log.map((e, i) => <button key={i} className={'pip' + (e.sets.every(s => s.done) ? ' done' : i === at ? ' today' : '')} onClick={() => setAt(i)} tabIndex={-1} />)}</div>
    </div>

    <section className="card glass-lite ex-card">
      <Frames id={ex.exercise_id} />
      <div className="hstack between ex-title">
        <div className="grow"><ExName id={ex.exercise_id} className="title" /></div>
        <button className="icon-btn glass interactive" onClick={() => setInfo(ex.exercise_id)} aria-label="روش اجرا"><Icon name="info" /></button>
      </div>
      {x && <div className="hstack wrap">
        {x.m.slice(0, 2).map(m => <span key={m} className="pill">{MUSCLES[m] || m}</span>)}
        {x.e && <span className="pill">{EQUIPMENT[x.e] || x.e}</span>}
      </div>}
      {(item.note || item.tempo) && <div className="coach-says">
        <div className="caption kicker">{routine.owner === 'self' ? 'نکته' : 'مربی گفته'}</div>
        {item.note && <div className="subhead">{item.note}</div>}
        {item.tempo && <div className="sub tempo-line"><Icon name="timer" />{tempoWords(item.tempo)}</div>}
      </div>}
    </section>

    {showTip && <div className={'tip-card ' + p.kind}>
      <div className="tip-head">
        <Icon name={p.kind === 'up' ? 'trending_up' : p.kind === 'deload' ? 'trending_down' : 'flag'} />
        <span className="caption kicker">{p.kind === 'first' ? 'جلسه‌ی اول' : 'پیشنهاد امروز'}</span>
        <span className="caption grow" style={{ textAlign: 'left' }}>{RULE_NAME[p.policy]}</span>
      </div>
      {(p.weight != null && ex.weighted || p.reps != null) && <div className="tip-value tnum">
        {ex.weighted && p.weight != null ? kg(p.weight) : ''}{ex.weighted && p.weight != null && p.reps != null ? ' × ' : ''}{p.reps != null ? `${faDigits(p.reps)} تکرار` : ''}
      </div>}
      <div className="subhead">{p.why}</div>
    </div>}

    <div className="section">
      {ex.sets.map((s, k) => {
        const active = open && open[0] === at && open[1] === k
        return <div key={k} className={'set-card' + (s.done ? ' done' : '') + (active ? ' active' : '')}>
          <div className="set-top">
            <span className="set-n">ست {fa(k + 1)}</span>
            {s.prev && <span className="caption">دفعه‌ی قبل: {ex.weighted && s.prev.w ? `${faDigits(s.prev.w)} × ` : ''}{faDigits(s.prev.r)}</span>}
          </div>
          <div className="set-body">
            {ex.weighted && <Stepper value={s.weight} onChange={v => setVal(k, 'weight', v)} step={step} max={500} unit="کیلو" label={`وزنه‌ی ست ${k + 1}`} disabled={s.done} />}
            <Stepper value={s.reps} onChange={v => setVal(k, 'reps', v)} max={100} unit="تکرار" label={`تکرار ست ${k + 1}`} disabled={s.done} />
            <button className={'check big pressable' + (s.done ? ' on' : active ? ' ready' : '')} onClick={() => toggle(k)} aria-pressed={s.done} aria-label={`ست ${k + 1} انجام شد`}>
              <Icon name="check" /></button>
          </div>
        </div>
      })}
      <div className="hstack set-tools">
        <button className="btn glass interactive small grow" onClick={removeSet} disabled={ex.sets.length < 2 || ex.sets[ex.sets.length - 1].done}><Icon name="remove" />حذف ست</button>
        <button className="btn glass interactive small grow" onClick={addSet}><Icon name="add" />افزودن ست</button>
      </div>
    </div>

    <div className="section"><div className="group glass-lite">
      <button className="row pressable with-leading" onClick={() => setSheet('note')}>
        <div className="tile-icon"><Icon name="sticky_note_2" /></div>
        <div className="content"><div className="title-text">یادداشت تمرین</div><div className="sub ellipsis">{note || 'حس امروز، درد، هر چیزی که بخواهی یادت بماند'}</div></div>
        <Disclosure />
      </button>
    </div></div>

    <button className="btn glass interactive block add-ex" onClick={() => setPicking(true)}><Icon name="add" />افزودن حرکت</button>
    <div className="ex-nav">
      <button className="btn glass interactive grow" disabled={at === 0} onClick={() => setAt(at - 1)}><Icon name="chevron_right" />قبلی</button>
      {at < log.length - 1
        ? <button className="btn glass interactive grow" onClick={() => setAt(at + 1)}>بعدی<Icon name="chevron_left" /></button>
        : <button className="btn glass interactive prominent grow" onClick={finish} disabled={busy}><Icon name="check" />پایان تمرین</button>}
    </div>

    {rest && <RestTimer rest={rest} onChange={setRest} onDone={() => setRest(null)} />}
    {sheet === 'ready' && <ReadinessSheet onClose={() => setSheet(null)} />}
    {sheet === 'note' && <NoteSheet note={note} coach={!!me.student.coach_id} onSave={setNote} onClose={() => setSheet(null)} />}
    {sheet === 'end' && <EndSheet left={nAll - nDone} busy={busy} onFinish={save} onDiscard={discard} onClose={() => setSheet(null)} note={note} setNote={setNote} />}
    {info && <ExerciseInfo id={info} onClose={() => setInfo(null)} />}
    {picker}
  </Page>
}

function NoteSheet({ note, coach, onSave, onClose }) {
  const [text, setText] = useState(note)
  return <Sheet title="یادداشت تمرین" onClose={() => { onSave(text.trim()); onClose() }}>
    <p className="subhead secondary" style={{ marginTop: 0 }}>همراه این تمرین در سابقه‌ات ثبت می‌شود{coach ? ' و مربی هم می‌بیند' : ''}.</p>
    <textarea className="input" autoFocus placeholder="انرژی، درد، وسیله‌ای که نبود، هر چیزی که ارزش یادآوری دارد" value={text} onChange={e => setText(e.target.value)} maxLength={1000} />
    <div className="caption" style={{ textAlign: 'left', marginTop: '0.25rem' }}>{fa(text.length)}/{fa(1000)}</div>
    <button className="btn glass interactive prominent block mt" onClick={() => { onSave(text.trim()); onClose() }}>ذخیره</button>
  </Sheet>
}

// Ending before the last set: why (optional), a note, then save, throw away, or keep going.
function EndSheet({ left, busy, onFinish, onDiscard, onClose, note, setNote }) {
  const [reason, setReason] = useState('')
  const [sure, setSure] = useState(false)
  const t = useRef(null)
  useEffect(() => () => clearTimeout(t.current), [])
  return <Sheet title="پایان زودتر؟" onClose={onClose}>
    <p className="subhead secondary" style={{ marginTop: 0 }}>{fa(left)} ست باز مانده. ست‌هایی که انجام دادی ثبت می‌شوند.</p>
    <div className="field"><label>دلیل (اختیاری)</label>
      <div className="chips wrap-chips" role="radiogroup">{END_REASONS.map(([k, l]) =>
        <button key={k} type="button" role="radio" aria-checked={reason === k} className={'chip glass-lite pressable' + (reason === k ? ' on' : '')} onClick={() => setReason(reason === k ? '' : k)}>{l}</button>)}</div>
    </div>
    <div className="field"><label>یادداشت (اختیاری)</label>
      <textarea className="input" placeholder="چیزی که بخواهی یادت بماند" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} /></div>
    <button className="btn glass interactive prominent block" disabled={busy} onClick={() => onFinish(reason)}><Icon name="check" />{busy ? 'در حال ثبت…' : 'همین حالا تمام کن'}</button>
    <button className="btn glass interactive danger block mt" onClick={() => {
      if (sure) return onDiscard()
      setSure(true); t.current = setTimeout(() => setSure(false), 3000)
    }}><Icon name="delete" />{sure ? 'دوباره بزن تا دور ریخته شود' : 'دور ریختن تمرین'}</button>
    <button className="btn plain block mt" onClick={onClose}>ادامه‌ی تمرین</button>
  </Sheet>
}

// After saving: what the session added up to, and the records it set.
function Summary({ s, title, coach, onDone }) {
  return <Page title="تمرین ثبت شد" subtitle={title} noTabbar fill>
    <section className="card hero done-hero">
      <div className="hstack" style={{ gap: '1rem' }}>
        <div className="tile-icon big lime"><Icon name="check_circle" filled /></div>
        <div><h2 className="title">آفرین!</h2><div className="footnote">در سابقه‌ات ثبت شد{coach ? ' و مربی هم می‌بیند' : ''}.</div></div>
      </div>
    </section>
    <div className="stats">
      <div className="stat glass-lite"><div className="l">مدت</div><div className="v">{fa(s.minutes)} <span className="of">دقیقه</span></div></div>
      <div className="stat glass-lite"><div className="l">حجم</div><div className="v">{fa(Math.round(s.volume))} <span className="of">کیلو</span></div></div>
      <div className="stat glass-lite"><div className="l">ست</div><div className="v">{fa(s.sets)}<span className="of"> از {fa(s.planned)}</span></div></div>
      <div className="stat glass-lite"><div className="l">تکرار</div><div className="v">{fa(s.reps)}</div></div>
    </div>
    {s.records.length > 0 && <div className="section">
      <div className="section-title">رکوردهای تازه</div>
      <div className="group glass-lite">{s.records.map(r => <div key={r.exercise_id} className="row with-leading">
        <div className="tile-icon lime"><Icon name="emoji_events" filled /></div>
        <div className="content"><ExName id={r.exercise_id} />
          <div className="sub">1RM تخمینی {kg(r.y)} از {faDigits(r.w)} × {faDigits(r.r)}{r.prev ? ` · قبلی ${kg(r.prev)}` : ''}</div></div>
      </div>)}</div>
    </div>}
    <div className="page-end"><button className="btn glass interactive prominent block" onClick={onDone}>تمام</button></div>
  </Page>
}
