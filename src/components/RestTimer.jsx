import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { faDigits } from '../lib/plan.js'
import { haptic } from './ui.jsx'

export const clock = sec => {
  const s = Math.max(0, Math.round(sec))
  return faDigits(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'))
}

// Rest between sets: starts when a set is ticked, floats over the bottom of the page, never in
// the way of the next set. ±15 seconds, or skip. When it runs out the phone buzzes once.
export default function RestTimer({ rest, onChange, onDone }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t) }, [])
  const left = (rest.endsAt - now) / 1000
  const over = left <= 0
  useEffect(() => {
    if (!over) return
    haptic([120, 80, 120])
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [over])
  const add = d => onChange({ ...rest, endsAt: Math.max(Date.now(), rest.endsAt + d * 1000), total: Math.max(15, rest.total + d) })
  return <div className={'rest-timer' + (over ? ' over' : '')} role="timer" aria-live={over ? 'assertive' : 'off'}>
    <div className="rest-bar" style={{ transform: `scaleX(${over ? 0 : Math.min(1, left / rest.total)})` }} />
    <div className="rest-main">
      <Icon name="timer" />
      <div className="grow">
        <div className="caption">{over ? 'استراحت تمام شد' : 'استراحت'}</div>
        <div className="rest-clock tnum">{over ? 'ست بعدی' : clock(left)}</div>
      </div>
      {!over && <>
        <button className="btn plain small pressable" onClick={() => add(-15)} aria-label="۱۵ ثانیه کمتر">−۱۵</button>
        <button className="btn plain small pressable" onClick={() => add(15)} aria-label="۱۵ ثانیه بیشتر">+۱۵</button>
      </>}
      <button className="icon-btn bare" onClick={onDone} aria-label="بستن تایمر"><Icon name="close" /></button>
    </div>
  </div>
}
