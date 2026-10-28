// How a control answers a finger, the iOS way: the moment it is pressed it sinks a little, on a
// critically damped spring from whatever scale it is at right now, and settles back the same way
// on release — no bounce, nothing to wobble. One delegated listener for the whole document, so
// every `.glass.interactive` element gets it without wiring. Reduced motion: no scaling.

import { animateSpring, reducedMotion } from './spring.js'

const PRESS = { damping: 1, response: 0.18 }
const RELEASE = { damping: 1, response: 0.3 }
const SINK = 0.97

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

export function installGlass(root = document) {
  let pressed = null
  const down = e => {
    const el = e.target.closest?.('.glass.interactive')
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return
    pressed = el
    el.classList.add('pressed')
    if (!reducedMotion()) scaleTo(el, SINK, PRESS)
  }
  const up = () => {
    if (!pressed) return
    const el = pressed
    pressed = null
    el.classList.remove('pressed')
    if (!reducedMotion()) scaleTo(el, 1, RELEASE)
  }
  root.addEventListener('pointerdown', down, { passive: true })
  root.addEventListener('pointerup', up, { passive: true })
  root.addEventListener('pointercancel', up, { passive: true })
  return () => {
    root.removeEventListener('pointerdown', down)
    root.removeEventListener('pointerup', up)
    root.removeEventListener('pointercancel', up)
  }
}

// Stretch of a moving droplet: the faster it travels, the longer it gets along its path, up to
// a quarter more. Pure, so it can be tested.
export const stretchFor = (velocity, max = 0.25) => 1 + Math.min(max, Math.abs(velocity) / 4000)
