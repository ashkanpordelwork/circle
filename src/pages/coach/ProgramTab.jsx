// The coach writes a student's training as monthly programs: pick a start date on the Persian
// calendar (the end follows: four weeks), say how many sessions a week, then fill each week's
// sessions — «هفته ۱، جلسه ۱» — copying a week forward and adjusting it. Nothing to name, nothing
// to save: every change is stored for the student as it is made.
import { useEffect, useState } from 'react'
import { supabase, must } from '../../lib/supabase.js'
import { loadExercises, exerciseName } from '../../lib/exercises.js'
import { toDraft, todayISO, DAY_NAMES, WEEK } from '../../lib/plan.js'
import { fmtJ, fmtRange, addDays } from '../../lib/jalali.js'
import {
  DURATIONS, sessionLabel, weekLabel, programEnd, weekOf, weekRange, pickPrograms, nextStart, overlaps,
  toProgramDraft, newProgramDraft, weekSessions, weekFilled, setItems, addExercises, copyWeek, copySession,
  resize, seedFrom, seedFromWeekdays, toProgramPayload, programKey
} from '../../lib/program.js'
import { useAutosave, SaveState } from '../../components/autosave.jsx'
import { Loading, Empty, Confirm, useToast, errorText } from '../../components/ui.jsx'
import Screen from '../../components/Screen.jsx'
import Sheet, { useSheet } from '../../components/Sheet.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import ItemRow from '../../components/ItemRow.jsx'
import ExercisePicker from '../../components/ExercisePicker.jsx'
import JalaliCalendar from '../../components/JalaliCalendar.jsx'

const fa = n => Number(n).toLocaleString('fa-IR')

/* ---------- new program / its settings: two short steps ---------- */

function Wizard({ mode, initial, programs, editingId, intakeDays, sources, written, onDone, onDelete, onClose }) {
  const [step, setStep] = useState(0)
  const [start, setStart] = useState(initial.start)
  const [weeks, setWeeks] = useState(initial.weeks)
  const [perWeek, setPerWeek] = useState(initial.perWeek)
  const [seed, setSeed] = useState(sources[0]?.[0] || 'empty')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const end = addDays(start, weeks * 7 - 1)
  const clash = overlaps(programs, start, weeks, editingId)
  const lost = written.filter(s => s.week > weeks || s.session > perWeek).length
  const finish = async () => { setBusy(true); try { await onDone({ start, weeks, perWeek, seed }) } finally { setBusy(false) } }
  return <Screen title={mode === 'new' ? 'برنامه جدید' : 'تنظیمات برنامه'} subtitle={`مرحله ${fa(step + 1)} از ۲`} onClose={onClose}>
    {step === 0 ? <>
      <h2 className="title wizard-q">از چه روزی شروع شود؟</h2>
      <div className="card glass-lite"><JalaliCalendar value={start} rangeEnd={end} onChange={setStart} /></div>
      <div className="card glass-lite range-card">
        <div className="kv"><span>شروع</span><b>{fmtJ(start)}</b></div>
        <div className="kv"><span>پایان</span><b>{fmtJ(end)}</b></div>
        <div className="seg-choice three mt">{DURATIONS.map(([w, l]) => <button key={w} type="button" className={'chip glass-lite pressable' + (weeks === w ? ' on' : '')}
          onClick={() => setWeeks(w)}>{l}<span className="caption">{fa(w)} هفته</span></button>)}</div>
      </div>
      {clash && <div className="shared-note warn"><Icon name="warning" /><div className="grow">این بازه با یک برنامه دیگر همین شاگرد هم‌پوشانی دارد. شاگرد برنامه‌ای را می‌بیند که دیرتر شروع شده.</div></div>}
    </> : <>
      <h2 className="title wizard-q">چند جلسه در هفته؟</h2>
      <div className="days-choice" role="radiogroup">{[1, 2, 3, 4, 5, 6, 7].map(n => <button key={n} type="button" role="radio" aria-checked={perWeek === n}
        className={'chip glass-lite pressable' + (perWeek === n ? ' on' : '')} onClick={() => setPerWeek(n)}>{fa(n)}</button>)}</div>
      {intakeDays && <div className="section-footer">در پرسشنامه گفته {fa(intakeDays)} روز در هفته وقت دارد.</div>}
      {mode === 'new' && sources.length > 0 && <div className="section mt">
        <div className="section-title">شروع با</div>
        <div className="group glass-lite">{[...sources, ['empty', 'برنامه خالی', 'هفته‌ها را از اول می‌نویسید']].map(([k, t, sub]) =>
          <button key={k} type="button" className={'row pressable choice' + (seed === k ? ' on' : '')} onClick={() => setSeed(k)} role="radio" aria-checked={seed === k}>
            <span className={'tick' + (seed === k ? ' on' : '')}>{seed === k && <Icon name="check" />}</span>
            <div className="content"><div className="title-text">{t}</div><div className="sub">{sub}</div></div>
          </button>)}</div>
      </div>}
      {mode === 'edit' && lost > 0 && <div className="shared-note warn mt"><Icon name="warning" /><div className="grow">{fa(lost)} جلسه نوشته‌شده بیرون از برنامه جدید می‌افتد و پاک می‌شود.</div></div>}
      {mode === 'edit' && <button className="btn glass interactive danger block mt" onClick={() => setConfirmDelete(true)}><Icon name="delete" />حذف این برنامه</button>}
    </>}
    <div className="float-bar no-tabbar"><div className="hstack">
      {step === 1 && <button className="btn glass interactive" onClick={() => setStep(0)}><Icon name="chevron_right" />قبلی</button>}
      <button className="btn glass interactive prominent grow" disabled={busy} onClick={() => (step === 0 ? setStep(1) : finish())}>
        {step === 0 ? 'ادامه' : busy ? 'کمی صبر کن…' : mode === 'new' ? 'ساخت برنامه' : 'ذخیره'}{step === 0 && <Icon name="chevron_left" />}</button>
    </div></div>
    {confirmDelete && <Confirm title="این برنامه حذف شود؟" danger okText="حذف برنامه" onClose={() => setConfirmDelete(false)}
      text="همه هفته‌ها و جلسه‌های آن پاک می‌شود. تمرین‌هایی که شاگرد ثبت کرده می‌ماند." onOk={onDelete} />}
  </Screen>
}

/* ---------- one session ---------- */

function WeeksSheet({ title, text, weeks, exclude, onOk, onClose }) {
  return <Sheet title={title} onClose={onClose}><WeeksBody text={text} weeks={weeks} exclude={exclude} onOk={onOk} /></Sheet>
}
function WeeksBody({ text, weeks, exclude, onOk }) {
  const { close } = useSheet()
  const [picked, setPicked] = useState([])
  const all = Array.from({ length: weeks }, (_, k) => k + 1).filter(w => w !== exclude)
  return <>
    {text && <p className="subhead secondary" style={{ marginTop: 0 }}>{text}</p>}
    <div className="days">{all.map(w => <button key={w} className={'day pressable' + (picked.includes(w) ? ' on' : '')} aria-pressed={picked.includes(w)}
      onClick={() => setPicked(x => (x.includes(w) ? x.filter(y => y !== w) : [...x, w]))}>{weekLabel(w)}</button>)}</div>
    <button className="btn plain small pressable mt" onClick={() => setPicked(all.filter(w => w > exclude))}>همه هفته‌های بعد</button>
    <button className="btn glass interactive prominent block mt" disabled={!picked.length} onClick={() => { onOk(picked); close() }}>کپی</button>
  </>
}

function SessionScreen({ draft, setDraft, week, session, onGo, onClose }) {
  const [open, setOpen] = useState(null)
  const [picking, setPicking] = useState(false)
  const [sheet, setSheet] = useState(null)
  const s = weekSessions(draft, week)[session - 1]
  const per = draft.program.per_week
  const edit = fn => setDraft(d => setItems(d, week, session, fn))
  const [a, b] = weekRange(draft.program, week)
  return <Screen title={`${weekLabel(week)}، ${sessionLabel(session)}`} subtitle={fmtRange(a, b)} onClose={onClose}>
    {!s.items.length ? <Empty icon="fitness_center" title="هنوز حرکتی ندارد">حرکت‌های این جلسه را اضافه کنید؛ ست و تکرار هر کدام همان‌جا تنظیم می‌شود.</Empty>
      : <div className="group glass-lite">{s.items.map((it, i) => <ItemRow key={i + it.exercise_id} item={it} index={i} count={s.items.length}
        open={open === i} onToggle={() => setOpen(o => (o === i ? null : i))}
        onChange={next => edit(items => items.map((x, k) => (k === i ? next : x)))}
        onMove={dir => { edit(items => { const c = [...items]; const [x] = c.splice(i, 1); c.splice(i + dir, 0, x); return c }); setOpen(i + dir) }}
        onRemove={() => { edit(items => items.filter((_, k) => k !== i)); setOpen(null) }} />)}</div>}
    <button className="btn glass interactive prominent block mt" onClick={() => setPicking(true)}><Icon name="add" />افزودن حرکت</button>
    {s.items.length > 0 && <div className="section mt"><div className="group glass-lite">
      {draft.program.weeks > 1 && <button className="row pressable with-leading" onClick={() => setSheet('copy')}>
        <div className="tile-icon blue"><Icon name="content_copy" /></div>
        <div className="content"><div className="title-text">کپی به هفته‌های دیگر</div><div className="sub">همین جلسه در هفته‌های انتخابی</div></div><Disclosure /></button>}
      <button className="row pressable with-leading" onClick={() => setSheet('clear')}>
        <div className="tile-icon gray"><Icon name="delete" /></div>
        <div className="content"><div className="title-text">خالی کردن جلسه</div></div><Disclosure /></button>
    </div></div>}
    {per > 1 && <div className="hstack session-nav">
      <button className="btn glass interactive grow" disabled={session === 1} onClick={() => { setOpen(null); onGo(session - 1) }}><Icon name="chevron_right" />{session > 1 ? sessionLabel(session - 1) : 'قبلی'}</button>
      <button className="btn glass interactive grow" disabled={session === per} onClick={() => { setOpen(null); onGo(session + 1) }}>{session < per ? sessionLabel(session + 1) : 'بعدی'}<Icon name="chevron_left" /></button>
    </div>}
    {picking && <ExercisePicker routineName={`${weekLabel(week)}، ${sessionLabel(session)}`} added={s.items.map(i => i.exercise_id)}
      onPick={id => setDraft(d => addExercises(d, week, session, [id]))} onClose={() => setPicking(false)} />}
    {sheet === 'copy' && <WeeksSheet title="کپی به هفته‌های دیگر" weeks={draft.program.weeks} exclude={week} onClose={() => setSheet(null)}
      text={`${sessionLabel(session)} این هفته جای ${sessionLabel(session)} هفته‌های انتخابی را می‌گیرد.`}
      onOk={ws => setDraft(d => copySession(d, week, session, ws))} />}
    {sheet === 'clear' && <Confirm title={`${sessionLabel(session)} خالی شود؟`} danger okText="خالی کن" onClose={() => setSheet(null)}
      onOk={() => edit(() => [])} />}
  </Screen>
}

/* ---------- a program: its weeks and their sessions ---------- */

function ProgramEditor({ student, draft, setDraft, status, onRetry, today, onSettings }) {
  const p = draft.program
  const cur = weekOf(p, today)
  const [week, setWeek] = useState(cur || 1)
  const [session, setSession] = useState(null)
  const [sheet, setSheet] = useState(null)
  const w = Math.min(week, p.weeks)
  const [a, b] = weekRange(p, w)
  const sessions = weekSessions(draft, w)
  const filled = weekFilled(draft, w)
  const nextFilled = w < p.weeks ? weekFilled(draft, w + 1) : 0
  const state = cur ? `در جریان · ${weekLabel(cur)} از ${fa(p.weeks)}` : p.start_date > today ? `شروع ${fmtJ(p.start_date, false)}` : 'تمام شده'
  const copyNext = () => { setDraft(d => copyWeek(d, w, [w + 1])); setWeek(w + 1) }
  return <>
    <section className="card glass-lite program-card">
      <div className="hstack between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className={'caption kicker' + (cur ? '' : ' muted')}>{state}</div>
          <div className="headline">{fmtRange(p.start_date, programEnd(p))}</div>
          <div className="footnote">{fa(p.weeks)} هفته، {fa(p.per_week)} جلسه در هفته</div>
        </div>
        <button className="icon-btn glass interactive" onClick={onSettings} aria-label="تنظیمات برنامه"><Icon name="settings" /></button>
      </div>
    </section>

    <div className="week-tabs" role="tablist" aria-label="هفته‌ها">{Array.from({ length: p.weeks }, (_, k) => k + 1).map(n => {
      const f = weekFilled(draft, n)
      return <button key={n} role="tab" aria-selected={n === w} className={'week-tab pressable' + (n === w ? ' on' : '') + (n === cur ? ' now' : '')} onClick={() => setWeek(n)}>
        <span className="t">{weekLabel(n)}</span>
        <span className={'f' + (f === p.per_week ? ' full' : '')}>{f === p.per_week ? <Icon name="check" /> : `${fa(f)} از ${fa(p.per_week)}`}</span>
      </button>
    })}</div>

    <div className="section">
      <div className="section-title hstack between"><span>{fmtRange(a, b)}{w === cur ? ' · این هفته' : ''}</span><SaveState status={status} onRetry={onRetry} /></div>
      <div className="group glass-lite">{sessions.map(s => <button key={s.session} className="row pressable with-leading" onClick={() => setSession(s.session)}>
        <div className={'tile-icon num' + (s.items.length ? '' : ' gray')}>{fa(s.session)}</div>
        <div className="content"><div className="title-text">{sessionLabel(s.session)}</div>
          <div className={'sub ellipsis' + (s.items.length ? '' : ' warn-text')}>{s.items.length ? `${fa(s.items.length)} حرکت: ${s.items.map(i => exerciseName(i.exercise_id)).join('، ')}` : 'هنوز حرکتی ندارد'}</div></div>
        <Disclosure />
      </button>)}</div>
    </div>

    {filled > 0 && w < p.weeks && <div className="section">
      <button className="btn glass interactive block" onClick={() => (nextFilled ? setSheet('replace') : copyNext())}>
        <Icon name="content_copy" />کپی این هفته به {weekLabel(w + 1)}</button>
      {w + 1 < p.weeks && <button className="btn plain small pressable block mt" onClick={() => setSheet('all')}>کپی به همه هفته‌های بعد</button>}
      <div className="section-footer">هفته بعد را از روی همین هفته بسازید و فقط وزنه‌ها یا تکرارها را بیشتر کنید.</div>
    </div>}

    {session && <SessionScreen draft={draft} setDraft={setDraft} week={w} session={session} onGo={setSession} onClose={() => setSession(null)} />}
    {sheet === 'replace' && <Confirm title={`جایگزینی ${weekLabel(w + 1)}؟`} okText="جایگزین کن" onClose={() => setSheet(null)}
      text={`${weekLabel(w + 1)} الان ${fa(nextFilled)} جلسه نوشته‌شده دارد که با جلسه‌های این هفته عوض می‌شود.`} onOk={copyNext} />}
    {sheet === 'all' && <Confirm title="کپی به همه هفته‌های بعد؟" okText="کپی کن" onClose={() => setSheet(null)}
      text={`هفته‌های ${fa(w + 1)} تا ${fa(p.weeks)} مثل همین هفته می‌شوند و نوشته‌های قبلی‌شان جایگزین می‌شود.`}
      onOk={() => setDraft(d => copyWeek(d, w, Array.from({ length: p.weeks - w }, (_, k) => w + 1 + k)))} />}
  </>
}

// Owns one program's autosave; remounted per program, so switching saves the one left behind.
function ProgramPane({ student, draft, setDraft, today, onSettings, onSaved }) {
  const [status, retry] = useAutosave(draft, programKey, async d => {
    const p = d.program
    await must(supabase.rpc('save_program', { p_program: p.id, p_student: student.id, p_start: p.start_date, p_weeks: p.weeks, p_per_week: p.per_week, p_sessions: toProgramPayload(d) }))
    onSaved?.()
  })
  return <ProgramEditor student={student} draft={draft} setDraft={setDraft} status={status} onRetry={retry} today={today} onSettings={onSettings} />
}

/* ---------- the tab ---------- */

export default function ProgramTab({ student, intake, alerts, onAlerts, onSaved }) {
  const toast = useToast()
  const today = todayISO()
  const [data, setData] = useState(null)       // { programs, drafts: {id: draft}, legacy }
  const [selected, setSelected] = useState(null)
  const [wizard, setWizard] = useState(null)   // { mode: 'new' | 'edit' }
  const [note, setNote] = useState(student.note || '')
  const [noteStatus, noteRetry] = useAutosave(note, n => n, async n => {
    await must(supabase.from('students').update({ note: n }).eq('id', student.id)); onSaved({ note: n })
  })

  useEffect(() => {
    (async () => {
      try {
        await loadExercises()
        const [programs, routines] = await Promise.all([
          must(supabase.from('programs').select('*').eq('student_id', student.id).order('start_date')),
          must(supabase.from('routines').select('*').eq('student_id', student.id))])
        const items = routines.length ? await must(supabase.from('routine_items').select('*').in('routine_id', routines.map(r => r.id))) : []
        const drafts = Object.fromEntries(programs.map(p => [p.id, toProgramDraft(p, routines, items)]))
        setData({ programs, drafts, legacy: toDraft(routines.filter(r => !r.program_id), items) })
        const { current, next } = pickPrograms(programs, today)
        setSelected((current || next || programs.at(-1))?.id || null)
      } catch (e) {
        toast(/programs/.test(e?.message || '') ? 'برای برنامه‌های ماهانه، migration شماره ۶ را در Supabase اجرا کنید.' : errorText(e), 'error')
        setData(false)
      }
    })()
  }, [student.id])

  if (data === null) return <Loading />
  if (!data) return <Empty icon="calendar_month" title="برنامه در دسترس نیست">migration شماره ۶ را در Supabase اجرا کنید.</Empty>
  const { programs, drafts, legacy } = data
  const setDraft = id => fn => setData(d => ({ ...d, drafts: { ...d.drafts, [id]: typeof fn === 'function' ? fn(d.drafts[id]) : fn } }))
  const { current, next } = pickPrograms(programs, today)
  const sel = programs.find(p => p.id === selected)
  const latest = programs.at(-1)
  const sources = [
    latest && drafts[latest.id]?.sessions.some(s => s.items.length) && ['last', 'ادامه برنامه قبلی', `حرکت‌های آخرین هفته ${fmtRange(latest.start_date, programEnd(latest))} در همه هفته‌ها`],
    !programs.length && legacy.some(r => r.items.length) && ['weekdays', 'برنامه فعلی شاگرد', 'جلسه‌های برنامه روزهای هفته، به ترتیب']
  ].filter(Boolean)

  const create = async ({ start, weeks, perWeek, seed }) => {
    let d = newProgramDraft(student, start, weeks, perWeek)
    if (seed === 'last') d = seedFrom(d, drafts[latest.id])
    if (seed === 'weekdays') d = seedFromWeekdays(d, legacy)
    try {
      await must(supabase.rpc('save_program', { p_program: d.program.id, p_student: student.id, p_start: start, p_weeks: weeks, p_per_week: perWeek, p_sessions: toProgramPayload(d) }))
      const p = { id: d.program.id, student_id: student.id, start_date: start, weeks, per_week: perWeek }
      setData(x => ({ ...x, programs: [...x.programs, p].sort((a, b) => a.start_date.localeCompare(b.start_date)), drafts: { ...x.drafts, [p.id]: d } }))
      setSelected(p.id); setWizard(null); onSaved({})
      toast('برنامه ساخته شد؛ حالا جلسه‌ها را بنویسید', 'success')
    } catch (e) { toast(errorText(e), 'error') }
  }
  const editSettings = ({ start, weeks, perWeek }) => {
    setDraft(sel.id)(d => resize(d, { start_date: start, weeks, per_week: perWeek }))
    setData(x => ({ ...x, programs: x.programs.map(p => (p.id === sel.id ? { ...p, start_date: start, weeks, per_week: perWeek } : p)).sort((a, b) => a.start_date.localeCompare(b.start_date)) }))
    setWizard(null)
  }
  const remove = async () => {
    try {
      await must(supabase.from('programs').delete().eq('id', sel.id))
      const rest = programs.filter(p => p.id !== sel.id)
      setData(x => ({ ...x, programs: rest }))
      const pick = pickPrograms(rest, today)
      setSelected((pick.current || pick.next || rest.at(-1))?.id || null); setWizard(null); onSaved({})
      toast('برنامه حذف شد', 'success')
    } catch (e) { toast(errorText(e), 'error') }
  }

  return <>
    {alerts && <button className="alert-strip pressable" onClick={onAlerts}>
      <Icon name="warning" filled />
      <div className="grow"><div className="title-text">هنگام انتخاب حرکت مراقب باشید</div><div className="sub">{alerts}</div></div>
      <Disclosure />
    </button>}

    {!programs.length ? <>
      <section className="card glass-lite start-card">
        <div className="tile-icon"><Icon name="calendar_month" /></div>
        <div className="headline">برنامه یک‌ماهه بنویسید</div>
        <div className="subhead secondary">تاریخ شروع و تعداد جلسه‌ها در هفته را انتخاب کنید؛ بعد هفته به هفته جلسه‌ها را می‌نویسید.</div>
        <button className="btn glass interactive prominent block" onClick={() => setWizard({ mode: 'new' })}><Icon name="add" />برنامه جدید</button>
      </section>
      {legacy.length > 0 && <div className="section">
        <div className="section-title">برنامه فعلی (بر اساس روزهای هفته)</div>
        <div className="group glass-lite">{legacy.map(r => <div key={r.id} className="row with-leading">
          <div className="tile-icon gray"><Icon name="fitness_center" /></div>
          <div className="content"><div className="title-text">{r.name}</div>
            <div className="sub">{r.days.length ? WEEK.filter(d => r.days.includes(d)).map(d => DAY_NAMES[d]).join('، ') : 'بدون روز'} · {fa(r.items.length)} حرکت</div></div>
        </div>)}</div>
        <div className="section-footer">شاگرد تا وقتی برنامه یک‌ماهه ندارد همین را می‌بیند. موقع ساختن برنامه جدید می‌توانید از همین حرکت‌ها شروع کنید.</div>
      </div>}
    </> : <>
      {programs.length > 1 && <div className="chips program-chips">{programs.map(p => <button key={p.id} className={'chip glass-lite pressable' + (p.id === selected ? ' on' : '')}
        onClick={() => setSelected(p.id)}>{fmtRange(p.start_date, programEnd(p))}{p.id === current?.id ? ' · جاری' : ''}</button>)}</div>}
      {sel && <ProgramPane key={sel.id} student={student} draft={drafts[sel.id]} setDraft={setDraft(sel.id)} today={today} onSettings={() => setWizard({ mode: 'edit' })} onSaved={() => onSaved({})} />}
      {!next && <button className="row pressable with-leading next-card glass-lite" onClick={() => setWizard({ mode: 'new' })}>
        <div className="tile-icon"><Icon name="add" /></div>
        <div className="content"><div className="title-text">برنامه ماه بعد</div>
          <div className="sub">از {fmtJ(nextStart(programs, today))}؛ می‌توانید با حرکت‌های همین برنامه شروع کنید</div></div>
        <Disclosure /></button>}
    </>}

    <div className="section">
      <div className="section-title hstack between"><span>یادداشت برای شاگرد</span>{note !== (student.note || '') || noteStatus !== 'saved' ? <SaveState status={noteStatus} onRetry={noteRetry} /> : null}</div>
      <textarea className="input" style={{ background: 'var(--lite-fill)', boxShadow: 'inset 0 1px 0.5px var(--glass-specular)' }} placeholder="در صفحه «امروز» شاگرد نمایش داده می‌شود — نکته، رژیم، هدف…"
        value={note} onChange={e => setNote(e.target.value)} maxLength={2000} />
    </div>

    {wizard && <Wizard mode={wizard.mode} programs={programs} editingId={wizard.mode === 'edit' ? sel.id : null}
      initial={wizard.mode === 'edit' ? { start: sel.start_date, weeks: sel.weeks, perWeek: sel.per_week }
        : { start: nextStart(programs, today), weeks: 4, perWeek: intake?.answers?.days || latest?.per_week || 3 }}
      intakeDays={intake?.answers?.days} sources={wizard.mode === 'new' ? sources : []}
      written={wizard.mode === 'edit' ? drafts[sel.id].sessions.filter(s => s.items.length) : []}
      onDone={wizard.mode === 'new' ? create : editSettings} onDelete={remove} onClose={() => setWizard(null)} />}
  </>
}
