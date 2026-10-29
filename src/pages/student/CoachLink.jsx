import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { normCode } from '../../lib/phone.js'
import { Page, Confirm, useToast, errorText } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { useMe } from '../../App.jsx'

// «مربی»: join a coach with their code, see what they see, leave whenever you like.
// What a coach sees is said before joining, not after: consent is the point.

const SEES = [
  ['visibility', 'برنامه‌ها و روتین‌هایت، و تمرین‌هایی که ثبت می‌کنی: تاریخ، ست، وزنه، تکرار و یادداشت تمرین'],
  ['monitor_weight', 'وزن بدنت، و پرسشنامه اگر پرش کنی'],
  ['edit_note', 'مربی برایت برنامه می‌نویسد؛ روتین‌های خودت را نمی‌تواند تغییر دهد'],
  ['logout', 'هر وقت بخواهی جدا می‌شوی و دسترسی مربی همان لحظه قطع می‌شود']
]

export default function CoachLink() {
  const me = useMe()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [coachName, setCoachName] = useState(null)
  const has = !!me.student.coach_id
  useEffect(() => {
    if (has) supabase.rpc('my_coach_name').then(({ data }) => setCoachName(data || ''))
  }, [has])
  const join = async e => {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.rpc('join_coach', { p_code: normCode(code) })
    setBusy(false)
    if (error) return toast(/wrong code/.test(error.message) ? 'این کد مربی درست نیست.' : /already/.test(error.message) ? 'الان مربی داری؛ اول از او جدا شو.' : errorText(error), 'error')
    toast(`به ${data?.trim() || 'مربی'} پیوستی`, 'success')
    me.reload()
  }
  return <Page title="مربی" back>
    {has ? <>
      <section className="card glass-lite coach-card">
        <div className="avatar" aria-hidden="true">{coachName ? [...coachName][0] : <Icon name="sports" />}</div>
        <div className="grow"><div className="caption">مربی تو</div><div className="headline">{coachName || 'مربی'}</div></div>
      </section>
      <div className="section">
        <div className="section-title">مربی چه می‌بیند</div>
        <div className="group glass-lite">{SEES.map(([icon, text]) => <div key={icon} className="row with-leading">
          <div className="tile-icon"><Icon name={icon} /></div><div className="content"><div className="subhead">{text}</div></div></div>)}</div>
      </div>
      <button className="btn glass interactive danger block" onClick={() => setLeaving(true)}><Icon name="logout" mirror />جدا شدن از مربی</button>
    </> : <>
      <p className="lead" style={{ textAlign: 'start' }}>اگر مربی داری، کد مربی را از او بگیر و اینجا وارد کن. برنامه‌هایی که بنویسد در «روتین ← از مربی» می‌آید، جدا از روتین‌های خودت.</p>
      <div className="section">
        <div className="section-title">مربی چه می‌بیند</div>
        <div className="group glass-lite">{SEES.map(([icon, text]) => <div key={icon} className="row with-leading">
          <div className="tile-icon"><Icon name={icon} /></div><div className="content"><div className="subhead">{text}</div></div></div>)}</div>
      </div>
      <form onSubmit={join} className="card glass-lite">
        <div className="field"><label htmlFor="cc">کد مربی</label>
          <input id="cc" className="input code" placeholder="ABC234" value={code} onChange={e => setCode(e.target.value)} maxLength={10} /></div>
        <label className="consent"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
          <span>می‌دانم مربی موارد بالا را می‌بیند و موافقم.</span></label>
        <button className="btn glass interactive prominent block mt" disabled={busy || !agree || !code.trim()}>{busy ? 'کمی صبر کن…' : 'پیوستن به مربی'}</button>
      </form>
    </>}
    {leaving && <Confirm title="از مربی جدا می‌شوی؟" danger okText="جدا شو" onClose={() => setLeaving(false)}
      text="دسترسی مربی همین حالا قطع می‌شود. برنامه‌هایی که نوشته برای خواندن پیش تو می‌ماند؛ سابقه‌ات دست نمی‌خورد."
      onOk={async () => {
        const { error } = await supabase.rpc('leave_coach')
        if (error) return toast(errorText(error), 'error')
        toast('از مربی جدا شدی', 'success'); me.reload()
      }} />}
  </Page>
}
