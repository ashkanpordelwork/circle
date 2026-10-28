// Springs the way Apple describes them (WWDC 2018, "Designing Fluid Interfaces"): two parameters a
// designer can reason about instead of mass/stiffness/damping.
//   damping  — ratio. 1 = critically damped (settles with no overshoot); below 1 overshoots.
//   response — seconds; how quickly the value gets to the target. Not a duration: a spring has none.
// Every animation starts from the value on screen now and can take an initial velocity, so a
// gesture can grab it, reverse it, or hand it its own speed at release.

export const SPRING = {
  default: { damping: 1, response: 0.35 },   // most UI: calm, no overshoot
  sheet: { damping: 0.8, response: 0.3 },    // after a flick: a little life
  move: { damping: 1, response: 0.4 }
}

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const coefficients = ({ damping, response }) => ({
  k: (2 * Math.PI / response) ** 2,       // stiffness, for mass 1
  c: (4 * Math.PI * damping) / response   // damping coefficient
})

// One step of the spring, pure so it can be tested: semi-implicit Euler in small substeps.
export function step(state, target, params, dt) {
  const { k, c } = coefficients(params)
  let { x, v } = state
  const n = Math.max(1, Math.ceil(dt / 0.004))
  const h = dt / n
  for (let i = 0; i < n; i++) {
    v += (-k * (x - target) - c * v) * h
    x += v * h
  }
  return { x, v }
}

export const settled = ({ x, v }, target) => Math.abs(x - target) < 0.3 && Math.abs(v) < 2

// Runs a spring on requestAnimationFrame. Returns a handle whose stop() gives back where the value
// is and how fast it is moving, so the next animation (or a finger) can carry on from there.
export function animateSpring({ from, to, velocity = 0, params = SPRING.default, onUpdate, onDone }) {
  let s = { x: from, v: velocity }
  let last = null, raf = 0, stopped = false
  const frame = now => {
    if (stopped) return
    const dt = last == null ? 1 / 60 : Math.min(0.05, (now - last) / 1000)
    last = now
    s = step(s, to, params, dt)
    if (settled(s, to)) { s = { x: to, v: 0 }; onUpdate(to); onDone?.(); return }
    onUpdate(s.x)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return {
    stop() { stopped = true; cancelAnimationFrame(raf); return { ...s } },
    get value() { return s.x }
  }
}

// Where a flick would come to rest, the way scrolling decelerates. Apple's projection, with
// velocity in px/s; 0.998 matches normal scroll deceleration.
export const project = (velocity, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate)

// Resistance past an edge: the further out, the less it follows. Never a hard stop.
export const rubberband = (overshoot, dimension, constant = 0.55) =>
  (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))

// Velocity in px/s from the last ~100 ms of pointer samples [{ t, y }].
export function velocityOf(samples) {
  if (samples.length < 2) return 0
  const end = samples[samples.length - 1]
  let start = samples[0]
  for (const s of samples) if (end.t - s.t <= 100) { start = s; break }
  const dt = (end.t - start.t) / 1000
  return dt > 0 ? (end.y - start.y) / dt : 0
}

// Swiping back from the screen's edge: does a release at travel `x` (px, toward closing) with
// velocity `v` (px/s, positive toward closing) go back, or spring home? By where the flick would
// come to rest, as iOS does: past half the width, or simply a decided flick.
export const edgeBackCommits = (x, v, width) => x > 24 && (x + project(v) > width / 2 || v > 600)
