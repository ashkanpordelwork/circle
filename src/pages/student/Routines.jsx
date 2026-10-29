import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { newId, todayISO, toPayload } from '../../lib/plan.js'
import { addDays } from '../../lib/jalali.js'
import { TEMPLATES, LEVEL_NAME } from '../../lib/templates.js'
import { Page, Loading, Segmented, useToast, errorText } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { useMe } from '../../App.jsx'
import { loadStudentPlan } from './data.js'
import { CoachPlan, SessionScreen, minutes } from './plan-parts.jsx'
import { scope } from '../../lib/scope.js'

// «روتین»: the athlete's own routines (start, edit, make new), ready-made ones to copy, and — in
// its own tab — what the coach wrote. The two never mix: the coach's plan is read-only here, and
// the coach cannot change the athlete's own routines.

const fa = n => Number(n).toLocaleString('fa-IR')

// Save one of the athlete's own routines (0008_athletes.sql: save_my_routine).
export async function saveMine(id, name, items) {
  const [clean] = toPayload([{ id, name, days: [], items }])
  await must(supabase.rpc('save_my_routine', { p_id: id, p_name: clean.name, p_items: clean.items }))
}

export default function Routines() {
  const me = useMe()
  const nav = useNavigate()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('mine')
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(null)
  const load = async () => {
    try {
      const [plan, ws] = await Promise.all([loadStudentPlan(),
        must(supabase.from('workouts').select('routine_id, date').eq('student_id', scope.student).gte('date', addDays(todayISO(), -120)))])
      setData({ ...plan, doneIds: new Set(ws.map(w => w.routine_id)), doneToday: new Set(ws.filter(w => w.date === todayISO()).map(w => w.routine_id)) })
    } catch (e) { toast(errorText(e), 'error'); setData({ programs: [], sessions: [], weekdays: [], mine: [], doneIds: new Set(), doneToday: new Set() }) }
  }
  useEffect(() => { load() }, [])
  if (!data) return <Page><Loading /></Page>
  const fromCoach = data.programs.length > 0 || data.weekdays.length > 0 || !!me.student.coach_id

  const blank = async () => {
    const id = newId()
    try { setBusy('blank'); await saveMine(id, 'روتین ' + fa(data.mine.length + 1), []); nav('/routines/' + id) }
    catch (e) { toast(errorText(e), 'error'); setBusy(null) }
  }
  const take = async t => {
    try {
      setBusy(t.key)
      await saveMine(newId(), t.name, t.items)
      toast(`«${t.name}» به روتین‌هایت اضافه شد`, 'success'); setBusy(null); load()
    } catch (e) { toast(errorText(e), 'error'); setBusy(null) }
  }

  return <Page>
    <header className="big-title"><div className="caption">{fa(data.mine.length)} روتین</div><h1>روتین</h1></header>
    {fromCoach && <Segmented label="روتین‌ها" value={tab} onChange={setTab}
      options={[{ value: 'mine', label: 'روتین‌های من' }, { value: 'coach', label: 'از مربی' }]} />}

    {tab === 'coach' ? (data.programs.length || data.weekdays.length
      ? <CoachPlan data={data} onOpen={setOpen} />
      : <div className="card glass-lite"><div className="headline">مربی هنوز برنامه‌ای ننوشته</div>
        <p className="subhead secondary" style={{ marginBottom: 0 }}>برنامه‌ای که مربی بنویسد اینجا می‌آید، جدا از روتین‌های خودت.</p></div>)
      : <>
        <div className="section">
          <div className="section-head">
            <div className="section-title">روتین‌های من</div>
            <button className="btn glass interactive small" onClick={blank} disabled={!!busy}><Icon name="add" />روتین خالی</button>
          </div>
          {!data.mine.length
            ? <div className="card glass-lite" style={{ marginBottom: 0 }}><p className="subhead secondary" style={{ margin: 0 }}>هنوز روتینی نساخته‌ای. یکی از روتین‌های آماده‌ی پایین را بردار، یا یک روتین خالی بساز.</p></div>
            : <div className="routine-grid">{data.mine.map(r => <div key={r.id} className="routine-card">
              <button className="routine-open pressable" onClick={() => nav('/routines/' + r.id)}>
                <div className="tile-icon"><Icon name="fitness_center" /></div>
                <div className="title-text ellipsis">{r.name}</div>
                <div className="sub">{r.items.length ? `${fa(r.items.length)} حرکت · ${fa(minutes(r))} دقیقه` : 'بدون حرکت'}</div>
              </button>
              <button className="play small pressable" onClick={() => nav('/log/' + r.id)} aria-label={`شروع ${r.name}`}><Icon name="play_arrow" filled /></button>
            </div>)}</div>}
          <div className="section-footer">برای ویرایش، روی روتین بزن.</div>
        </div>

        <div className="section">
          <div className="section-title">یک روتین انتخاب کن</div>
          <div className="stack">{TEMPLATES.map(t => <div key={t.key} className="card glass-lite template-card">
            <div className="grow">
              <div className="headline">{t.name}</div>
              <div className="subhead secondary">{t.desc}</div>
              <div className="hstack wrap mt" style={{ gap: '0.5rem' }}>
                <span className="pill">{fa(t.items.length)} حرکت</span><span className="pill">{fa(t.minutes)} دقیقه</span><span className="pill">{LEVEL_NAME[t.level]}</span>
              </div>
            </div>
            <button className="play small pressable" disabled={!!busy} onClick={() => take(t)} aria-label={`افزودن ${t.name} به روتین‌های من`}><Icon name={busy === t.key ? 'hourglass_top' : 'add'} /></button>
          </div>)}</div>
        </div>
      </>}
    {open && <SessionScreen r={open} done={data.doneIds.has(open.id)} onClose={() => setOpen(null)} />}
  </Page>
}
