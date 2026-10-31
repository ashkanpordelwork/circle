import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { isPhone, phoneEmail, normCode, fmtPhone } from '../lib/phone.js'
import { useToast, errorText, Segmented } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import Logo from '../components/Logo.jsx'

// Sign in, or create an account the first time. Most people sign up with nothing but a number and
// a password; someone who was given an invite code opens the small «کد دعوت دارم» link for it.
export default function Login() {
  const toast = useToast()
  const nav = useNavigate()
  // «شروع رایگان» on the front door opens this page on «ثبت‌نام».
  const [mode, setMode] = useState(() => (new URLSearchParams(window.location.search).has('signup') ? 'signup' : 'login'))
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [code, setCode] = useState('')
  const [hasCode, setHasCode] = useState(false)
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
        if (code.trim()) {
          const { error: e2 } = await supabase.rpc('claim_invite', { p_code: normCode(code) })
          if (e2) toast('حساب ساخته شد ولی کد دعوت درست نبود. در صفحه بعد دوباره واردش کن.', 'warning')
        }
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
    <p className="lead">برنامه‌ات را بیاور، هر روز اجرایش کن، پیشرفتت را ببین.</p>
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
      {mode === 'signup' && (hasCode ? <div className="field">
        <label htmlFor="cd">کد دعوت</label>
        <input id="cd" className="input code" autoCapitalize="characters" placeholder="ABC234" value={code} onChange={e => setCode(e.target.value)} maxLength={10} autoFocus />
      </div> : <button type="button" className="link-btn pressable" onClick={() => setHasCode(true)}>کد دعوت دارم</button>)}
      <button className="btn glass interactive prominent block mt" disabled={busy}>{busy ? 'کمی صبر کن…' : mode === 'login' ? 'ورود' : 'ساخت حساب'}</button>
    </form>
  </main>
}

// A new account with no role. Most people start training on their own right away; someone a
// coach has registered enters the invite code instead (a number already registered can only do
// that — start_athlete answers «invited»).
export function NotRegistered({ email }) {
  const toast = useToast()
  const [mode, setMode] = useState('start')   // 'start' | 'code'
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const phone = email?.endsWith('@phone.invalid') ? email.split('@')[0] : null
  const start = async e => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const { error } = await supabase.rpc('start_athlete', { p_name: name.trim() })
    setBusy(false)
    if (!error) { toast(`خوش آمدی ${name.trim()}!`, 'success'); return setTimeout(() => window.location.reload(), 500) }
    if (/invited/.test(error.message)) { setMode('code'); return toast('مربی‌ات این شماره را ثبت کرده؛ کد دعوتش را وارد کن.', 'info') }
    // Before migration 0008 nobody can start alone: only the invite is left.
    if (/start_athlete|function/i.test(error.message)) { setMode('code'); return toast('فعلاً فقط با کد دعوت مربی می‌شود وارد شد.', 'warning') }
    toast(errorText(error), 'error')
  }
  const claim = async e => {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    const { data, error } = await supabase.rpc('claim_invite', { p_code: normCode(code) })
    setBusy(false)
    if (error) return toast('کد درست نیست، یا برای این شماره نیست.', 'error')
    toast(`خوش آمدی ${data}!`, 'success')
    setTimeout(() => window.location.reload(), 600)
  }
  return <main className="auth">
    <div className="mark"><Icon name={mode === 'start' ? 'fitness_center' : 'key'} /></div>
    {mode === 'start' ? <>
      <h1 className="title" style={{ textAlign: 'center' }}>خوش آمدی</h1>
      <p className="lead">اسمت را بنویس و همین حالا تمرین را شروع کن. هر ستی که ثبت کنی، ست بعدی را مشخص می‌کند.</p>
      <form onSubmit={start} className="panel glass">
        <div className="field"><label htmlFor="nm">اسمت</label>
          <input id="nm" className="input" value={name} onChange={e => setName(e.target.value)} maxLength={60} autoFocus autoComplete="name" /></div>
        <button className="btn glass interactive prominent block" disabled={busy || !name.trim()}>{busy ? 'کمی صبر کن…' : 'شروع'}</button>
      </form>
      <button className="link-btn pressable" onClick={() => setMode('code')}>کد دعوت دارم</button>
    </> : <>
      <h1 className="title" style={{ textAlign: 'center' }}>کد دعوت</h1>
      <p className="lead">کد دعوتی را که گرفته‌ای وارد کن.</p>
      {phone && <form onSubmit={claim} className="panel glass">
        <div className="field">
          <label htmlFor="cl">کد دعوت برای <span className="latin">{fmtPhone(phone)}</span></label>
          <input id="cl" className="input code" placeholder="ABC234" value={code} onChange={e => setCode(e.target.value)} maxLength={10} autoFocus />
        </div>
        <button className="btn glass interactive prominent block" disabled={busy || !code.trim()}>تأیید کد</button>
      </form>}
      <button className="btn plain pressable" onClick={() => setMode('start')}><Icon name="chevron_right" />بدون کد شروع می‌کنم</button>
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
