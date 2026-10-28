import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, must } from '../lib/supabase.js'
import { useMe } from '../App.jsx'
import { phoneOfEmail, fmtPhone } from '../lib/phone.js'
import { fmtDate } from '../lib/plan.js'
import { useToast, errorText } from '../components/ui.jsx'
import Sheet from '../components/Sheet.jsx'
import Icon, { Disclosure } from '../components/Icon.jsx'
import { appUrl } from '../components/InviteCard.jsx'


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
  const nav = useNavigate()
  const toast = useToast()
  const [coach, setCoach] = useState(me.coach)
  const [editing, setEditing] = useState(false)
  const phone = phoneOfEmail(me.session.user.email)

  const shareApp = async () => {
    const text = `اپ Circle: ${appUrl()}`
    if (navigator.share) return navigator.share({ text }).catch(() => {})
    try { await navigator.clipboard.writeText(text); toast('لینک اپ کپی شد', 'success') } catch { toast('کپی در این مرورگر ممکن نیست', 'warning') }
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

    {editing && <NameSheet coach={coach} onClose={() => setEditing(false)} onSaved={c => { setCoach(c); me.setCoach?.(c) }} />}
  </>
}
