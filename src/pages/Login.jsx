import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { isPhone, phoneEmail, normCode, fmtPhone } from '../lib/phone.js'
import { useToast, errorText } from '../components/ui.jsx'

// Sign in, or create an account the first time. A student types the invite code their coach gave
// them; the coach (whose number the owner lists in coach_phones) leaves it empty.
export default function Login() {
  const toast = useToast()
  const [mode, setMode] = useState('login')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    if (!isPhone(phone)) return toast('شماره موبایل را درست وارد کن، مثلاً 09121234567')
    if (password.length < 6) return toast('رمز باید حداقل ۶ کاراکتر باشد.')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: phoneEmail(phone), password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email: phoneEmail(phone), password })
        if (error) throw error
        if (!data.session) throw new Error('confirm-email-on')
        if (code.trim()) {
          const { error: e2 } = await supabase.rpc('claim_invite', { p_code: normCode(code) })
          if (e2) toast('حساب ساخته شد ولی کد دعوت درست نبود. در صفحه بعد دوباره واردش کن.')
        }
        window.location.reload()   // the session is in; let the app find out who this is
      }
    } catch (err) {
      toast(err.message === 'confirm-email-on'
        ? 'در Supabase گزینه «Confirm email» باید خاموش باشد (راهنمای README).'
        : errorText(err))
    } finally { setBusy(false) }
  }

  return <div className="app"><div className="login">
    <div className="logo">🏋️</div>
    <h1 style={{ margin: 0 }}>مربی من</h1>
    <p className="muted" style={{ margin: 0 }}>برنامه تمرینی‌ات را از مربی بگیر و تمرین‌هایت را ثبت کن.</p>
    <div className="tabs" style={{ width: '100%', maxWidth: 360, marginTop: 16 }}>
      <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>ورود</button>
      <button className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>ثبت‌نام (بار اول)</button>
    </div>
    <form onSubmit={submit} style={{ width: '100%', maxWidth: 360, textAlign: 'start' }}>
      <div className="field"><label htmlFor="ph">شماره موبایل</label>
        <input id="ph" className="input ltr" dir="ltr" type="tel" inputMode="tel" autoComplete="username" placeholder="0912 123 4567" value={phone} onChange={e => setPhone(e.target.value)} /></div>
      <div className="field"><label htmlFor="pw">رمز عبور</label>
        <input id="pw" className="input ltr" dir="ltr" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></div>
      {mode === 'signup' && <div className="field"><label htmlFor="cd">کد دعوت (از مربی‌ات بگیر)</label>
        <input id="cd" className="input ltr" dir="ltr" autoCapitalize="characters" placeholder="ABC234" value={code} onChange={e => setCode(e.target.value)} maxLength={10} /></div>}
      <button className="btn primary block" disabled={busy}>{busy ? 'صبر کن…' : mode === 'login' ? 'ورود' : 'ساخت حساب'}</button>
    </form>
    {mode === 'signup' && <p className="small muted" style={{ maxWidth: 360 }}>یک رمز دلخواه انتخاب کن و به خاطر بسپار. دفعه‌های بعد فقط با شماره و همین رمز وارد می‌شوی.</p>}
    {mode === 'login' && <p className="small muted">رمز را فراموش کرده‌ای؟ به مربی‌ات بگو.</p>}
  </div></div>
}

export function NotRegistered({ email }) {
  const toast = useToast()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const phone = email?.endsWith('@phone.invalid') ? email.split('@')[0] : null
  const claim = async e => {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    const { data, error } = await supabase.rpc('claim_invite', { p_code: normCode(code) })
    setBusy(false)
    if (error) return toast('کد درست نیست، یا برای این شماره نیست.')
    toast(`خوش آمدی ${data}!`)
    window.location.reload()
  }
  return <div className="app"><div className="login">
    <div className="logo">🔑</div>
    <h2 style={{ margin: 0 }}>هنوز به مربی وصل نشده‌ای</h2>
    <p className="muted ltr" style={{ margin: 0 }}>{phone ? fmtPhone(phone) : email}</p>
    {phone && <form onSubmit={claim} style={{ width: '100%', maxWidth: 360 }}>
      <p className="muted">کد دعوتی را که مربی برایت فرستاده وارد کن.</p>
      <input className="input ltr" dir="ltr" placeholder="ABC234" value={code} onChange={e => setCode(e.target.value)} maxLength={10} style={{ textAlign: 'center', letterSpacing: '.2em', fontWeight: 700 }} />
      <button className="btn primary block" style={{ marginTop: 10 }} disabled={busy}>تأیید کد</button>
    </form>}
    <p className="small muted">اگر مربی هستی، صاحب برنامه باید شماره‌ات را در لیست مربی‌ها ثبت کند.</p>
    <button className="btn" onClick={() => supabase.auth.signOut()}>خروج</button>
  </div></div>
}

export function NotConfigured() {
  return <div className="app"><div className="login">
    <div className="logo">⚙️</div>
    <h2 style={{ margin: 0 }}>اتصال به Supabase تنظیم نشده</h2>
    <p className="muted">مقادیر <code>VITE_SUPABASE_URL</code> و <code>VITE_SUPABASE_ANON_KEY</code> را در تنظیمات گیت‌هاب (Variables) یا فایل <code>.env.local</code> وارد کنید.</p>
  </div></div>
}
