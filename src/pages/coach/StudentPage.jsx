import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { exerciseName, loadExercises } from '../../lib/exercises.js'
import { WEEK, DAY_NAMES, DAY_SHORT, toDraft, toPayload, draftKey, newId, summarize, setText, fmtTarget, fmtDate, fmtNum, showNum, readNum } from '../../lib/plan.js'
import { isPhone, normPhone, fmtPhone } from '../../lib/phone.js'
import { Page, Loading, Empty, Confirm, Segmented, useToast, errorText } from '../../components/ui.jsx'
import Sheet, { useSheet } from '../../components/Sheet.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import ExercisePicker from '../../components/ExercisePicker.jsx'
import ExerciseInfo, { Thumb } from '../../components/ExerciseInfo.jsx'
import WeightChart from '../../components/WeightChart.jsx'
import InviteCard from '../../components/InviteCard.jsx'


/* ---------- one exercise, edited in a sheet ---------- */

function ItemEditor({ item, index, count, onChange, onMove, onRemove }) {
  const { close } = useSheet()
  const [info, setInfo] = useState(false)
  const set = (k, v) => onChange({ ...item, [k]: v })
  const field = (k, label, mode = 'numeric', placeholder) => <div className="field">
    <label>{label}</label>
    <input className="input num" inputMode={mode} placeholder={placeholder} value={showNum(item[k] ?? '')} onChange={e => set(k, readNum(e.target.value))} />
  </div>
  return <>
    <button className="row pressable" style={{ padding: 0, marginBottom: '1rem' }} onClick={() => setInfo(true)}>
      <Thumb id={item.exercise_id} />
      <div className="content"><div className="title-text latin" style={{ textAlign: 'right' }}>{exerciseName(item.exercise_id)}</div><div className="sub">نمایش حرکت و روش اجرا</div></div>
      <Disclosure />
    </button>
    <div className="inline-fields">
      {field('sets', 'ست')}
      {field('reps', 'تکرار', 'text', '8-12')}
      {field('weight', 'وزن (کیلو)', 'decimal')}
      {field('rest_sec', 'استراحت (ث)')}
    </div>
    <div className="field mt"><label>نکته برای شاگرد</label>
      <input className="input" placeholder="مثلاً آرام پایین بیا" value={item.note} onChange={e => set('note', e.target.value)} maxLength={500} /></div>
    <div className="hstack">
      <button className="btn glass interactive grow" disabled={index === 0} onClick={() => onMove(-1)}><Icon name="arrow_upward" />بالا</button>
      <button className="btn glass interactive grow" disabled={index === count - 1} onClick={() => onMove(1)}><Icon name="arrow_downward" />پایین</button>
    </div>
    <div className="stack mt">
      <button className="btn glass interactive prominent block" onClick={() => close()}>تمام</button>
      <button className="btn glass interactive danger block" onClick={() => { onRemove(); close() }}><Icon name="delete" />حذف از روتین</button>
    </div>
    {info && <ExerciseInfo id={item.exercise_id} onClose={() => setInfo(false)} />}
  </>
}

/* ---------- a routine ---------- */

function RoutineCard({ r, onChange, onRemove }) {
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState(null)
  const update = fn => onChange(cur => ({ ...cur, ...fn(cur) }))
  const toggleDay = d => update(cur => ({ days: cur.days.includes(d) ? cur.days.filter(x => x !== d) : [...cur.days, d] }))
  const setItem = (i, next) => update(cur => ({ items: cur.items.map((x, k) => (k === i ? next : x)) }))
  const move = (i, dir) => { update(cur => { const items = [...cur.items]; const [x] = items.splice(i, 1); items.splice(i + dir, 0, x); return { items } }); setEditing(i + dir) }
  const add = id => update(cur => ({ items: [...cur.items, { exercise_id: id, sets: 3, reps: '10', weight: '', rest_sec: '', note: '' }] }))
  return <div className="card glass-lite">
    <div className="card-head">
      <div className="tile-icon"><Icon name="fitness_center" /></div>
      <input className="input grow headline" style={{ background: 'transparent', paddingInline: '0.25rem', minHeight: '2.5rem' }} value={r.name} maxLength={80}
        onChange={e => { const v = e.target.value; update(() => ({ name: v })) }} aria-label="نام روتین" />
      <button className="icon-btn bare danger pressable" onClick={onRemove} aria-label="حذف روتین"><Icon name="delete" /></button>
    </div>
    <div className="days" role="group" aria-label="روزهای این روتین">{WEEK.map(d => <button key={d} className={'day pressable' + (r.days.includes(d) ? ' on' : '')}
      aria-pressed={r.days.includes(d)} aria-label={DAY_NAMES[d]} onClick={() => toggleDay(d)}>{DAY_SHORT[d]}</button>)}</div>
    {r.items.length > 0 && <div className="group mt" style={{ background: 'var(--fill)' }}>
      {r.items.map((it, i) => <button key={i + it.exercise_id} className="row pressable" style={{ '--sep-inset': '5.25rem' }} onClick={() => setEditing(i)}>
        <Thumb id={it.exercise_id} />
        <div className="content"><div className="title-text latin ellipsis" style={{ textAlign: 'right' }}>{exerciseName(it.exercise_id)}</div>
          <div className="sub">{fmtTarget(it)}{it.note ? ' · ' + it.note : ''}</div></div>
        <Disclosure />
      </button>)}
    </div>}
    <button className="btn glass interactive block mt" onClick={() => setPicking(true)}><Icon name="add" />افزودن حرکت</button>
    {picking && <ExercisePicker added={r.items.map(i => i.exercise_id)} onPick={add} onClose={() => setPicking(false)} />}
    {editing != null && r.items[editing] && <Sheet title="تنظیم حرکت" onClose={() => setEditing(null)}>
      <ItemEditor item={r.items[editing]} index={editing} count={r.items.length} onChange={next => setItem(editing, next)}
        onMove={dir => move(editing, dir)} onRemove={() => update(cur => ({ items: cur.items.filter((_, k) => k !== editing) }))} />
    </Sheet>}
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
      } catch (e) { toast(errorText(e), 'error') }
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
      toast(`برنامه ${student.full_name} ذخیره شد`, 'success')
    } catch (e) { toast(errorText(e), 'error') } finally { setBusy(false) }
  }
  return <>
    <div className="section">
      <div className="section-title">یادداشت برای شاگرد</div>
      <textarea className="input" style={{ background: 'var(--lite-fill)', boxShadow: 'inset 0 1px 0.5px var(--glass-specular)' }} placeholder="در صفحه «امروز» شاگرد نمایش داده می‌شود — نکته، رژیم، هدف…"
        value={note} onChange={e => setNote(e.target.value)} maxLength={2000} />
    </div>
    <div className="section-title">روتین‌ها</div>
    {draft.map(r => <RoutineCard key={r.id} r={r} onChange={fn => setRoutine(r.id, fn)} onRemove={() => setRemoving(r)} />)}
    {!draft.length && <Empty icon="calendar_month" title="هنوز روتینی ندارد">یک روتین بسازید، روزهایش را انتخاب کنید و حرکت اضافه کنید.</Empty>}
    <button className="btn glass interactive block" onClick={() => setDraft(d => [...d, { id: newId(), name: 'روتین ' + (d.length + 1).toLocaleString('fa-IR'), days: [], items: [] }])}>
      <Icon name="add" />روتین جدید</button>
    {dirty && <div className="float-bar"><button className="btn glass interactive prominent block" disabled={busy} onClick={save}>
      <Icon name="check" />{busy ? 'در حال ذخیره…' : 'ذخیره و ارسال برای شاگرد'}</button></div>}
    {removing && <Confirm title={`«${removing.name}» حذف شود؟`} text="بعد از ذخیره از برنامه شاگرد برداشته می‌شود. تمرین‌های ثبت‌شده‌اش باقی می‌ماند." okText="حذف روتین" danger
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
      } catch (e) { toast(errorText(e), 'error') }
    })()
  }, [student.id])
  if (!data) return <Loading />
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  return <>
    <div className="stats">
      <div className="stat glass-lite"><div className="v">{data.workouts.length.toLocaleString('fa-IR')}</div><div className="l">تمرین ثبت‌شده</div></div>
      <div className="stat glass-lite"><div className="v">{data.workouts.filter(w => w.date >= monthAgo).length.toLocaleString('fa-IR')}</div><div className="l">در ۳۰ روز اخیر</div></div>
      <div className="stat glass-lite"><div className="v" style={{ fontSize: '1.125rem' }}>{data.workouts[0] ? fmtDate(data.workouts[0].date, { day: 'numeric', month: 'long' }) : '—'}</div><div className="l">آخرین تمرین</div></div>
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
            {[...sum.keys()].map(id => <div key={id} style={{ padding: '0.375rem 0' }}>
              <div className="subhead latin" style={{ fontWeight: 600, textAlign: 'right' }}>{exerciseName(id)}</div>
              <div className="footnote tnum">{sets.filter(s => s.exercise_id === id).sort((a, b) => a.set_index - b.set_index).map(setText).join('   ·   ')}</div>
            </div>)}
            {w.note && <div className="footnote" style={{ marginTop: '0.375rem' }}><Icon name="sticky_note_2" style={{ fontSize: '1rem', verticalAlign: 'middle' }} /> {w.note}</div>}
          </div>}
        </div>
      })}</div>}
  </>
}

/* ---------- settings ---------- */

function SettingsTab({ student, onSaved, onRemoved }) {
  const toast = useToast()
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
  useEffect(() => {
    supabase.from('students').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error || !data) { toast(error ? errorText(error) : 'شاگرد پیدا نشد', 'error'); nav('/') } else setStudent(data)
    })
  }, [id])
  if (!student) return <Loading />
  const status = !student.active ? 'دسترسی بسته' : student.user_id ? 'ثبت‌نام کرده' : 'هنوز ثبت‌نام نکرده'
  return <Page title={student.full_name} back="/" subtitle={<><span className="latin">{student.phone ? fmtPhone(student.phone) : ''}</span> · {status}</>}>
    <Segmented label="بخش‌ها" value={tab} onChange={setTab}
      options={[{ value: 'plan', label: 'برنامه' }, { value: 'progress', label: 'پیشرفت' }, { value: 'settings', label: student.user_id ? 'تنظیمات' : 'دعوت و تنظیمات' }]} />
    {tab === 'plan' && <PlanTab student={student} onSaved={setStudent} />}
    {tab === 'progress' && <ProgressTab student={student} />}
    {tab === 'settings' && <SettingsTab student={student} onSaved={setStudent} onRemoved={() => nav('/')} />}
  </Page>
}
