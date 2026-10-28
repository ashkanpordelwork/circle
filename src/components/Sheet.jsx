import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { animateSpring, SPRING, project, rubberband, velocityOf, reducedMotion } from '../lib/spring.js'
import Icon from './Icon.jsx'

// A bottom sheet for one quick choice, the iOS way: it rises on a critically damped spring, and a
// pull down on its top bar (the grabber and title) follows the finger 1:1 — released, the flick's
// velocity is projected forward, so a short fast flick closes it and a slow drag springs back.
// A tap on the dimmed page behind closes it too.
// `dismissible={false}` (the number wheels): only the close button closes it — a finger turning
// a wheel must never take the sheet down with it. No grabber is shown then.
// With reduced motion it cross-fades instead.

const Ctx = createContext({ close: () => {}, inSheet: false })
export const useSheet = () => useContext(Ctx)

export default function Sheet({ onClose, title, children, label, dismissible = true }) {
  // One sheet at a time: anything that needs a second layer belongs on a page (Screen.jsx).
  const parent = useContext(Ctx)
  if (import.meta.env.DEV && parent.inSheet) console.error(`Sheet «${title}» opened inside another sheet; use a Screen for the outer one.`)
  const panel = useRef(null), scrim = useRef(null), body = useRef(null)
  const st = useRef({ y: 0, h: 0, anim: null, closing: false, drag: null })
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null)

  const render = useCallback(y => {
    const s = st.current
    s.y = y
    const p = panel.current, sc = scrim.current
    if (!p || !sc) return
    p.style.transform = `translate3d(0, ${y}px, 0)`
    sc.style.opacity = String(Math.max(0, Math.min(1, 1 - y / Math.max(1, s.h))))
  }, [])

  const springTo = useCallback((to, velocity = 0, params = SPRING.default, done) => {
    const s = st.current
    s.anim?.stop()
    s.anim = animateSpring({ from: s.y, to, velocity, params, onUpdate: render, onDone: () => { s.anim = null; done?.() } })
  }, [render])

  const close = useCallback((velocity = 0) => {
    const s = st.current
    if (s.closing) return
    s.closing = true
    const finish = () => { onClose(); opener.current?.focus?.() }
    if (reducedMotion()) {
      panel.current.style.transition = scrim.current.style.transition = 'opacity 180ms ease'
      panel.current.style.opacity = scrim.current.style.opacity = '0'
      setTimeout(finish, 180)
      return
    }
    springTo(s.h + 40, velocity, velocity > 0 ? SPRING.sheet : SPRING.default, finish)
  }, [onClose, springTo])

  // Rise from below on the first frame, from exactly off-screen.
  useLayoutEffect(() => {
    const s = st.current
    s.h = panel.current.getBoundingClientRect().height
    if (reducedMotion()) {
      render(0)
      panel.current.style.opacity = '0'
      requestAnimationFrame(() => {
        panel.current.style.transition = 'opacity 180ms ease'
        panel.current.style.opacity = '1'
        scrim.current.style.opacity = '1'
      })
    } else {
      render(s.h)
      springTo(0)
    }
    document.body.style.overflow = 'hidden'
    document.documentElement.classList.add('has-sheet')
    panel.current.focus({ preventScroll: true })
    return () => { s.anim?.stop(); document.body.style.overflow = ''; document.documentElement.classList.remove('has-sheet') }
  }, [])

  useEffect(() => {
    const k = e => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [close])

  /* ---------- pulling it down by its top bar ---------- */

  const onPointerDown = e => {
    if (!dismissible || (e.button !== 0 && e.pointerType === 'mouse')) return
    if (!e.target.closest('[data-drag-handle]') || e.target.closest('button, a, input')) return
    e.preventDefault()   // no text selection, no native drag to cancel the gesture
    panel.current.setPointerCapture(e.pointerId)
    const s = st.current
    // Take over from wherever the sheet is right now, even mid-animation.
    const now = s.anim ? s.anim.stop().x : s.y
    s.anim = null
    s.closing = false
    s.drag = { id: e.pointerId, originY: e.clientY, originSheet: now, samples: [{ t: e.timeStamp, y: e.clientY }] }
  }
  const onPointerMove = e => {
    const s = st.current, d = s.drag
    if (!d || d.id !== e.pointerId) return
    let y = d.originSheet + (e.clientY - d.originY)
    if (y < 0) y = rubberband(y, s.h)   // above its resting place it resists
    render(y)
    d.samples.push({ t: e.timeStamp, y: e.clientY })
    if (d.samples.length > 8) d.samples.shift()
  }
  const onPointerUp = e => {
    const s = st.current, d = s.drag
    s.drag = null
    if (!d) return
    d.samples.push({ t: e.timeStamp, y: e.clientY })
    const v = velocityOf(d.samples)
    // Decide by where the flick would come to rest, not by where the finger let go.
    if (s.y + project(v) > s.h * 0.5 || v > 1200) close(v)
    else springTo(0, v, SPRING.sheet)
  }
  // The system took the gesture: settle back, without inventing a velocity.
  const onPointerCancel = () => { const s = st.current; if (s.drag) { s.drag = null; springTo(0, 0, SPRING.default) } }

  return createPortal(<Ctx.Provider value={{ close, inSheet: true }}>
    <div ref={scrim} className="scrim" onClick={dismissible ? () => close() : undefined} />
    <div ref={panel} className={'sheet glass' + (dismissible ? ' dismissible' : '')} role="dialog" aria-modal="true" aria-label={label || title} tabIndex={-1}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      {dismissible && <div className="grabber" data-drag-handle aria-hidden="true" />}
      {title !== undefined && <div className="sheet-head" data-drag-handle>
        <h2 className="title">{title}</h2>
        <button className="icon-btn glass interactive" onClick={() => close()} aria-label="بستن"><Icon name="close" /></button>
      </div>}
      <div ref={body} className="sheet-body">{children}</div>
    </div>
  </Ctx.Provider>, document.body)
}
