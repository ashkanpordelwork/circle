import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { loadExercises } from '../../lib/exercises.js'
import { summarize, setText, fmtDate, fmtNum } from '../../lib/plan.js'
import { isPhone, normPhone } from '../../lib/phone.js'
import { Page, Loading, Empty, Confirm, Segmented, useToast, errorText } from '../../components/ui.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import { ExName } from '../../components/ExerciseInfo.jsx'
import WeightChart from '../../components/WeightChart.jsx'
import InviteCard from '../../components/InviteCard.jsx'
import { profile, alertLine } from '../../lib/intake.js'
import IntakeSummary from '../../components/IntakeSummary.jsx'
import ProgramTab from './ProgramTab.jsx'
import { useMe } from '../../App.jsx'
import { CoachPicker, adminError } from '../admin/Admin.jsx'
import Screen from '../../components/Screen.jsx'
import { END_REASONS } from '../../lib/session.js'

const END_LABEL = Object.fromEntries(END_REASONS)



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
              <div className="sub">{fmtDate(w.date)} · {sets.length.toLocaleString('fa-IR')} ست{w.duration_sec ? ` · ${Math.max(1, Math.round(w.duration_sec / 60)).toLocaleString('fa-IR')} دقیقه` : ''}</div>
              {w.end_reason && <div className="sub" style={{ color: 'var(--orange)' }}>زودتر تمام شد: {END_LABEL[w.end_reason]}</div>}</div>
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
  const [settings, setSettings] = useState(false)
  const [intake, setIntake] = useState(undefined)
  useEffect(() => {
    // No intakes table yet (migration 0004 not run) reads as "not filled", not as an error.
    supabase.from('intakes').select('answers, completed_at').eq('student_id', id).maybeSingle()
      .then(({ data }) => setIntake(data || null))
  }, [id])
  const me = useMe()
  // An admin may open any coach's student; their own list is not where they came from then.
  const home = me.role === 'coach' ? '/' : '/admin/people?f=student'
  useEffect(() => {
    supabase.from('students').select('*, coaches(full_name)').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error || !data) { toast(error ? errorText(error) : 'شاگرد پیدا نشد', 'error'); nav(home) } else setStudent(data)
    })
  }, [id])
  if (!student) return <Loading />
  const other = student.coach_id !== me.session.user.id
  // Phone and sign-up state live behind the settings button; only a closed account is worth saying
  // up here, and, for an admin looking at someone else's student, whose student it is.
  const sub = [other && `مربی: ${student.coaches?.full_name?.trim() || '—'}`, !student.active && 'دسترسی بسته است'].filter(Boolean).join('، ')
  const gear = <button className="icon-btn glass interactive" onClick={() => setSettings(true)} aria-label="تنظیمات شاگرد"><Icon name="manage_accounts" /></button>
  return <Page title={student.full_name} back={other ? true : '/'} subtitle={sub || null} actions={gear}>
    {/* Until they sign up, the invite is the one thing to do: in plain sight, not under a button. */}
    {!student.user_id && student.active && <button className="alert-strip invite pressable" onClick={() => setSettings(true)}>
      <Icon name="key" /><div className="grow"><div className="title-text">هنوز ثبت‌نام نکرده</div><div className="sub">کد دعوت را ببینید و برایش بفرستید</div></div><Disclosure />
    </button>}
    <Segmented label="بخش‌ها" value={tab} onChange={setTab}
      options={[{ value: 'plan', label: 'برنامه' }, { value: 'progress', label: 'پیشرفت' }, { value: 'profile', label: 'پرونده' }]} />
    {tab === 'plan' && <ProgramTab student={student} intake={intake} onSaved={x => setStudent(cur => ({ ...cur, ...x }))} alerts={intake?.completed_at ? alertLine(profile(intake.answers)) : ''} onAlerts={() => setTab('profile')} />}
    {tab === 'profile' && <ProfileTab student={student} intake={intake} />}
    {tab === 'progress' && <ProgressTab student={student} />}
    {settings && <Screen title={student.user_id ? 'تنظیمات شاگرد' : 'دعوت و تنظیمات'} subtitle={student.full_name} onClose={() => setSettings(false)}>
      <SettingsTab student={student} onSaved={s => setStudent(x => ({ ...x, ...s }))} onRemoved={() => { setSettings(false); nav(home, { replace: true }) }} />
    </Screen>}
  </Page>
}
