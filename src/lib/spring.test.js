import { describe, expect, it } from 'vitest'
import { step, settled, project, rubberband, velocityOf, SPRING } from './spring.js'
import { stretchFor } from './glass.js'

const run = (params, from, to, v = 0) => {
  let s = { x: from, v }, max = -Infinity, t = 0
  while (!settled(s, to) && t < 5) { s = step(s, to, params, 1 / 60); max = Math.max(max, s.x); t += 1 / 60 }
  return { s, max, t }
}

describe('spring', () => {
  it('critically damped: reaches the target without overshoot', () => {
    const r = run(SPRING.default, 0, 100)
    expect(settled(r.s, 100)).toBe(true)
    expect(r.max).toBeLessThanOrEqual(100.3)
    expect(r.t).toBeLessThan(1)   // response 0.35 s settles well inside a second
  })
  it('damping below 1 overshoots', () => {
    expect(run(SPRING.sheet, 0, 100).max).toBeGreaterThan(100.5)
  })
  it('carries an initial velocity forward', () => {
    const still = step({ x: 0, v: 0 }, 0, SPRING.default, 1 / 60)
    const moving = step({ x: 0, v: 1000 }, 0, SPRING.default, 1 / 60)
    expect(still.x).toBe(0)
    expect(moving.x).toBeGreaterThan(5)
  })
  it('projects a flick the way scrolling decelerates', () => {
    expect(project(1000)).toBeCloseTo(499, 0)
    expect(project(-500)).toBeCloseTo(-249.5, 0)
  })
  it('rubber-bands progressively', () => {
    expect(rubberband(0, 500)).toBe(0)
    const a = rubberband(50, 500), b = rubberband(200, 500)
    expect(a).toBeLessThan(50)
    expect(b / 200).toBeLessThan(a / 50)   // further out, less of it follows
  })
  it('velocity from recent samples', () => {
    expect(velocityOf([{ t: 0, y: 0 }, { t: 50, y: 25 }, { t: 100, y: 50 }])).toBe(500)
    expect(velocityOf([{ t: 0, y: 0 }])).toBe(0)
    // dragged, then held still for 200 ms before lifting: no velocity left
    expect(velocityOf([{ t: 0, y: 0 }, { t: 50, y: 40 }, { t: 100, y: 80 }, { t: 300, y: 80 }])).toBe(0)
  })
})

describe('glass droplet', () => {
  it('stretches with speed, in either direction, up to a quarter', () => {
    expect(stretchFor(0)).toBe(1)
    expect(stretchFor(400)).toBeCloseTo(1.1, 5)
    expect(stretchFor(-400)).toBeCloseTo(1.1, 5)
    expect(stretchFor(100000)).toBe(1.25)
  })
})
