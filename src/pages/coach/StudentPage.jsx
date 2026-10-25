import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { exerciseName, loadExercises } from '../../lib/exercises.js'
import { WEEK, DAY_NAMES, DAY_SHORT, toDraft, toPayload, draftKey, newId, isEmail, summarize, setText, fmtDate, fmtNum } from '../../lib/plan.js'
import { Loading, Confirm, useToast, errorText } from '../../components/ui.jsx'
import ExercisePicker from '../../components/ExercisePicker.jsx'
import ExerciseInfo, { Frames } from '../../components/ExerciseInfo.jsx'
import WeightChart from '../../components/WeightChart.jsx'

/* ---------- plan editor ---------- */

function ItemRow({ item, index, count, onChange, onMove, onRemove }) {
  const [info, setInfo] = useState(false)
  const set = (k, v) => onChange({ ...item, [k]: v })
  return <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 10 }}>
    <div className="ex-head">
      <button className="btn ghost" style={{ padding: 0 }} onClick={() => setInfo(true)} aria-label="نمایش حرکت"><Frames id={item.exercise_id} small /></button>
      <div className="grow"><div className="ltr" style={{ fontWeight: 600 }}>{exerciseName(item.exercise_id)}</div></div>
      <button className="icon-btn" disabled={index === 0} onClick={() => onMove(-1)} aria-label="بالا">↑</button>
      <button className="icon-btn" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="پایین">↓</button>
      <button className="icon-btn" onClick={onRemove} aria-label="حذف" style={{ color: 'var(--danger)' }}>✕</button>
    </div>
    <div className="row" style={{ gap: 8 }}>
      <div className="field grow"><label>ست</label><input className="input" inputMode="numeric" value={item.sets} onChange={e => set('sets', e.target.value)} /></div>
      <div className="field grow"><label>تکرار</label><input className="input" placeholder="مثلاً 8-12" value={item.reps} onChange={e => set('reps', e.target.value)} /></div>
      <div className="field grow"><label>وزن (kg)</label><input className="input" inputMode="decimal" value={item.weight} onChange={e => set('weight', e.target.value)} /></div>
      <div className="field grow"><label>استراحت (ث)</label><input className="input" inputMode="numeric" value={item.rest_sec} onChange={e => set('rest_sec', e.target.value)} /></div>
    </div>
    <input className="input" placeholder="نکته (اختیاری)" value={item.note} onChange={e => set('note', e.target.value)} maxLength={500} />
    {info && <ExerciseInfo id={item.exercise_id} onClose={() => setInfo(false)} />}
  </div>
}

function RoutineCard({ r, onChange, onRemove }) {
  const [open, setOpen] = useState(!r.items.length)
  const [picking, setPicking] = useState(false)
  const update = fn => onChange(cur => ({ ...cur, ...fn(cur) }))
  const toggleDay = d => update(cur => ({ days: cur.days.includes(d) ? cur.days.filter(x => x !== d) : [...cur.days, d] }))
  const setItem = (i, next) => update(cur => ({ items: cur.items.map((x, k) => (k === i ? next : x)) }))
  const move = (i, dir) => update(cur => {
    const items = [...cur.items]; const [x] = items.splice(i, 1); items.splice(i + dir, 0, x); return { items }
  })
  const add = id => update(cur => ({ items: [...cur.items, { exercise_id: id, sets: 3, reps: '10', weight: '', rest_sec: '', note: '' }] }))
  return <div className="card">
    <div className="row" style={{ marginBottom: 10 }}>
      <input className="input grow" style={{ fontWeight: 700 }} value={r.name} maxLength={80} onChange={e => { const v = e.target.value; update(() => ({ name: v })) }} aria-label="نام روتین" />
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={open ? 'بستن' : 'باز کردن'}>{open ? '▴' : '▾'}</button>
    </div>
    <div className="days">{WEEK.map(d => <button key={d} className={'day' + (r.days.includes(d) ? ' on' : '')} onClick={() => toggleDay(d)}>{DAY_SHORT[d]}</button>)}</div>
    <div className="small muted" style={{ marginTop: 6 }}>{r.items.length.toLocaleString('fa-IR')} حرکت{r.days.length ? ' · ' + WEEK.filter(d => r.days.includes(d)).map(d => DAY_NAMES[d]).join('، ') : ' · بدون روز'}</div>
    {open && <>
      {r.items.map((it, i) => <ItemRow key={i + it.exercise_id} item={it} index={i} count={r.items.length}
        onChange={next => setItem(i, next)} onMove={dir => move(i, dir)} onRemove={() => update(cur => ({ items: cur.items.filter((_, k) => k !== i) }))} />)}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary grow" onClick={() => setPicking(true)}>+ افزودن حرکت</button>
        <button className="btn danger" onClick={onRemove}>حذف روتین</button>
      </div>
    </>}
    {picking && <ExercisePicker added={r.items.map(i => i.exercise_id)} onPick={add} onClose={() => setPicking(false)} />}
  </div>
}

function PlanTab({ student, onSaved }) {
  const toast = useToast()
  const [draft, setDraft] = useState(null)
  const [note, setNote] = useState(student.note || '')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(null)
  useEffect(() => {
    (async () => {
      try {
        await loadExercises()
        const rs = await must(supabase.from('routines').select('*').eq('student_id', student.id))
        const items = rs.length ? await must(supabase.from('routine_items').select('*').in('routine_id', rs.map(r => r.id))) : []
        const d = toDraft(rs, items)
        setDraft(d); setSaved(draftKey(d, student.note || ''))
      } catch (e) { toast(errorText(e)) }
    })()
  }, [student.id])
  if (!draft) return <Loading />
  const dirty = draftKey(draft, note) !== saved
  const setRoutine = (id, fn) => setDraft(d => d.map(r => (r.id === id ? fn(r) : r)))
  const save = async () => {
    setBusy(true)
    try {
      await must(supabase.rpc('save_plan', { p_student: student.id, p_routines: toPayload(draft) }))
      if (note !== (student.note || '')) await must(supabase.from('students').update({ note }).eq('id', student.id))
      setSaved(draftKey(draft, note)); onSaved({ ...student, note })
      toast(`برنامه برای ${student.full_name} ذخیره شد ✓`)
    } catch (e) { toast(errorText(e)) } finally { setBusy(false) }
  }
  return <>
    <div className="card">
      <h2>یادداشت برای شاگرد</h2>
      <textarea className="input" placeholder="در صفحه اصلی شاگرد نمایش داده می‌شود — نکته، رژیم، هدف…" value={note} onChange={e => setNote(e.target.value)} maxLength={2000} />
    </div>
    {draft.map(r => <RoutineCard key={r.id} r={r} onChange={fn => setRoutine(r.id, fn)} onRemove={() => setRemoving(r)} />)}
    {!draft.length && <div className="empty"><div className="big">📋</div>هنوز روتینی ندارد. یک روتین بسازید و روزهایش را انتخاب کنید.</div>}
    <button className="btn block" onClick={() => setDraft(d => [...d, { id: newId(), name: 'روتین ' + (d.length + 1).toLocaleString('fa-IR'), days: [], items: [] }])}>+ روتین جدید</button>
    {dirty && <div style={{ height: 64 }} />}
    {dirty && <div className="sticky-save"><button className="btn primary block" disabled={busy} onClick={save}>{busy ? 'در حال ذخیره…' : 'ذخیره و ارسال برنامه'}</button></div>}
    {removing && <Confirm title={`«${removing.name}» حذف شود؟`} text="بعد از ذخیره، از برنامه شاگرد حذف می‌شود. تمرین‌های ثبت‌شده باقی می‌مانند." okText="حذف" danger
      onOk={() => setDraft(d => d.filter(r => r.id !== removing.id))} onClose={() => setRemoving(null)} />}
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
      } catch (e) { toast(errorText(e)) }
    })()
  }, [student.id])
  if (!data) return <Loading />
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  return <>
    <div className="stat" style={{ marginBottom: 12 }}>
      <div><div className="v">{data.workouts.length.toLocaleString('fa-IR')}</div><div className="l">تمرین ثبت‌شده</div></div>
      <div><div className="v">{data.workouts.filter(w => w.date >= monthAgo).length.toLocaleString('fa-IR')}</div><div className="l">۳۰ روز اخیر</div></div>
      <div><div className="v">{data.workouts[0] ? fmtDate(data.workouts[0].date, { day: 'numeric', month: 'short' }) : '—'}</div><div className="l">آخرین تمرین</div></div>
      <div><div className="v">{data.weights[0] ? fmtNum(data.weights[0].weight) : '—'}</div><div className="l">وزن فعلی (kg)</div></div>
    </div>
    {data.weights.length > 1 && <div className="card"><h2>وزن بدن</h2><WeightChart points={[...data.weights].reverse()} /></div>}
    <h2 style={{ fontSize: 16 }}>تمرین‌ها</h2>
    {!data.workouts.length ? <div className="empty">هنوز تمرینی ثبت نشده.</div> : <div className="list">{data.workouts.map(w => {
      const sets = data.sets.filter(s => s.workout_id === w.id)
      const sum = summarize(sets)
      return <div key={w.id} className="card" style={{ marginBottom: 0, cursor: 'pointer' }} onClick={() => setOpen(open === w.id ? null : w.id)}>
        <div className="row between"><div><b>{w.routine_name || 'تمرین'}</b><div className="small muted">{fmtDate(w.date)} · {sets.length.toLocaleString('fa-IR')} ست</div></div><span className="muted">{open === w.id ? '▴' : '▾'}</span></div>
        {open === w.id && <div style={{ marginTop: 8 }}>
          {[...sum.keys()].map(id => <div key={id} className="small" style={{ borderTop: '1px solid var(--line)', padding: '6px 0' }}>
            <div className="ltr" style={{ fontWeight: 600 }}>{exerciseName(id)}</div>
            <div className="muted ltr" dir="ltr">{sets.filter(s => s.exercise_id === id).sort((a, b) => a.set_index - b.set_index).map(setText).join('   ·   ')}</div>
          </div>)}
          {w.note && <div className="small muted" style={{ marginTop: 6 }}>📝 {w.note}</div>}
        </div>}
      </div>
    })}</div>}
  </>
}

/* ---------- settings ---------- */

function SettingsTab({ student, onSaved, onRemoved }) {
  const toast = useToast()
  const [name, setName] = useState(student.full_name)
  const [email, setEmail] = useState(student.email)
  const [confirm, setConfirm] = useState(false)
  const save = async () => {
    if (!name.trim() || !isEmail(email)) return toast('نام و جیمیل معتبر لازم است.')
    try {
      const s = await must(supabase.from('students').update({ full_name: name.trim(), email: email.trim().toLowerCase() }).eq('id', student.id).select().single())
      onSaved(s); toast('ذخیره شد')
    } catch (e) { toast(errorText(e)) }
  }
  const setActive = async active => {
    try { const s = await must(supabase.from('students').update({ active }).eq('id', student.id).select().single()); onSaved(s); toast(active ? 'فعال شد' : 'غیرفعال شد') }
    catch (e) { toast(errorText(e)) }
  }
  const remove = async () => {
    try { await must(supabase.from('students').delete().eq('id', student.id)); toast('شاگرد حذف شد'); onRemoved() }
    catch (e) { toast(errorText(e)) }
  }
  return <>
    <div className="card">
      <div className="field"><label>نام</label><input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={60} /></div>
      <div className="field"><label>جیمیل</label><input className="input ltr" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} /></div>
      <button className="btn primary block" onClick={save}>ذخیره</button>
    </div>
    <div className="card">
      <p className="small muted" style={{ marginTop: 0 }}>{student.active ? 'غیرفعال کردن، دسترسی شاگرد را می‌بندد ولی اطلاعاتش می‌ماند.' : 'این شاگرد غیرفعال است و نمی‌تواند برنامه‌اش را ببیند.'}</p>
      <button className="btn block" onClick={() => setActive(!student.active)}>{student.active ? 'غیرفعال کردن' : 'فعال کردن'}</button>
      <div style={{ height: 8 }} />
      <button className="btn danger block" onClick={() => setConfirm(true)}>حذف شاگرد</button>
    </div>
    {confirm && <Confirm title={`${student.full_name} حذف شود؟`} text="برنامه و همه تمرین‌های ثبت‌شده‌اش برای همیشه پاک می‌شود." okText="حذف" danger onOk={remove} onClose={() => setConfirm(false)} />}
  </>
}

export default function StudentPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [student, setStudent] = useState(null)
  const [tab, setTab] = useState('plan')
  useEffect(() => {
    supabase.from('students').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error || !data) { toast(error ? errorText(error) : 'شاگرد پیدا نشد'); nav('/') } else setStudent(data)
    })
  }, [id])
  if (!student) return <Loading />
  return <>
    <div className="hdr">
      <div className="grow">
        <h1>{student.full_name}</h1>
        <div className="sub ltr">{student.email}</div>
      </div>
      <button className="icon-btn" onClick={() => nav('/')} aria-label="بازگشت">›</button>
    </div>
    <div style={{ marginBottom: 12 }}>
      {!student.active ? <span className="pill bad">غیرفعال</span> : student.user_id ? <span className="pill ok">وارد شده</span> : <span className="pill">هنوز وارد نشده</span>}
    </div>
    <div className="tabs" role="tablist">
      {[['plan', 'برنامه'], ['progress', 'پیشرفت'], ['settings', 'تنظیمات']].map(([k, v]) =>
        <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{v}</button>)}
    </div>
    {tab === 'plan' && <PlanTab student={student} onSaved={setStudent} />}
    {tab === 'progress' && <ProgressTab student={student} />}
    {tab === 'settings' && <SettingsTab student={student} onSaved={setStudent} onRemoved={() => nav('/')} />}
  </>
}
