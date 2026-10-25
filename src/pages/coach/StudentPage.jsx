import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { loadExercises } from '../../lib/exercises.js'
import { WEEK, DAY_NAMES, toDraft, toPayload, draftKey, summarize, setText, fmtTarget, fmtDate, fmtNum, weekView, unscheduled, addToDay, clearDay, splitDay, copyToDays, updateSession, sessionName } from '../../lib/plan.js'
import { isPhone, normPhone } from '../../lib/phone.js'
import { Page, Loading, Empty, Confirm, Segmented, useToast, errorText } from '../../components/ui.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import ExercisePicker from '../../components/ExercisePicker.jsx'
import { Thumb, ExName, ExerciseDetails } from '../../components/ExerciseInfo.jsx'
import Screen from '../../components/Screen.jsx'
import Sheet, { useSheet } from '../../components/Sheet.jsx'
import WeightChart from '../../components/WeightChart.jsx'
import { IntField, RepsField, WeightField, TempoField } from '../../components/Wheel.jsx'
import InviteCard from '../../components/InviteCard.jsx'
import { profile, alertLine } from '../../lib/intake.js'
import IntakeSummary from '../../components/IntakeSummary.jsx'
import { useMe } from '../../App.jsx'
import { CoachPicker, adminError } from '../admin/Admin.jsx'


const faN = n => Number(n).toLocaleString('fa-IR')

/* ---------- the plan: the week, a day, an exercise ---------- */
// The coach thinks in days: «Saturday: chest». The tab shows the seven days; a day opens on its own
// page with its exercises, each one opening in place for sets, reps and weight. Every change is
// saved for the student on its own — there is no save button to forget.

// One exercise of a day: a row that opens in place.
function ItemRow({ item, index, count, open, onToggle, onChange, onMove, onRemove }) {
  const [more, setMore] = useState(false)
  const set = (k, v) => onChange({ ...item, [k]: v })
  return <div className={'item-row' + (open ? ' open' : '')}>
    <button className="row pressable" style={{ '--sep-inset': '5.25rem' }} onClick={onToggle} aria-expanded={open}>
      <Thumb id={item.exercise_id} />
      <div className="content"><ExName id={item.exercise_id} /><div className="sub">{fmtTarget(item)}{item.note ? ' · ' + item.note : ''}</div></div>
      <Icon name={open ? 'expand_less' : 'expand_more'} style={{ color: 'var(--label-3)' }} />
    </button>
    {open && <div className="item-edit">
      <div className="inline-fields">
        <div className="field"><label>ست</label><IntField value={item.sets} onChange={v => set('sets', v)} title="تعداد ست" min={1} max={20} unit="ست" /></div>
        <div className="field"><label>تکرار</label><RepsField value={item.reps} onChange={v => set('reps', v)} /></div>
        <div className="field"><label>وزن (کیلو)</label><WeightField value={item.weight} onChange={v => set('weight', v)} title="وزن پیشنهادی" clearText="بدون وزنه" placeholder="—" /></div>
        <div className="field"><label>استراحت</label><IntField value={item.rest_sec} onChange={v => set('rest_sec', v)} title="استراحت" max={600} step={15} unit="ثانیه" suffix="ثانیه" fallback={90} clearText="بدون استراحت مشخص" placeholder="—" /></div>
      </div>
      {more ? <>
        <div className="field mt"><label>تمپو <span className="caption">(پایین · مکث · بالا · مکث، به ثانیه)</span></label>
          <TempoField value={item.tempo || ''} onChange={v => set('tempo', v)} /></div>
        <div className="field"><label>نکته برای شاگرد</label>
          <input className="input" placeholder="مثلاً آرام پایین بیا" value={item.note} onChange={e => set('note', e.target.value)} maxLength={500} /></div>
        <ExerciseDetails id={item.exercise_id} showEn={false} />
      </> : <button className="btn plain small pressable mt" onClick={() => setMore(true)}><Icon name="expand_more" />تمپو، نکته و روش اجرا</button>}
      <div className="item-actions">
        <button className="icon-btn glass interactive" disabled={index === 0} onClick={() => onMove(-1)} aria-label="بالاتر"><Icon name="arrow_upward" /></button>
        <button className="icon-btn glass interactive" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="پایین‌تر"><Icon name="arrow_downward" /></button>
        <div className="grow" />
        <button className="btn glass interactive danger small" onClick={onRemove}><Icon name="delete" />حذف</button>
      </div>
    </div>}
  </div>
}

// Pick days, in one sheet.
function DaysSheet({ title, text, okText, exclude = [], initial = [], onOk, onClose }) {
  const [days, setDays] = useState(initial)
  return <Sheet title={title} onClose={onClose}><DaysBody text={text} okText={okText} exclude={exclude} days={days} setDays={setDays} onOk={onOk} /></Sheet>
}
function DaysBody({ text, okText, exclude, days, setDays, onOk }) {
  const { close } = useSheet()
  return <>
    {text && <p className="subhead secondary" style={{ marginTop: 0 }}>{text}</p>}
    <div className="days">{WEEK.filter(d => !exclude.includes(d)).map(d => <button key={d} className={'day pressable' + (days.includes(d) ? ' on' : '')}
      aria-pressed={days.includes(d)} onClick={() => setDays(x => (x.includes(d) ? x.filter(y => y !== d) : [...x, d]))}>{DAY_NAMES[d]}</button>)}</div>
    <button className="btn glass interactive prominent block mt" disabled={!days.length} onClick={() => { onOk(days); close() }}>{okText}</button>
  </>
}

// One day of the week on its own page.
function DayScreen({ day, draft, setDraft, onClose }) {
  const sessions = draft.filter(r => r.days.includes(day))
  const [open, setOpen] = useState(null)          // `${sessionId}:${index}` of the exercise opened in place
  const [picking, setPicking] = useState(null)    // the session exercises are added to ('' = new)
  const [sheet, setSheet] = useState(null)
  const others = weekView(draft).filter(x => x.day !== day && x.sessions.length)
  const edit = (id, fn) => setDraft(d => updateSession(d, id, fn))
  return <Screen title={DAY_NAMES[day]} subtitle={sessions.length ? `${faN(sessions.reduce((n, r) => n + r.items.length, 0))} حرکت` : 'استراحت'} onClose={onClose}>
    {!sessions.length && <>
      <Empty icon="bedtime" title="روز استراحت">برای این روز حرکت اضافه کنید، یا برنامه یک روز دیگر را کپی کنید.</Empty>
      <button className="btn glass interactive prominent block" onClick={() => setPicking('')}><Icon name="add" />افزودن حرکت</button>
      {others.length > 0 && <div className="section mt">
        <div className="section-title">مثل یک روز دیگر</div>
        <div className="group glass-lite">{others.map(x => <button key={x.day} className="row pressable with-leading" onClick={() => setDraft(d => copyToDays(d, x.sessions[0].id, [day]))}>
          <div className="tile-icon"><Icon name="content_copy" /></div>
          <div className="content"><div className="title-text">{DAY_NAMES[x.day]}</div><div className="sub">{x.sessions[0].name} · {faN(x.sessions[0].items.length)} حرکت</div></div>
          <Icon name="add" style={{ color: 'var(--accent)' }} />
        </button>)}</div>
      </div>}
    </>}
    {sessions.map(r => <div key={r.id} className="section">
      <div className="field"><label htmlFor={'n' + r.id}>نام جلسه</label>
        <input id={'n' + r.id} className="input" value={r.name} maxLength={80} placeholder={sessionName(day)} onChange={e => { const v = e.target.value; edit(r.id, () => ({ name: v })) }} /></div>
      {r.days.length > 1 && <div className="shared-note">
        <Icon name="content_copy" /><div className="grow">همین جلسه در {r.days.filter(d => d !== day).sort((a, b) => WEEK.indexOf(a) - WEEK.indexOf(b)).map(d => DAY_NAMES[d]).join('، ')} هم هست؛ تغییرها در همه اعمال می‌شود.</div>
        <button className="btn plain small pressable" onClick={() => setDraft(d => splitDay(d, r.id, day))}>جدا کن</button>
      </div>}
      {r.items.length > 0 && <div className="group glass-lite">{r.items.map((it, i) => <ItemRow key={i + it.exercise_id} item={it} index={i} count={r.items.length}
        open={open === r.id + ':' + i} onToggle={() => setOpen(o => (o === r.id + ':' + i ? null : r.id + ':' + i))}
        onChange={next => edit(r.id, cur => ({ items: cur.items.map((x, k) => (k === i ? next : x)) }))}
        onMove={dir => { edit(r.id, cur => { const items = [...cur.items]; const [x] = items.splice(i, 1); items.splice(i + dir, 0, x); return { items } }); setOpen(r.id + ':' + (i + dir)) }}
        onRemove={() => { edit(r.id, cur => ({ items: cur.items.filter((_, k) => k !== i) })); setOpen(null) }} />)}</div>}
      <button className="btn glass interactive prominent block mt" onClick={() => setPicking(r.id)}><Icon name="add" />افزودن حرکت</button>
    </div>)}
    {sessions.length > 0 && <div className="section">
      <div className="group glass-lite">
        <button className="row pressable with-leading" onClick={() => setSheet('copy')}>
          <div className="tile-icon blue"><Icon name="content_copy" /></div>
          <div className="content"><div className="title-text">کپی به روزهای دیگر</div><div className="sub">همین تمرین برای روزهای دیگر هم</div></div><Disclosure /></button>
        <button className="row pressable with-leading" onClick={() => setSheet('rest')}>
          <div className="tile-icon gray"><Icon name="bedtime" /></div>
          <div className="content"><div className="title-text">استراحت</div><div className="sub">حذف تمرین این روز</div></div><Disclosure /></button>
      </div>
    </div>}
    {picking !== null && <ExercisePicker routineName={DAY_NAMES[day]}
      added={(sessions.find(r => r.id === picking) || sessions[0])?.items.map(i => i.exercise_id) || []}
      onPick={id => setDraft(d => addToDay(d, day, [id], picking || undefined))} onClose={() => setPicking(null)} />}
    {sheet === 'copy' && <DaysSheet title="کپی به روزهای دیگر" okText="کپی" exclude={[day]} onClose={() => setSheet(null)}
      text="تمرین این روز روی روزهای انتخاب‌شده کپی می‌شود و جای برنامه قبلی آن روزها را می‌گیرد."
      onOk={days => setDraft(d => copyToDays(d, sessions[0].id, days))} />}
    {sheet === 'rest' && <Confirm title={`${DAY_NAMES[day]} روز استراحت شود؟`} okText="استراحت" danger onClose={() => setSheet(null)}
      text="حرکت‌های این روز حذف می‌شود. اگر همین جلسه در روزهای دیگر هم باشد، آنجا می‌ماند."
      onOk={() => setDraft(d => clearDay(d, day))} />}
  </Screen>
}

// Saves the plan and the note a moment after the last change, one save at a time.
function useAutosave(student, draft, note, onSaved) {
  const toast = useToast()
  const [status, setStatus] = useState('saved')   // saved | pending | saving | error
  const saved = useRef(null)
  const latest = useRef({ draft, note })
  latest.current = { draft, note }
  const chain = useRef(Promise.resolve())
  const alive = useRef(true)
  const save = () => {
    const { draft: d, note: n } = latest.current
    if (!d || saved.current === null) return
    const key = draftKey(d, n)
    if (key === saved.current) return
    chain.current = chain.current.then(async () => {
      if (key === saved.current) return
      if (alive.current) setStatus('saving')
      try {
        await must(supabase.rpc('save_plan', { p_student: student.id, p_routines: toPayload(d) }))
        if (n !== (student.note || '')) await must(supabase.from('students').update({ note: n }).eq('id', student.id))
        saved.current = key
        if (alive.current) { onSaved({ note: n }); setStatus(draftKey(latest.current.draft, latest.current.note) === key ? 'saved' : 'pending') }
      } catch (e) { if (alive.current) { setStatus('error'); toast(errorText(e), 'error') } }
    })
  }
  useEffect(() => {
    if (!draft) return
    if (saved.current === null) { saved.current = draftKey(draft, note); return }   // just loaded
    if (draftKey(draft, note) === saved.current) return
    setStatus('pending')
    const t = setTimeout(save, 700)
    return () => clearTimeout(t)
  }, [draft, note])
  // Leaving the page with a change still waiting: save it now.
  useEffect(() => { alive.current = true; return () => { alive.current = false; save() } }, [])
  return [status, save]
}

function PlanTab({ student, onSaved, alerts, onAlerts }) {
  const toast = useToast()
  const [draft, setDraft] = useState(null)
  const [note, setNote] = useState(student.note || '')
  const [day, setDay] = useState(null)
  const [assigning, setAssigning] = useState(null)
  const [status, retry] = useAutosave(student, draft, note, onSaved)
  useEffect(() => {
    (async () => {
      try {
        await loadExercises()
        const rs = await must(supabase.from('routines').select('*').eq('student_id', student.id))
        const items = rs.length ? await must(supabase.from('routine_items').select('*').in('routine_id', rs.map(r => r.id))) : []
        setDraft(toDraft(rs, items))
      } catch (e) { toast(errorText(e), 'error') }
    })()
  }, [student.id])
  if (!draft) return <Loading />
  const week = weekView(draft)
  const loose = unscheduled(draft)
  return <>
    {alerts && <button className="alert-strip pressable" onClick={onAlerts}>
      <Icon name="warning" filled />
      <div className="grow"><div className="title-text">هنگام انتخاب حرکت مراقب باشید</div><div className="sub">{alerts}</div></div>
      <Disclosure />
    </button>}
    <div className="section">
      <div className="section-title hstack between">
        <span>برنامه هفتگی</span>
        <span className={'save-state ' + status}>{status === 'saved' ? 'ذخیره شد' : status === 'error' ? <button className="btn plain small pressable" onClick={retry}>ذخیره نشد؛ دوباره</button> : 'در حال ذخیره…'}</span>
      </div>
      <div className="group glass-lite">{week.map(({ day: d, sessions }) => <button key={d} className="row pressable with-leading" onClick={() => setDay(d)}>
        <div className={'tile-icon' + (sessions.length ? '' : ' gray')}><Icon name={sessions.length ? 'fitness_center' : 'bedtime'} /></div>
        <div className="content"><div className="title-text">{DAY_NAMES[d]}</div>
          <div className="sub">{sessions.length ? sessions.map(r => `${r.name} · ${faN(r.items.length)} حرکت`).join('، ') : 'استراحت'}</div></div>
        <Disclosure />
      </button>)}</div>
      <div className="section-footer">روی هر روز بزنید تا حرکت‌هایش را بچینید. تغییرها خودکار برای شاگرد ذخیره می‌شود.</div>
    </div>
    {loose.length > 0 && <div className="section">
      <div className="section-title">بدون روز</div>
      <div className="group glass-lite">{loose.map(r => <button key={r.id} className="row pressable with-leading" onClick={() => setAssigning(r)}>
        <div className="tile-icon orange"><Icon name="calendar_month" /></div>
        <div className="content"><div className="title-text">{r.name}</div><div className="sub">{faN(r.items.length)} حرکت · شاگرد نمی‌بیند؛ برایش روز انتخاب کنید</div></div>
        <Disclosure /></button>)}</div>
    </div>}
    <div className="section">
      <div className="section-title">یادداشت برای شاگرد</div>
      <textarea className="input" style={{ background: 'var(--lite-fill)', boxShadow: 'inset 0 1px 0.5px var(--glass-specular)' }} placeholder="در صفحه «امروز» شاگرد نمایش داده می‌شود — نکته، رژیم، هدف…"
        value={note} onChange={e => setNote(e.target.value)} maxLength={2000} />
    </div>
    {day !== null && <DayScreen day={day} draft={draft} setDraft={setDraft} onClose={() => setDay(null)} />}
    {assigning && <DaysSheet title={`روزهای «${assigning.name}»`} okText="ذخیره" onClose={() => setAssigning(null)}
      onOk={days => setDraft(d => updateSession(d, assigning.id, () => ({ days })))} />}
  </>
}

/* ---------- progress ---------- */

function ProgressTab({ student }) {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(null)
  useEffect(() => {
    (async () => {
      try {
        await loadExercises()
        const workouts = await must(supabase.from('workouts').select('*').eq('student_id', student.id).order('date', { ascending: false }).limit(60))
        const sets = workouts.length ? await must(supabase.from('workout_sets').select('*').in('workout_id', workouts.map(w => w.id))) : []
        const weights = await must(supabase.from('body_weights').select('*').eq('student_id', student.id).order('date', { ascending: false }).limit(60))
        setData({ workouts, sets, weights })
      } catch (e) { toast(errorText(e), 'error') }
    })()
  }, [student.id])
  if (!data) return <Loading />
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  return <>
    <div className="stats">
      <div className="stat glass-lite"><div className="v">{data.workouts.length.toLocaleString('fa-IR')}</div><div className="l">تمرین ثبت‌شده</div></div>
      <div className="stat glass-lite"><div className="v">{data.workouts.filter(w => w.date >= monthAgo).length.toLocaleString('fa-IR')}</div><div className="l">در ۳۰ روز اخیر</div></div>
      <div className="stat glass-lite"><div className="v" style={{ fontSize: '1.25rem' }}>{data.workouts[0] ? fmtDate(data.workouts[0].date, { day: 'numeric', month: 'long' }) : '—'}</div><div className="l">آخرین تمرین</div></div>
      <div className="stat glass-lite"><div className="v">{data.weights[0] ? fmtNum(data.weights[0].weight) : '—'}</div><div className="l">وزن فعلی (کیلو)</div></div>
    </div>
    {data.weights.length > 1 && <div className="card glass-lite"><div className="headline">وزن بدن</div><WeightChart points={[...data.weights].reverse()} /></div>}
    <div className="section-title">تمرین‌ها</div>
    {!data.workouts.length ? <Empty icon="history" title="هنوز تمرینی ثبت نشده">وقتی شاگرد تمرینی ثبت کند، اینجا می‌بینید.</Empty>
      : <div className="group glass-lite">{data.workouts.map(w => {
        const sets = data.sets.filter(s => s.workout_id === w.id)
        const sum = summarize(sets)
        const isOpen = open === w.id
        return <div key={w.id}>
          <button className="row pressable" onClick={() => setOpen(isOpen ? null : w.id)} aria-expanded={isOpen}>
            <div className="content"><div className="title-text">{w.routine_name || 'تمرین'}</div>
              <div className="sub">{fmtDate(w.date)} · {sets.length.toLocaleString('fa-IR')} ست</div></div>
            <Icon name={isOpen ? 'expand_less' : 'expand_more'} style={{ color: 'var(--label-3)' }} />
          </button>
          {isOpen && <div style={{ padding: '0 1rem 0.75rem' }}>
            {[...sum.keys()].map(id => <div key={id} style={{ padding: '0.5rem 0' }}>
              <ExName id={id} className="subhead" style={{ fontWeight: 600 }} />
              <div className="footnote tnum">{sets.filter(s => s.exercise_id === id).sort((a, b) => a.set_index - b.set_index).map(setText).join('   ·   ')}</div>
            </div>)}
            {w.note && <div className="footnote" style={{ marginTop: '0.5rem' }}><Icon name="sticky_note_2" style={{ fontSize: '1rem', verticalAlign: 'middle' }} /> {w.note}</div>}
          </div>}
        </div>
      })}</div>}
  </>
}

/* ---------- the student's questionnaire ---------- */

function ProfileTab({ student, intake }) {
  if (intake === undefined) return <Loading />
  if (!intake?.completed_at) return <Empty icon="assignment" title="هنوز پرسشنامه را پر نکرده">
    {student.user_id ? 'شاگرد دفعه بعد که وارد برنامه شود، پرسشنامه را پر می‌کند.' : 'بعد از ثبت‌نام، اولین کار شاگرد پر کردن پرسشنامه است.'}</Empty>
  return <IntakeSummary intake={intake} />
}

/* ---------- settings ---------- */

// What only an admin can do to a student: give them to another coach, or reset a lost login.
function AdminStudentTools({ student, onSaved }) {
  const toast = useToast()
  const [sheet, setSheet] = useState(null)
  return <div className="section">
    <div className="section-title">مدیریت</div>
    <div className="group glass-lite">
      <button className="row pressable with-leading" onClick={() => setSheet('move')}>
        <div className="tile-icon"><Icon name="swap_horiz" /></div>
        <div className="content"><div className="title-text">انتقال به مربی دیگر</div><div className="sub">مربی فعلی: {student.coaches?.full_name?.trim() || '—'}</div></div>
        <Disclosure /></button>
      {student.user_id && <button className="row pressable with-leading" onClick={() => setSheet('reset')}>
        <div className="tile-icon blue"><Icon name="lock_reset" /></div>
        <div className="content"><div className="title-text">بازنشانی ورود</div><div className="sub">برای رمز فراموش‌شده؛ کد دعوت تازه می‌گیرد</div></div>
        <Disclosure /></button>}
    </div>
    {sheet === 'move' && <CoachPicker title="انتقال به مربی دیگر" exclude={student.coach_id} onClose={() => setSheet(null)}
      text="برنامه، پرسشنامه و همه سوابق شاگرد همراهش منتقل می‌شود."
      onPick={async c => {
        await must(supabase.rpc('admin_move_student', { p_student: student.id, p_coach: c.id }))
        onSaved({ coach_id: c.id, coaches: { full_name: c.coach_name } }); toast(`به ${c.coach_name || 'مربی جدید'} منتقل شد`, 'success')
      }} />}
    {sheet === 'reset' && <Confirm title="ورود بازنشانی شود؟" okText="بازنشانی ورود" onClose={() => setSheet(null)}
      text="حساب فعلی شاگرد حذف و یک کد دعوت تازه ساخته می‌شود. با همان شماره دوباره ثبت‌نام می‌کند؛ برنامه و سوابقش می‌ماند."
      onOk={async () => {
        try { const code = await must(supabase.rpc('admin_reset_login', { p_student: student.id })); onSaved({ user_id: null, invite_code: code }); toast('کد دعوت تازه آماده است', 'success') }
        catch (e) { toast(adminError(e), 'error') }
      }} />}
  </div>
}

function SettingsTab({ student, onSaved, onRemoved }) {
  const toast = useToast()
  const me = useMe()
  const [name, setName] = useState(student.full_name)
  const [phone, setPhone] = useState(student.phone || '')
  const [confirm, setConfirm] = useState(false)
  const patch = async (fields, done) => {
    try { const s = await must(supabase.from('students').update(fields).eq('id', student.id).select().single()); onSaved(s); if (done) toast(done, 'success') }
    catch (e) { toast(errorText(e), 'error') }
  }
  const dirty = name.trim() !== student.full_name || normPhone(phone) !== (student.phone || '')
  return <>
    <InviteCard student={student} onNewCode={async () => {
      const { data, error } = await supabase.rpc('new_invite_code')
      if (error) return toast(errorText(error), 'error')
      patch({ invite_code: data }, 'کد جدید ساخته شد؛ کد قبلی دیگر کار نمی‌کند')
    }} />
    <div className="section">
      <div className="section-title">مشخصات</div>
      <div className="card glass-lite" style={{ marginBottom: 0 }}>
        <div className="field"><label>نام</label><input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={60} /></div>
        <div className="field"><label>شماره موبایل</label><input className="input ltr" type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
        <button className="btn glass interactive prominent block" disabled={!dirty} onClick={() => {
          if (!name.trim() || !isPhone(phone)) return toast('نام و شماره موبایل معتبر لازم است.', 'warning')
          patch({ full_name: name.trim(), phone: normPhone(phone) }, 'ذخیره شد')
        }}>ذخیره</button>
      </div>
      {student.user_id && <div className="section-footer">شاگرد با شماره‌ای که ثبت‌نام کرده وارد می‌شود؛ تغییر شماره اینجا روی ورودش اثری ندارد.</div>}
    </div>
    {me.admin && <AdminStudentTools student={student} onSaved={onSaved} />}
    <div className="section">
      <div className="group glass-lite">
        <button className="row pressable" onClick={() => patch({ active: !student.active }, student.active ? 'دسترسی بسته شد' : 'دسترسی باز شد')}>
          <Icon name="lock" style={{ color: 'var(--accent)' }} /><div className="content"><div className="title-text" style={{ color: 'var(--accent)' }}>{student.active ? 'بستن دسترسی' : 'باز کردن دسترسی'}</div></div>
        </button>
        <button className="row pressable" onClick={() => setConfirm(true)}>
          <Icon name="delete" style={{ color: 'var(--red)' }} /><div className="content"><div className="title-text" style={{ color: 'var(--red)' }}>حذف شاگرد</div></div>
        </button>
      </div>
      <div className="section-footer">بستن دسترسی برگشت‌پذیر است و اطلاعات می‌ماند؛ حذف، همه چیز را برای همیشه پاک می‌کند.</div>
    </div>
    {confirm && <Confirm title={`${student.full_name} حذف شود؟`} text="برنامه و همه تمرین‌های ثبت‌شده‌اش برای همیشه پاک می‌شود. این کار برگشت ندارد."
      okText="حذف برای همیشه" danger onOk={async () => {
        try { await must(supabase.from('students').delete().eq('id', student.id)); toast('شاگرد حذف شد', 'success'); onRemoved() }
        catch (e) { toast(errorText(e), 'error') }
      }} onClose={() => setConfirm(false)} />}
  </>
}

export default function StudentPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [student, setStudent] = useState(null)
  const [tab, setTab] = useState('plan')
  const [intake, setIntake] = useState(undefined)
  useEffect(() => {
    // No intakes table yet (migration 0004 not run) reads as "not filled", not as an error.
    supabase.from('intakes').select('answers, completed_at').eq('student_id', id).maybeSingle()
      .then(({ data }) => setIntake(data || null))
  }, [id])
  const me = useMe()
  // An admin may open any coach's student; their own list is not where they came from then.
  const home = me.role === 'coach' ? '/students' : '/admin/students'
  useEffect(() => {
    supabase.from('students').select('*, coaches(full_name)').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error || !data) { toast(error ? errorText(error) : 'شاگرد پیدا نشد', 'error'); nav(home) } else setStudent(data)
    })
  }, [id])
  if (!student) return <Loading />
  const other = student.coach_id !== me.session.user.id
  // Phone and sign-up state live under «تنظیمات»; only a closed account is worth saying up here,
  // and, for an admin looking at someone else's student, whose student it is.
  const sub = [other && `مربی: ${student.coaches?.full_name?.trim() || '—'}`, !student.active && 'دسترسی بسته است'].filter(Boolean).join('، ')
  return <Page title={student.full_name} back={other ? true : '/students'} subtitle={sub || null}>
    <Segmented label="بخش‌ها" value={tab} onChange={setTab}
      options={[{ value: 'plan', label: 'برنامه' }, { value: 'profile', label: 'پرونده' }, { value: 'progress', label: 'پیشرفت' }, { value: 'settings', label: student.user_id ? 'تنظیمات' : 'دعوت' }]} />
    {tab === 'plan' && <PlanTab student={student} onSaved={x => setStudent(cur => ({ ...cur, ...x }))} alerts={intake?.completed_at ? alertLine(profile(intake.answers)) : ''} onAlerts={() => setTab('profile')} />}
    {tab === 'profile' && <ProfileTab student={student} intake={intake} />}
    {tab === 'progress' && <ProgressTab student={student} />}
    {tab === 'settings' && <SettingsTab student={student} onSaved={s => setStudent(x => ({ ...x, ...s }))} onRemoved={() => nav(home)} />}
  </Page>
}
