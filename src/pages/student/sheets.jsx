import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { newId, todayISO } from '../../lib/plan.js'
import { fmtJ } from '../../lib/jalali.js'
import { useToast, errorText } from '../../components/ui.jsx'
import Sheet, { useSheet } from '../../components/Sheet.jsx'
import Icon from '../../components/Icon.jsx'
import { useMe } from '../../App.jsx'
import { loadStudentPlan } from './data.js'
import { saveMine } from './Routines.jsx'
import { minutes } from './plan-parts.jsx'

const fa = n => Number(n).toLocaleString('fa-IR')

// The lime button in the middle of the tab bar: start now. An instant workout (name it, start,
// add exercises as you go — it becomes one of your routines), or one of the routines you have.
export function StartSheet({ onClose }) {
  return <Sheet title="شروع تمرین" onClose={onClose}><StartBody /></Sheet>
}
function StartBody() {
  const { close } = useSheet()
  const nav = useNavigate()
  const toast = useToast()
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [list, setList] = useState(null)
  useEffect(() => { loadStudentPlan().then(p => setList(p.mine)).catch(() => setList([])) }, [])
  const go = path => { close(); setTimeout(() => nav(path), 260) }
  const instant = async e => {
    e.preventDefault()
    setBusy(true)
    const id = newId()
    try { await saveMine(id, name.trim() || `تمرین ${fmtJ(todayISO(), false)}`, []); go('/log/' + id) }
    catch (err) { toast(errorText(err), 'error'); setBusy(false) }
  }
  return <>
    <div className="instant-card">
      <div className="hstack"><div className="tile-icon lime"><Icon name="bolt" filled /></div>
        <div><div className="headline">تمرین فوری</div><div className="footnote">بدون ساختن برنامه؛ حرکت‌ها را حین تمرین اضافه کن.</div></div></div>
      {naming ? <form onSubmit={instant} className="mt">
        <input className="input" autoFocus placeholder={`تمرین ${fmtJ(todayISO(), false)}`} value={name} onChange={e => setName(e.target.value)} maxLength={80} aria-label="نام تمرین" />
        <button className="btn glass interactive prominent block mt" disabled={busy}><Icon name="play_arrow" filled />{busy ? 'کمی صبر کن…' : 'بساز و شروع کن'}</button>
      </form> : <button className="btn glass interactive prominent block mt" onClick={() => setNaming(true)}><Icon name="bolt" />شروع کن</button>}
    </div>
    {list && list.length > 0 && <>
      <div className="section-title" style={{ marginTop: '1.5rem' }}>روتین‌های من</div>
      <div className="group glass-lite">{list.map(r => <div key={r.id} className="row with-leading">
        <div className="tile-icon"><Icon name="fitness_center" /></div>
        <div className="content"><div className="title-text">{r.name}</div><div className="sub">{r.items.length ? `${fa(r.items.length)} حرکت · ${fa(minutes(r))} دقیقه` : 'بدون حرکت'}</div></div>
        <button className="btn glass interactive prominent small" onClick={() => go('/log/' + r.id)}>شروع</button>
      </div>)}</div>
    </>}
  </>
}

// «بیشتر»: everything that is not a tab.
export function MoreSheet({ onClose }) {
  return <Sheet title="بیشتر" onClose={onClose}><MoreBody /></Sheet>
}
function MoreBody() {
  const { close } = useSheet()
  const nav = useNavigate()
  const me = useMe()
  const go = path => { close(); setTimeout(() => nav(path), 260) }
  const tiles = [
    ['/coach', 'sports', 'مربی', me.student?.coach_id ? 'مربی‌ات و آنچه می‌بیند' : 'پیوستن به مربی'],
    me.student?.coach_id && !me.intake?.skipped && ['/intake', 'assignment', 'پرسشنامه', 'هدف، آسیب‌ها، تغذیه'],
    ['/stats', 'monitoring', 'پیشرفت', 'وزن و تمرین‌ها'],
    ['/account', 'person', 'حساب', 'نام، شماره، خروج'],
    me.admin && ['/admin', 'admin_panel_settings', 'مدیریت', 'پنل مدیر']
  ].filter(Boolean)
  return <div className="more-grid">{tiles.map(([to, icon, title, sub]) =>
    <button key={to} className="more-tile pressable" onClick={() => go(to)}>
      <div className="tile-icon lime"><Icon name={icon} /></div>
      <div className="title-text">{title}</div><div className="sub">{sub}</div>
    </button>)}</div>
}
