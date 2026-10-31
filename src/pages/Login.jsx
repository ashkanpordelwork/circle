import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { isPhone, phoneEmail } from '../lib/phone.js'
import { useToast, errorText, Segmented } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import Logo from '../components/Logo.jsx'

// Sign in, or create an account the first time: a mobile number and a password, nothing else
// (SPEC §3.4). The questionnaire follows straight after.
export default function Login() {
  const toast = useToast()
  const nav = useNavigate()
  // «شروع رایگان» on the front door opens this page on «ثبت‌نام».
  const [mode, setMode] = useState(() => (new URLSearchParams(window.location.search).has('signup') ? 'signup' : 'login'))
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  // Validate inline as the person types, not only on submit.
  const phoneBad = phone.length >= 4 && !isPhone(phone)

  const submit = async e => {
    e.preventDefault()
    if (!isPhone(phone)) return toast('شماره موبایل را درست وارد کن، مثلاً 09121234567', 'warning')
    if (password.length < 6) return toast('رمز باید حداقل ۶ کاراکتر باشد.', 'warning')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: phoneEmail(phone), password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email: phoneEmail(phone), password })
        if (error) throw error
        if (!data.session) throw new Error('confirm-email-on')
        await supabase.rpc('start_user')   // if it fails, «Starting» tries again after the reload
        window.location.reload()
      }
    } catch (err) {
      toast(err.message === 'confirm-email-on' ? 'در Supabase گزینه «Confirm email» باید خاموش باشد.' : errorText(err), 'error')
    } finally { setBusy(false) }
  }

  return <main className="auth">
    <button className="icon-btn glass interactive auth-back" onClick={() => nav('/')} aria-label="بازگشت به خانه"><Icon name="chevron_right" /></button>
    <div className="mark app"><Logo size="2.75rem" /></div>
    <h1 className="title-lg latin brand">Circle</h1>
    <p className="lead">{mode === 'signup' ? 'با شماره موبایلت ثبت‌نام کن و برنامه‌ی رایگان یک‌ماهه‌ات را بگیر.' : 'خوش برگشتی.'}</p>
    <Segmented label="ورود یا ثبت‌نام" value={mode} onChange={setMode}
      options={[{ value: 'login', label: 'ورود' }, { value: 'signup', label: 'ثبت‌نام' }]} />
    <form onSubmit={submit} noValidate className="panel glass">
      <div className="field">
        <label htmlFor="ph">شماره موبایل</label>
        <input id="ph" className="input ltr" type="tel" inputMode="tel" autoComplete="username" placeholder="0912 123 4567"
          value={phone} onChange={e => setPhone(e.target.value)} aria-invalid={phoneBad} />
        {phoneBad && <div className="caption" style={{ color: 'var(--red)' }}>شماره ۱۱ رقمی با ۰۹ شروع می‌شود.</div>}
      </div>
      <div className="field">
        <label htmlFor="pw">رمز عبور</label>
        <div className="hstack">
          <input id="pw" className="input ltr grow" type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password} onChange={e => setPassword(e.target.value)} />
          <button type="button" className="icon-btn glass interactive" onClick={() => setShow(!show)} aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'}>
            <Icon name={show ? 'visibility_off' : 'visibility'} /></button>
        </div>
        {mode === 'signup' && <div className="caption">حداقل ۶ کاراکتر. دفعه‌های بعد با همین رمز وارد می‌شوی.</div>}
      </div>
      <button className="btn glass interactive prominent block mt" disabled={busy}>{busy ? 'کمی صبر کن…' : mode === 'login' ? 'ورود' : 'ساخت حساب'}</button>
    </form>
  </main>
}

// Signed in but not yet a user (signing up stopped halfway, or an account from before): become one.
// Before migration 0012 there is no start_user; the older start_athlete asks for a name.
export function Starting({ email, onStarted }) {
  const [failed, setFailed] = useState(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    supabase.rpc('start_user').then(({ error }) => (error ? setFailed(/start_user|function/i.test(error.message) ? 'old' : errorText(error)) : onStarted()))
  }, [])
  const startOld = async e => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.rpc('start_athlete', { p_name: name.trim() })
    setBusy(false)
    if (error) setFailed(errorText(error)); else onStarted()
  }
  if (!failed) return <main className="auth"><p className="lead">کمی صبر کن…</p></main>
  return <main className="auth">
    <div className="mark"><Icon name="person" /></div>
    {failed === 'old' ? <>
      <h1 className="title" style={{ textAlign: 'center' }}>خوش آمدی</h1>
      <form onSubmit={startOld} className="panel glass">
        <div className="field"><label htmlFor="nm">اسمت</label>
          <input id="nm" className="input" value={name} onChange={e => setName(e.target.value)} maxLength={60} autoFocus autoComplete="name" /></div>
        <button className="btn glass interactive prominent block" disabled={busy || !name.trim()}>{busy ? 'کمی صبر کن…' : 'شروع'}</button>
      </form>
    </> : <>
      <h1 className="title" style={{ textAlign: 'center' }}>ساخت حساب کامل نشد</h1>
      <p className="lead">{failed}{email?.endsWith('@phone.invalid') ? '' : ' (این حساب با شماره موبایل ساخته نشده.)'}</p>
    </>}
    <button className="btn plain pressable" onClick={() => supabase.auth.signOut()}><Icon name="logout" mirror />خروج</button>
  </main>
}

export function NotConfigured() {
  return <main className="auth">
    <div className="mark"><Icon name="settings" /></div>
    <h1 className="title" style={{ textAlign: 'center' }}>اتصال به Supabase تنظیم نشده</h1>
    <p className="lead">مقادیر <code>VITE_SUPABASE_URL</code> و <code>VITE_SUPABASE_ANON_KEY</code> را در تنظیمات گیت‌هاب (Variables) وارد کنید و سایت را دوباره بسازید.</p>
  </main>
}

// A coach whose access the admin switched off. Their students and history are kept.
export function Stopped() {
  return <main className="auth">
    <div className="mark"><Icon name="block" /></div>
    <h1 className="title" style={{ textAlign: 'center' }}>دسترسی مربی بسته است</h1>
    <p className="lead">مدیر سیستم دسترسی این حساب را موقتاً بسته است. شاگردها و برنامه‌ها سر جایشان هستند؛ برای باز شدن دوباره با مدیر تماس بگیرید.</p>
    <button className="btn glass interactive block" onClick={() => supabase.auth.signOut()}><Icon name="logout" mirror />خروج از حساب</button>
  </main>
}
