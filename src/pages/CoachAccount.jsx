import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, must } from '../lib/supabase.js'
import { useMe } from '../App.jsx'
import { phoneOfEmail, fmtPhone } from '../lib/phone.js'
import { fmtDate } from '../lib/plan.js'
import { loadExercises, exerciseName } from '../lib/exercises.js'
import { workoutsCsv, weightsCsv, download } from '../lib/export.js'
import { useToast, errorText } from '../components/ui.jsx'
import Sheet from '../components/Sheet.jsx'
import Icon, { Disclosure } from '../components/Icon.jsx'
import { appUrl } from '../components/InviteCard.jsx'

const fa = n => Number(n).toLocaleString('fa-IR')

// Every row of a table the coach can see; PostgREST hands them out a thousand at a time.
async function all(query) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const page = await must(query().range(from, from + 999))
    out.push(...page)
    if (page.length < 1000) return out
  }
}

function NameSheet({ coach, onSaved, onClose }) {
  const toast = useToast()
  const [name, setName] = useState(coach.full_name || '')
  const [busy, setBusy] = useState(false)
  const save = async e => {
    e.preventDefault()
    if (!name.trim()) return toast('نام را وارد کنید.', 'warning')
    setBusy(true)
    try { onSaved(await must(supabase.from('coaches').update({ full_name: name.trim().slice(0, 60) }).eq('id', coach.id).select().single())); onClose() }
    catch (err) { toast(errorText(err), 'error') } finally { setBusy(false) }
  }
  return <Sheet title="نام شما" onClose={onClose}>
    <form onSubmit={save}>
      <p className="subhead secondary" style={{ marginTop: 0 }}>این نام در متن دعوتی که برای شاگرد می‌فرستید می‌آید.</p>
      <div className="field"><label htmlFor="coach-name">نام و نام خانوادگی</label>
        <input id="coach-name" className="input" value={name} maxLength={60} autoFocus onChange={e => setName(e.target.value)} placeholder="مثلاً اشکان پوردل" /></div>
      <button className="btn glass interactive prominent block" disabled={busy}>{busy ? 'کمی صبر کن…' : 'ذخیره'}</button>
    </form>
  </Sheet>
}

// The coach's own page: who they are, what they have built so far, and the tools around it.
export default function CoachAccount() {
  const me = useMe()
  const nav = useNavigate()
  const toast = useToast()
  const [coach, setCoach] = useState(me.coach)
  const [editing, setEditing] = useState(false)
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState('')
  const phone = phoneOfEmail(me.session.user.email)

  useEffect(() => {
    const count = t => supabase.from(t).select('id', { count: 'exact', head: true }).then(r => r.count ?? 0)
    Promise.all([must(supabase.from('students').select('id, active, user_id')), count('workouts'), count('routines'), count('workout_sets')])
      .then(([students, workouts, routines, sets]) => setStats({
        live: students.filter(s => s.active && s.user_id).length,
        pending: students.filter(s => s.active && !s.user_id).length,
        workouts, routines, sets
      }))
      .catch(e => toast(errorText(e), 'error'))
  }, [])

  const shareApp = async () => {
    const text = `اپ Circle: ${appUrl()}`
    if (navigator.share) return navigator.share({ text }).catch(() => {})
    try { await navigator.clipboard.writeText(text); toast('لینک اپ کپی شد', 'success') } catch { toast('کپی در این مرورگر ممکن نیست', 'warning') }
  }

  const exportData = async kind => {
    setBusy(kind)
    try {
      const students = await must(supabase.from('students').select('id, full_name'))
      const names = Object.fromEntries(students.map(s => [s.id, s.full_name]))
      const stamp = new Date().toISOString().slice(0, 10)
      if (kind === 'workouts') {
        await loadExercises()
        const ws = await all(() => supabase.from('workouts').select('id, student_id, date, routine_name, note, workout_sets(exercise_id, set_index, weight, reps)').order('date', { ascending: false }))
        if (!ws.length) return toast('هنوز تمرینی ثبت نشده است', 'warning')
        download(`circle-workouts-${stamp}.csv`, workoutsCsv(ws, names, exerciseName))
      } else {
        const bw = await all(() => supabase.from('body_weights').select('student_id, date, weight').order('date', { ascending: false }))
        if (!bw.length) return toast('هنوز وزنی ثبت نشده است', 'warning')
        download(`circle-weights-${stamp}.csv`, weightsCsv(bw, names))
      }
    } catch (e) { toast(errorText(e), 'error') } finally { setBusy('') }
  }

  const name = coach.full_name?.trim()
  return <>
    <section className="card glass-lite coach-card">
      <div className="avatar" aria-hidden="true">{name ? [...name][0] : <Icon name="person" filled />}</div>
      <div className="grow">
        <div className="headline">{name || 'نام شما'}</div>
        <div className="sub latin" style={{ textAlign: 'right' }}>{phone ? fmtPhone(phone) : me.session.user.email}</div>
        {coach.created_at && <div className="caption">عضو از {fmtDate(coach.created_at.slice(0, 10), { month: 'long' })} {fmtDate(coach.created_at.slice(0, 10), { year: 'numeric' })}</div>}
      </div>
      <button className="btn glass interactive small" onClick={() => setEditing(true)}><Icon name="edit_note" />{name ? 'ویرایش' : 'افزودن نام'}</button>
    </section>
    {!name && <div className="section-footer" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>نامتان را وارد کنید تا در پیام دعوت شاگردها بیاید.</div>}

    <div className="section">
      <div className="section-title">کارنامه</div>
      <div className="stats">
        <div className="stat glass-lite"><div className="stat-icon"><Icon name="group" filled /></div>
          <div className="v">{stats ? fa(stats.live) : '—'}</div><div className="l">شاگرد فعال{stats?.pending ? ` (${fa(stats.pending)} منتظر)` : ''}</div></div>
        <div className="stat glass-lite"><div className="stat-icon blue"><Icon name="calendar_month" /></div>
          <div className="v">{stats ? fa(stats.routines) : '—'}</div><div className="l">برنامه نوشته‌شده</div></div>
        <div className="stat glass-lite"><div className="stat-icon"><Icon name="fitness_center" /></div>
          <div className="v">{stats ? fa(stats.workouts) : '—'}</div><div className="l">جلسه تمرین ثبت‌شده</div></div>
        <div className="stat glass-lite"><div className="stat-icon orange"><Icon name="trending_up" /></div>
          <div className="v">{stats ? fa(stats.sets) : '—'}</div><div className="l">ست زده‌شده</div></div>
      </div>
    </div>

    <div className="section">
      <div className="section-title">ابزارها</div>
      <div className="group glass-lite">
        <button className="row pressable with-leading" onClick={() => nav('/students', { state: { add: true } })}>
          <div className="tile-icon"><Icon name="person_add" /></div>
          <div className="content"><div className="title-text">شاگرد جدید</div><div className="sub">ثبت شماره و گرفتن کد دعوت</div></div><Disclosure /></button>
        <button className="row pressable with-leading" onClick={shareApp}>
          <div className="tile-icon blue"><Icon name="share" /></div>
          <div className="content"><div className="title-text">ارسال لینک اپ</div><div className="sub latin" style={{ textAlign: 'right' }}>{appUrl().replace(/^https?:\/\//, '')}</div></div><Disclosure /></button>
      </div>
    </div>

    <div className="section">
      <div className="section-title">پشتیبان‌گیری</div>
      <div className="group glass-lite">
        <button className="row pressable with-leading" disabled={!!busy} onClick={() => exportData('workouts')}>
          <div className="tile-icon"><Icon name="download" /></div>
          <div className="content"><div className="title-text">خروجی تمرین‌ها</div><div className="sub">همه ست‌های همه شاگردها، برای اکسل</div></div>
          {busy === 'workouts' ? <span className="caption">در حال آماده‌سازی…</span> : <Disclosure />}</button>
        <button className="row pressable with-leading" disabled={!!busy} onClick={() => exportData('weights')}>
          <div className="tile-icon orange"><Icon name="monitor_weight" /></div>
          <div className="content"><div className="title-text">خروجی وزن‌ها</div><div className="sub">وزن‌های ثبت‌شده شاگردها</div></div>
          {busy === 'weights' ? <span className="caption">در حال آماده‌سازی…</span> : <Disclosure />}</button>
      </div>
      <div className="section-footer">فایل CSV است و در Excel و Google Sheets باز می‌شود.</div>
    </div>

    {editing && <NameSheet coach={coach} onClose={() => setEditing(false)} onSaved={c => { setCoach(c); me.setCoach?.(c) }} />}
  </>
}
