import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { animateSpring, SPRING, velocityOf, edgeBackCommits, reducedMotion } from '../lib/spring.js'
import Icon from './Icon.jsx'
import Sheet, { useSheet } from './Sheet.jsx'
import GlassDrop from './GlassDrop.jsx'

/* ---------- feedback ---------- */

// Four kinds, as the design notes ask: success (completion), error, warning, info (status).
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
const TOAST_ICON = { success: 'check_circle', error: 'error', warning: 'info', info: 'info' }

// A short tap on the phone, on the same frame as what it confirms. Used sparingly.
export const haptic = (ms = 10) => { try { navigator.vibrate?.(ms) } catch { /* not supported */ } }

export function ToastProvider({ children }) {
  const [t, setT] = useState(null)
  const timer = useRef(0)
  const show = useCallback((text, kind = 'info') => {
    clearTimeout(timer.current)
    setT({ text, kind, key: Date.now() })
    if (kind === 'success') haptic(12)
    if (kind === 'error') haptic([20, 60, 20])
    timer.current = setTimeout(() => setT(null), 2800)
  }, [])
  return <ToastCtx.Provider value={show}>
    {children}
    {t && <div key={t.key} className={'toast glass ' + t.kind} role={t.kind === 'error' ? 'alert' : 'status'}>
      <Icon name={TOAST_ICON[t.kind]} filled />{t.text}
    </div>}
  </ToastCtx.Provider>
}

/* ---------- navigation bar with a large title ---------- */

// The large title sits in the page; once it scrolls under the bar, the bar becomes a material and
// shows the title small. Back, when there is one, sits at the start (the right, in RTL).
// Without a title (the tab pages: the tab bar already names them) there is no heading at all, and
// no bar either unless the page has a button to put in it.
// A page. With a title, it sits in the bar beside the back button, small, like a pushed screen;
// pages reached from the tab bar have no title at all (the tab already names them).
// Swipe back from the screen's edge, as on an iPhone — which gives a web app installed on the home
// screen no back gesture of its own. A thin strip along the edge the back button sits on catches
// the finger; the page follows it 1:1 and, released, either goes back (by where the flick would
// come to rest) or springs home. `move` is the element that travels: the page, or its Screen.
function EdgeBack({ onBack }) {
  const st = useRef(null)
  const down = e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const el = e.currentTarget.closest('.screen') || e.currentTarget.closest('.page')
    e.currentTarget.setPointerCapture(e.pointerId)
    st.current?.anim?.stop()
    st.current = { el, id: e.pointerId, x0: e.clientX, x: 0, w: el.getBoundingClientRect().width || innerWidth, samples: [{ t: e.timeStamp, y: 0 }] }
  }
  const put = (s, x) => { s.x = x; s.el.style.transform = x ? `translate3d(${-x}px, 0, 0)` : ''; s.el.style.boxShadow = x ? '0 0 48px rgba(0, 0, 0, 0.6)' : '' }
  const move = e => {
    const s = st.current
    if (!s || s.id !== e.pointerId || s.anim) return
    // Right-to-left: the edge is on the right and the page leaves toward the left.
    const x = Math.max(0, s.x0 - e.clientX)
    put(s, x)
    s.samples.push({ t: e.timeStamp, y: x })
    if (s.samples.length > 8) s.samples.shift()
  }
  const up = e => {
    const s = st.current
    if (!s || s.id !== e.pointerId || s.anim) return
    s.samples.push({ t: e.timeStamp, y: s.x })
    const v = velocityOf(s.samples)
    const go = edgeBackCommits(s.x, v, s.w)
    if (reducedMotion()) { put(s, 0); if (go) onBack(true); st.current = null; return }
    s.anim = animateSpring({
      from: s.x, to: go ? s.w : 0, velocity: v, params: SPRING.default,
      onUpdate: x => put(s, x),
      onDone: () => { st.current = null; if (go) onBack(true); else put(s, 0) }
    })
  }
  return <div className="edge-back" aria-hidden="true" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
}

// A page. With a title, it sits in the bar beside the back button, small, like a pushed screen;
// pages reached from the tab bar have no title at all (the tab already names them).
// A page with a back button can be swiped away from the screen's edge, and slides in from the
// side when it was pushed (not when it was gone back to). `inScreen`: a Screen moves it instead.
export function Page({ title, subtitle, back, actions, children, noTabbar, fill, inScreen }) {
  const nav = useNavigate()
  const navType = useNavigationType()
  const loc = useLocation()
  const sentinel = useRef(null)
  const [scrolled, setScrolled] = useState(false)
  const [entering] = useState(() => !!back && !inScreen && navType === 'PUSH' && !loc.state?.back)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { rootMargin: '-8px 0px 0px 0px' })
    if (sentinel.current) io.observe(sentinel.current)
    return () => io.disconnect()
  }, [])
  const goBack = swiped => (typeof back === 'function' ? back(swiped) : typeof back === 'string' ? nav(back, { state: { back: true } }) : nav(-1))
  const bar = title || back || actions
  return <div className={'page' + (noTabbar ? ' no-tabbar' : '') + (fill ? ' fill' : '') + (entering ? ' enter' : '')}>
    {back && <EdgeBack onBack={goBack} />}
    {!bar && <div className="top-space" />}
    {bar && <header className={'navbar' + (scrolled ? ' scrolled' : '')}>
      {back && <button className="icon-btn glass interactive" onClick={() => goBack(false)} aria-label="بازگشت">
        <Icon name="chevron_right" /></button>}
      <div className="nav-title">
        {title && <h1 className="nav-h">{title}</h1>}
        {subtitle && <div className="nav-sub">{subtitle}</div>}
      </div>
      {actions && <div className="side end">{actions}</div>}
    </header>}
    <div ref={sentinel} />
    {children}
  </div>
}

/* ---------- segmented control ---------- */

// A glass track with a droplet under the chosen segment; the droplet slides and stretches on a
// spring (GlassDrop) and can be redirected mid-flight.
export function Segmented({ options, value, onChange, label }) {
  const box = useRef(null)
  const i = Math.max(0, options.findIndex(o => o.value === value))
  return <div ref={box} className="seg glass" role="tablist" aria-label={label}>
    <GlassDrop container={box} selector="button" index={i} className="seg-thumb" />
    {options.map(o => <button key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
  </div>
}

/* ---------- confirmation, only for what cannot be undone ---------- */

function ConfirmBody({ text, okText, danger, onOk }) {
  const { close } = useSheet()
  return <>
    {text && <p className="subhead secondary" style={{ marginTop: 0 }}>{text}</p>}
    <div className="stack mt">
      <button className={'btn block glass interactive ' + (danger ? 'danger' : 'prominent')} onClick={() => { onOk(); close() }}>{okText}</button>
      <button className="btn glass interactive block" onClick={() => close()}>انصراف</button>
    </div>
  </>
}
export function Confirm({ title, text, okText = 'تأیید', danger, onOk, onClose }) {
  return <Sheet title={title} onClose={onClose}><ConfirmBody text={text} okText={okText} danger={danger} onOk={onOk} /></Sheet>
}

export const Loading = () => <div className="spinner" role="status" aria-label="در حال بارگذاری"><span /></div>

export function Empty({ icon, title, children }) {
  return <div className="empty"><Icon name={icon} /><div className="headline">{title}</div><div className="subhead">{children}</div></div>
}

// Supabase / Postgres errors in words a coach or student can act on.
export function errorText(e) {
  const m = String(e?.message || e || '')
  if (e?.code === '23505' || /duplicate key/.test(m)) return 'این شماره قبلاً ثبت شده است.'
  if (/Invalid login credentials/i.test(m)) return 'شماره یا رمز عبور اشتباه است.'
  if (/already registered|already exists/i.test(m)) return 'با این شماره قبلاً ثبت‌نام شده؛ از بخش «ورود» وارد شو.'
  if (/Password should be|weak.?password/i.test(m)) return 'رمز ضعیف است؛ حداقل ۶ کاراکتر و ترکیبی از حرف و عدد.'
  if (/rate limit|too many/i.test(m)) return 'تلاش‌ها زیاد شد؛ کمی بعد دوباره امتحان کن.'
  if (/Signups not allowed/i.test(m)) return 'ثبت‌نام در Supabase بسته است (Allow new users to sign up).'
  if (e?.code === '42501' || /row-level security|permission denied/.test(m)) return 'اجازه این کار را ندارید.'
  if (/Failed to fetch|NetworkError|Load failed/.test(m)) return 'اتصال به اینترنت برقرار نیست.'
  return m || 'خطایی رخ داد.'
}
