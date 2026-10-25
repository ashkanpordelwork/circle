import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { animateSpring, SPRING, project, rubberband, velocityOf, reducedMotion } from '../lib/spring.js'
import Icon from './Icon.jsx'

// A bottom sheet that behaves like a physical object:
//   - it rises on a critically damped spring (no bounce: nothing was thrown);
//   - drag it by the grabber, the header, or the content once that is scrolled to the top, and it
//     follows the finger 1:1 from where it was grabbed; above its resting place it rubber-bands;
//   - on release the flick's velocity is projected forward: thrown down it closes, otherwise it
//     springs back with a little life, carrying the finger's speed either way;
//   - it can be grabbed again mid-animation — the new gesture starts from where it is on screen.
// The scrim's dimming follows the sheet's position, so the background comes back as it leaves.
// With reduced motion it cross-fades instead.

const Ctx = createContext({ close: () => {} })
export const useSheet = () => useContext(Ctx)

export default function Sheet({ onClose, title, children, label }) {
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
    panel.current.focus({ preventScroll: true })
    return () => { s.anim?.stop(); document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const k = e => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [close])

  /* ---------- the drag ---------- */

  const onPointerDown = e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (e.target.closest('input, textarea, select, button, a, [data-no-drag]')) return
    const s = st.current
    const fromHandle = !!e.target.closest('[data-drag-handle]')
    s.drag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, fromHandle, active: false, samples: [{ t: e.timeStamp, y: e.clientY }] }
    // The grabber sits on the sheet's top edge: a drag upward leaves the sheet at once, so a
    // gesture that starts there is captured straight away rather than after the hysteresis.
    if (fromHandle) {
      e.preventDefault()   // no text selection, no native drag-and-drop to cancel the gesture
      panel.current.setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = e => {
    const s = st.current, d = s.drag
    if (!d || d.id !== e.pointerId) return
    const dy = e.clientY - d.startY, dx = e.clientX - d.startX
    if (!d.active) {
      if (Math.abs(dy) < 10 && Math.abs(dx) < 10) return              // hysteresis: intent first
      const atTop = (body.current?.scrollTop || 0) <= 0
      if (Math.abs(dx) > Math.abs(dy) || !(d.fromHandle || (atTop && dy > 0))) { s.drag = null; return }
      // Take over from wherever the sheet is right now — even mid-animation.
      const now = s.anim ? s.anim.stop().x : s.y
      s.anim = null
      s.closing = false
      d.active = true
      d.originY = e.clientY
      d.originSheet = now
      if (!panel.current.hasPointerCapture(e.pointerId)) panel.current.setPointerCapture(e.pointerId)
    }
    e.preventDefault()
    let y = d.originSheet + (e.clientY - d.originY)
    if (y < 0) y = rubberband(y, s.h)
    render(y)
    d.samples.push({ t: e.timeStamp, y: e.clientY })
    if (d.samples.length > 8) d.samples.shift()
  }

  // A cancelled pointer (the system took the gesture) carries no usable position: settle back
  // without inventing a velocity from it.
  const onPointerCancel = () => {
    const s = st.current, d = s.drag
    s.drag = null
    if (d?.active) springTo(0, 0, SPRING.default)
  }

  const onPointerUp = e => {
    const s = st.current, d = s.drag
    s.drag = null
    if (!d || !d.active) return
    // The release itself is the last sample: a finger that stopped before lifting has no speed.
    d.samples.push({ t: e.timeStamp, y: e.clientY })
    const v = velocityOf(d.samples)
    // Where would this flick come to rest? Decide by that, not by where the finger let go.
    const landing = s.y + project(v)
    if (landing > s.h * 0.5 || v > 1200) close(v)
    else springTo(0, v, SPRING.sheet)
  }

  return createPortal(<Ctx.Provider value={{ close }}>
    <div ref={scrim} className="scrim" onClick={() => close()} />
    <div ref={panel} className="sheet" role="dialog" aria-modal="true" aria-label={label || title} tabIndex={-1}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      <div className="grabber" data-drag-handle aria-hidden="true" />
      {title !== undefined && <div className="sheet-head" data-drag-handle>
        <h2 className="title">{title}</h2>
        <button className="icon-btn pressable" onClick={() => close()} aria-label="بستن"><Icon name="close" /></button>
      </div>}
      <div ref={body} className="sheet-body">{children}</div>
    </div>
  </Ctx.Provider>, document.body)
}
