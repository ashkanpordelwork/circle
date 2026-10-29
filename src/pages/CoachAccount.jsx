import { useEffect, useState } from 'react'
import { supabase, must } from '../lib/supabase.js'
import { useMe } from '../App.jsx'
import { phoneOfEmail, fmtPhone } from '../lib/phone.js'
import { fmtDate } from '../lib/plan.js'
import { useToast, errorText } from '../components/ui.jsx'
import Sheet from '../components/Sheet.jsx'
import Icon, { Disclosure } from '../components/Icon.jsx'
import { appUrl } from '../components/InviteCard.jsx'
import { PLAN_NAME, capacityOf, planNow } from '../lib/coaching.js'
import { todayISO } from '../lib/plan.js'
import { fmtJ } from '../lib/jalali.js'


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
      <button className="btn glass interactive prominent block" disabled={busy}>{busy ? 'کمی صبر کنید…' : 'ذخیره'}</button>
    </form>
  </Sheet>
}

// The coach's own page: who they are, and the tools around it. (Their numbers live on the dashboard.)
export default function CoachAccount() {
  const me = useMe()
  const toast = useToast()
  const [coach, setCoach] = useState(me.coach)
  const [editing, setEditing] = useState(false)
  const [active, setActive] = useState(null)
  useEffect(() => {
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('coach_id', me.session.user.id).eq('active', true).then(r => setActive(r.count ?? 0))
  }, [])
  const phone = phoneOfEmail(me.session.user.email)

  const shareApp = async () => {
    const text = `اپ Circle: ${appUrl()}`
    if (navigator.share) return navigator.share({ text }).catch(() => {})
    try { await navigator.clipboard.writeText(text); toast('لینک اپ کپی شد', 'success') } catch { toast('کپی در این مرورگر ممکن نیست', 'warning') }
  }

  const shareCode = async () => {
    const text = `کد مربی من در اپ Circle: ${coach.join_code}\n${appUrl()}`
    if (navigator.share) return navigator.share({ text }).catch(() => {})
    try { await navigator.clipboard.writeText(text); toast('کد مربی کپی شد', 'success') } catch { toast('کپی در این مرورگر ممکن نیست', 'warning') }
  }
  const name = coach.full_name?.trim()
  return <>
    <section className="card glass-lite coach-card">
      <div className="avatar" aria-hidden="true">{name ? [...name][0] : <Icon name="person" filled />}</div>
      <div className="grow">
        {name ? <div className="headline ellipsis">{name}</div>
          : <button className="name-add pressable" onClick={() => setEditing(true)}>افزودن نام</button>}
        <div className="sub latin nowrap" style={{ textAlign: 'right' }}>{phone ? fmtPhone(phone) : me.session.user.email}</div>
        {coach.created_at && <div className="caption">عضو از {fmtDate(coach.created_at.slice(0, 10), { month: 'long' })} {fmtDate(coach.created_at.slice(0, 10), { year: 'numeric' })}</div>}
      </div>
      {/* A small edit icon, so the name and number keep the card's width. */}
      <button className="icon-btn glass interactive" onClick={() => setEditing(true)} aria-label={name ? 'ویرایش نام' : 'افزودن نام'}><Icon name="edit_note" /></button>
    </section>
    {!name && <div className="section-footer" style={{ marginTop: '-0.75rem', marginBottom: '2.5rem' }}>نامتان را وارد کنید تا در پیام دعوت شاگردها بیاید.</div>}

    {/* The plan (0010_coaching.sql): how many active students fit; an admin grants a bigger one. */}
    {coach.plan && <div className="section">
      <div className="section-title">پلن</div>
      <div className="card glass-lite" style={{ marginBottom: 0 }}>
        <div className="hstack between">
          <div><div className="headline">{PLAN_NAME[planNow(coach, todayISO())]}</div>
            <div className="footnote">{coach.plan_until && coach.plan_until >= todayISO() ? `تا ${fmtJ(coach.plan_until)}` : 'بدون تاریخ پایان'}</div></div>
          <div className="tnum title-lg">{active == null ? '…' : Number(active).toLocaleString('fa-IR')}<span className="subhead secondary"> از {capacityOf(coach, todayISO()) ? capacityOf(coach, todayISO()).toLocaleString('fa-IR') : 'نامحدود'}</span></div>
        </div>
        {capacityOf(coach, todayISO()) && active != null && <div className="cap-bar"><span style={{ width: `${Math.min(100, (active / capacityOf(coach, todayISO())) * 100)}%` }} /></div>}
        <div className="footnote mt">شاگرد فعال. برای پلن بزرگ‌تر با مدیر تماس بگیرید.</div>
      </div>
    </div>}

    {coach.join_code && <div className="section">
      <div className="section-title">کد مربی</div>
      <div className="card glass-lite join-code" style={{ marginBottom: 0 }}>
        <div className="grow"><div className="latin tnum code-big">{coach.join_code}</div>
          <div className="footnote">کسی که خودش در اپ حساب دارد، با این کد از «بیشتر ← مربی» به شاگردهایت می‌پیوندد.</div></div>
        <button className="icon-btn glass interactive" onClick={shareCode} aria-label="فرستادن کد مربی"><Icon name="share" /></button>
      </div>
    </div>}

    <div className="section">
      <div className="group glass-lite">
        <button className="row pressable with-leading" onClick={shareApp}>
          <div className="tile-icon blue"><Icon name="share" /></div>
          <div className="content"><div className="title-text">ارسال لینک اپ</div><div className="sub latin" style={{ textAlign: 'right' }}>{appUrl().replace(/^https?:\/\//, '')}</div></div><Disclosure /></button>
      </div>
    </div>

    {editing && <NameSheet coach={coach} onClose={() => setEditing(false)} onSaved={c => { setCoach(c); me.setCoach?.(c) }} />}
  </>
}
