import { useLayoutEffect, useRef } from 'react'
import { animateSpring, reducedMotion } from '../lib/spring.js'
import { stretchFor } from '../lib/glass.js'

// The glass droplet under the selected item of a tab bar or segmented control. When the selection
// changes it slides there on a spring from where it is now — so a quick second tap redirects it
// mid-flight — and it stretches along its path while it moves, the way the iOS 26 tab bar does.
// `container` holds the items; `selector` finds them; `index` is the selected one.
export default function GlassDrop({ container, selector, index, className }) {
  const drop = useRef(null)
  const st = useRef({ x: null, w: 0, anim: null })

  useLayoutEffect(() => {
    // The drop sits inside its container. On first mount the parent's ref is not attached yet
    // (children commit first), so fall back to the parent element.
    const el = drop.current
    const box = container?.current || el?.parentElement
    if (!box || !el) return
    const place = (animate) => {
      const items = box.querySelectorAll(selector)
      const item = items[index]
      if (!item) { el.style.opacity = '0'; return }
      const b = box.getBoundingClientRect(), r = item.getBoundingClientRect()
      const x = r.left - b.left, w = r.width
      const s = st.current
      el.style.opacity = '1'
      el.style.width = `${w}px`
      s.w = w
      const draw = (pos, v = 0) => { el.style.transform = `translateX(${pos}px) scaleX(${stretchFor(v)})` }
      if (s.x == null || !animate || reducedMotion()) { s.anim?.stop(); s.x = x; draw(x); return }
      const from = s.anim ? s.anim.stop().x : s.x
      let prev = from, prevT = performance.now()
      s.anim = animateSpring({
        from, to: x, params: { damping: 0.78, response: 0.38 },
        onUpdate: v => {
          const now = performance.now()
          const vel = ((v - prev) / Math.max(1, now - prevT)) * 1000
          prev = v; prevT = now; s.x = v
          draw(v, vel)
        },
        onDone: () => { s.anim = null; draw(x) }
      })
    }
    place(true)
    const ro = new ResizeObserver(() => place(false))
    ro.observe(box)
    return () => ro.disconnect()
  }, [index])

  return <div ref={drop} className={className} aria-hidden="true" style={{ transformOrigin: 'center' }} />
}
