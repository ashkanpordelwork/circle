// How Liquid Glass reacts to touch (the `.interactive()` of the iOS 26 material), on the web:
//   - on press, the glass swells a little on a spring, from whatever scale it is at right now;
//   - on release it settles back, slightly under-damped, so it wobbles like something liquid;
//   - its sheen moves to where the finger is (--gx / --gy, used by .glass::before in the CSS).
// One delegated listener for the whole document, so every `.glass.interactive` element gets the
// behaviour without wiring. Reduced motion: no swell, the sheen still answers.

import { animateSpring, reducedMotion } from './spring.js'

const PRESS = { damping: 0.7, response: 0.28 }    // a quick swell
const RELEASE = { damping: 0.5, response: 0.42 }  // settles with a wobble: it was squeezed
const SWELL = 1.05

const live = new WeakMap()   // element -> { anim, scale }

function scaleTo(el, to, params) {
  const st = live.get(el) || { scale: 1, anim: null }
  st.anim?.stop()
  st.anim = animateSpring({
    from: st.scale, to, params,
    onUpdate: v => { st.scale = v; el.style.scale = String(v) },
    onDone: () => { st.anim = null; if (to === 1) el.style.scale = '' }
  })
  live.set(el, st)
}

function sheenAt(el, e) {
  const r = el.getBoundingClientRect()
  el.style.setProperty('--gx', `${e.clientX - r.left}px`)
  el.style.setProperty('--gy', `${e.clientY - r.top}px`)
}

export function installGlass(root = document) {
  let pressed = null
  const down = e => {
    const el = e.target.closest?.('.glass.interactive')
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return
    pressed = el
    el.classList.add('pressed')
    sheenAt(el, e)
    if (!reducedMotion()) scaleTo(el, SWELL, PRESS)
  }
  const move = e => {
    if (pressed) sheenAt(pressed, e)
    else if (e.pointerType === 'mouse') {   // a pointer hovering moves the light too
      const el = e.target.closest?.('.glass.interactive')
      if (el) sheenAt(el, e)
    }
  }
  const up = () => {
    if (!pressed) return
    const el = pressed
    pressed = null
    el.classList.remove('pressed')
    if (!reducedMotion()) scaleTo(el, 1, RELEASE)
  }
  root.addEventListener('pointerdown', down, { passive: true })
  root.addEventListener('pointermove', move, { passive: true })
  root.addEventListener('pointerup', up, { passive: true })
  root.addEventListener('pointercancel', up, { passive: true })
  return () => {
    root.removeEventListener('pointerdown', down)
    root.removeEventListener('pointermove', move)
    root.removeEventListener('pointerup', up)
    root.removeEventListener('pointercancel', up)
  }
}

// Stretch of a moving droplet: the faster it travels, the longer it gets along its path, up to
// a quarter more. Pure, so it can be tested.
export const stretchFor = (velocity, max = 0.25) => 1 + Math.min(max, Math.abs(velocity) / 4000)
