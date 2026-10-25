import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { isPhone, phoneEmail, normCode, fmtPhone } from '../lib/phone.js'
import { useToast, errorText, Segmented } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import Logo from '../components/Logo.jsx'

// Sign in, or create an account the first time. A student types the invite code their coach gave
// them; the coach (whose number the owner lists in coach_phones) leaves it empty.
export default function Login() {
  const toast = useToast()
  const [mode, setMode] = useState('login')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [code, setCode] = useState('')
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
    <div className="mark app"><Logo size="2.75rem" /></div>
    <h1 className="title-lg latin brand">Circle</h1>
    <p className="lead">برنامه تمرینی‌ات را از مربی بگیر و تمرین‌هایت را ثبت کن.</p>
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
      {mode === 'signup' && <div className="field">
        <label htmlFor="cd">کد دعوت مربی</label>
        <input id="cd" className="input code" autoCapitalize="characters" placeholder="ABC234" value={code} onChange={e => setCode(e.target.value)} maxLength={10} />
        <div className="caption">مربی‌ها این را خالی می‌گذارند.</div>
      </div>}
      <button className="btn glass interactive prominent block mt" disabled={busy}>{busy ? 'کمی صبر کن…' : mode === 'login' ? 'ورود' : 'ساخت حساب'}</button>
    </form>
    {mode === 'login' && <p className="footnote" style={{ textAlign: 'center' }}>رمز را فراموش کرده‌ای؟ به مربی‌ات بگو.</p>}
  </main>
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
    if (error) return toast('کد درست نیست، یا برای این شماره نیست.', 'error')
    toast(`خوش آمدی ${data}!`, 'success')
    setTimeout(() => window.location.reload(), 600)
  }
  return <main className="auth">
    <div className="mark"><Icon name="key" /></div>
    <h1 className="title" style={{ textAlign: 'center' }}>یک قدم مانده</h1>
    <p className="lead">کد دعوتی را که مربی برایت فرستاده وارد کن تا برنامه‌ات باز شود.</p>
    {phone && <form onSubmit={claim} className="panel glass">
      <div className="field">
        <label htmlFor="cl">کد دعوت برای <span className="latin">{fmtPhone(phone)}</span></label>
        <input id="cl" className="input code" placeholder="ABC234" value={code} onChange={e => setCode(e.target.value)} maxLength={10} autoFocus />
      </div>
      <button className="btn glass interactive prominent block" disabled={busy || !code.trim()}>تأیید کد</button>
    </form>}
    <p className="footnote" style={{ textAlign: 'center' }}>اگر مربی هستی، صاحب برنامه باید شماره‌ات را در لیست مربی‌ها ثبت کند.</p>
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
