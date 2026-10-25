import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { animateSpring, SPRING, reducedMotion } from '../lib/spring.js'
import Icon from './Icon.jsx'

// A bottom sheet for one quick choice: it rises on a critically damped spring and closes only with
// its close button (or Escape). No drag-to-dismiss and no tap outside: a finger scrolling a wheel
// inside it must never take the sheet down with it, and nothing is lost by a stray tap.
// With reduced motion it cross-fades instead.

const Ctx = createContext({ close: () => {}, inSheet: false })
export const useSheet = () => useContext(Ctx)

export default function Sheet({ onClose, title, children, label }) {
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

  const close = useCallback(() => {
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
    springTo(s.h + 40, 0, SPRING.default, finish)
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

  return createPortal(<Ctx.Provider value={{ close, inSheet: true }}>
    <div ref={scrim} className="scrim" />
    <div ref={panel} className="sheet glass" role="dialog" aria-modal="true" aria-label={label || title} tabIndex={-1}>
      {title !== undefined && <div className="sheet-head">
        <h2 className="title">{title}</h2>
        <button className="icon-btn glass interactive" onClick={() => close()} aria-label="بستن"><Icon name="close" /></button>
      </div>}
      <div ref={body} className="sheet-body">{children}</div>
    </div>
  </Ctx.Provider>, document.body)
}
