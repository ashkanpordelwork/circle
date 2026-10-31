import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { LEVEL_NAME, question, answerText } from '../lib/questionnaire.js'
import { useToast, errorText } from '../components/ui.jsx'
import { useMe } from '../App.jsx'
import { phoneOfEmail, fmtPhone } from '../lib/phone.js'
import { Page } from '../components/ui.jsx'
import Icon, { Disclosure } from '../components/Icon.jsx'
import { Link } from 'react-router-dom'
import CoachAccount from './CoachAccount.jsx'
import { on } from '../lib/features.js'

export default function Account() {
  const me = useMe()
  const name = me.role === 'coach' ? me.coach.full_name : me.role === 'student' ? me.student.full_name : ''
  const phone = phoneOfEmail(me.session.user.email)
  // At sign-up no name is asked: the number stands in until they write one.
  const named = name && name !== phone
  // The athlete reaches this from the icon on «امروز», so it has a way back.
  return <Page fill title={me.role === 'student' ? 'حساب' : undefined} back={me.role === 'student' ? '/' : undefined}>
    {me.role === 'coach' ? <CoachAccount /> : <div className="section"><div className="group glass-lite">
      <div className="row with-leading">
        <div className="tile-icon"><Icon name="person" filled /></div>
        <div className="content">
          {me.role === 'student' ? <NameField name={named ? name : ''} /> : <div className="title-text">{name || 'مدیر سیستم'}</div>}
          <div className="sub latin" style={{ textAlign: 'right' }}>{phone ? fmtPhone(phone) : me.session.user.email}</div>
        </div>
        {me.role === 'admin' && <span className="pill ok">مدیر</span>}
      </div>
    </div></div>}
    {me.admin && me.role !== 'admin' && <div className="section"><div className="group glass-lite">
      <Link to="/admin" className="row pressable with-leading">
        <div className="tile-icon red"><Icon name="admin_panel_settings" /></div>
        <div className="content"><div className="title-text">پنل مدیریت</div><div className="sub">همه حساب‌ها، دسترسی‌ها و فعالیت‌ها</div></div>
        <Disclosure />
      </Link>
    </div></div>}
    {me.role === 'student' && !me.profile?.missing && <ProfileRow profile={me.profile} />}
    {on('intake') && me.role === 'student' && !me.intake?.skipped && <div className="section"><div className="group glass-lite">
      <Link to="/intake" className="row pressable with-leading">
        <div className="tile-icon blue"><Icon name="assignment" /></div>
        <div className="content"><div className="title-text">پرسشنامه من</div><div className="sub">هدف، آسیب‌ها، بیماری‌ها و تغذیه</div></div>
        <Disclosure />
      </Link>
    </div></div>}
    <div className="section page-end"><div className="group glass-lite">
      <button className="row pressable" onClick={() => supabase.auth.signOut()} style={{ color: 'var(--red)', justifyContent: 'center' }}>
        <Icon name="logout" mirror /><span className="title-text">خروج از حساب</span>
      </button>
    </div>
    <div className="section-footer" style={{ textAlign: 'center' }}>کتابخانه‌ی حرکات: exercises-dataset (openGym) و free-exercise-db. تصاویر متعلق به صاحبانشان است.</div></div>
  </Page>
}

// The name, written in place. Saved with rename_me (0008_athletes.sql).
function NameField({ name }) {
  const me = useMe()
  const toast = useToast()
  const [text, setText] = useState(name)
  const [editing, setEditing] = useState(false)
  const save = async e => {
    e.preventDefault()
    if (!text.trim()) return setEditing(false)
    const { error } = await supabase.rpc('rename_me', { p_name: text.trim() })
    if (error) return toast(errorText(error), 'error')
    setEditing(false); me.reload()
  }
  if (!editing) return <button className="title-text name-btn" onClick={() => setEditing(true)} style={{ color: name ? undefined : 'var(--accent)' }}>
    {name || 'افزودن نام'}</button>
  return <form onSubmit={save} className="hstack">
    <input className="input grow" autoFocus maxLength={60} value={text} onChange={e => setText(e.target.value)} aria-label="نام" />
    <button className="btn glass interactive prominent small">ذخیره</button>
  </form>
}

// The questionnaire: a few answers at a glance, and the way to change them.
function ProfileRow({ profile }) {
  const a = profile?.answers || {}
  const done = !!profile?.completed_at
  const sub = done ? [LEVEL_NAME[profile.level], answerText(question('goal'), a), answerText(question('place'), a), answerText(question('days'), a)].filter(Boolean).join(' · ')
    : 'هنوز کامل نشده؛ برنامه‌ی رایگان بعد از آن ساخته می‌شود.'
  return <div className="section"><div className="section-title">پرسشنامه</div><div className="group glass-lite">
    <Link to="/profile/edit" className="row pressable with-leading">
      <div className="tile-icon blue"><Icon name="assignment" /></div>
      <div className="content"><div className="title-text">{done ? 'جواب‌های من' : 'کامل کردن پرسشنامه'}</div><div className="sub">{sub}</div></div>
      <Disclosure />
    </Link>
  </div></div>
}
