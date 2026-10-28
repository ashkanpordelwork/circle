import { useEffect, useRef, useState } from 'react'
import { animateSpring, SPRING, velocityOf, project, rubberband, reducedMotion } from '../lib/spring.js'
import Icon from './Icon.jsx'

// A row that swipes aside to delete, the iOS way, in right-to-left: drag it toward the right and
// a red «حذف» shows on the left. Let go past the button's width to leave it open (tap to delete),
// or swipe all the way — or flick — to delete at once. A vertical drag stays a scroll.
//
// Hidden gestures need teaching, so the first swipeable row the person ever sees nudges itself
// aside once, showing the button underneath, with a one-line tip (SwipeHint). After their first
// real swipe neither appears again. The red button inside an opened row is never the only way:
// every row that swipes also has a delete button in plain sight when opened.

const ACTION = 88           // px: the revealed button's width
const SEEN = 'hint:swipe-delete'
export const swipeHintSeen = () => { try { return !!localStorage.getItem(SEEN) } catch { return true } }
const markSeen = () => {
  try { localStorage.setItem(SEEN, '1') } catch { /* private mode */ }
  dispatchEvent(new Event('swipe-hint-seen'))   // the tip on screen goes away too
}

export default function SwipeRow({ children, onDelete, label = 'حذف', hint = false }) {
  const content = useRef(null)
  const st = useRef({ x: 0, open: false, drag: null, anim: null, moved: false })
  const [gone, setGone] = useState(false)

  const put = x => { st.current.x = x; if (content.current) content.current.style.transform = x ? `translate3d(${x}px, 0, 0)` : '' }
  const springTo = (to, velocity = 0, done) => {
    const s = st.current
    s.anim?.stop()
    if (reducedMotion()) { put(to); done?.(); return }
    s.anim = animateSpring({ from: s.x, to, velocity, params: SPRING.default, onUpdate: put, onDone: () => { s.anim = null; done?.() } })
  }
  const remove = () => {
    markSeen()
    const w = content.current?.getBoundingClientRect().width || 400
    springTo(w, 0, () => setGone(true))
  }
  useEffect(() => { if (gone) { const t = setTimeout(onDelete, 200); return () => clearTimeout(t) } }, [gone])

  // The nudge: once, the first time a swipeable row is ever shown.
  useEffect(() => {
    if (!hint || swipeHintSeen() || reducedMotion()) return
    const t = setTimeout(() => springTo(ACTION * 0.75, 0, () => setTimeout(() => springTo(0), 650)), 700)
    return () => clearTimeout(t)
  }, [hint])

  const down = e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const s = st.current
    s.anim?.stop(); s.anim = null
    s.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, from: s.x, dir: null, samples: [{ t: e.timeStamp, y: s.x }] }
    s.moved = false
  }
  const move = e => {
    const s = st.current, d = s.drag
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0
    if (!d.dir) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return          // intent first
      d.dir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (d.dir === 'y') { s.drag = null; return }                  // a scroll: not ours
      content.current.setPointerCapture(e.pointerId)
    }
    s.moved = true
    let x = d.from + dx
    if (x < 0) x = rubberband(x, ACTION)                            // the wrong way resists
    put(x)
    d.samples.push({ t: e.timeStamp, y: x })
    if (d.samples.length > 8) d.samples.shift()
  }
  const up = e => {
    const s = st.current, d = s.drag
    s.drag = null
    if (!d || !d.dir) return
    d.samples.push({ t: e.timeStamp, y: s.x })
    const v = velocityOf(d.samples), w = content.current.getBoundingClientRect().width
    const rest = s.x + project(v)
    if (s.x > w * 0.6 || (rest > w * 0.75 && v > 900)) return remove()   // all the way: delete
    s.open = rest > ACTION / 2
    springTo(s.open ? ACTION : 0, v)
    if (s.open) markSeen()
  }
  // A drag must not also count as a tap; a tap on an open row closes it.
  const clickCapture = e => {
    const s = st.current
    if (s.moved || s.open) { e.preventDefault(); e.stopPropagation() }
    if (!s.moved && s.open) { s.open = false; springTo(0) }
    s.moved = false
  }

  return <div className={'swipe-row' + (gone ? ' gone' : '')}>
    <button className="swipe-action" onClick={remove} tabIndex={-1} aria-hidden="true"><Icon name="delete" />{label}</button>
    <div ref={content} className="swipe-content" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClickCapture={clickCapture}>
      {children}
    </div>
  </div>
}

// The one-line tip under the first swipeable list, until the first real swipe.
export function SwipeHint({ text = 'برای حذف، ردیف را به سمت راست بکشید.' }) {
  const [show, setShow] = useState(() => !swipeHintSeen())
  useEffect(() => { const off = () => setShow(false); addEventListener('swipe-hint-seen', off); return () => removeEventListener('swipe-hint-seen', off) }, [])
  if (!show) return null
  return <div className="swipe-hint" role="note">
    <Icon name="swipe_right" /><span className="grow">{text}</span>
    <button className="btn plain small pressable" onClick={() => { markSeen(); setShow(false) }}>متوجه شدم</button>
  </div>
}
