import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { faDigits, toNumber } from '../lib/plan.js'
import { haptic } from './ui.jsx'

// A number with − and + under it: one tap per plate or rep, the way you change a weight
// between sets with chalk on your hands. Tapping the number itself types one in.
export default function Stepper({ value, onChange, step = 1, min = 0, max = 999, unit, label, disabled }) {
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')
  const input = useRef(null)
  useEffect(() => { if (typing) input.current?.select() }, [typing])
  const v = toNumber(value)
  const round = x => Math.round(x * 100) / 100
  const bump = dir => {
    const base = v ?? 0
    // From a number off the step's grid, the first tap lands on the grid.
    const onGrid = Math.abs(base / step - Math.round(base / step)) < 1e-6
    const next = onGrid ? base + dir * step : (dir > 0 ? Math.ceil(base / step) : Math.floor(base / step)) * step
    onChange(round(Math.min(max, Math.max(min, next))))
    haptic(6)
  }
  const commit = () => {
    const n = toNumber(text)
    if (n != null) onChange(round(Math.min(max, Math.max(min, n))))
    setTyping(false)
  }
  return <div className={'stepper' + (disabled ? ' disabled' : '')} role="group" aria-label={label}>
    {typing
      ? <input ref={input} className="stepper-value" inputMode="decimal" value={text} onChange={e => setText(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} aria-label={label} autoFocus />
      : <button type="button" className="stepper-value pressable" disabled={disabled} onClick={() => { setText(v == null ? '' : String(v)); setTyping(true) }}
        aria-label={`${label}: ${v == null ? 'خالی' : faDigits(v)}${unit ? ' ' + unit : ''}`}>
        {v == null ? '—' : faDigits(v)}{unit && <span className="stepper-unit">{unit}</span>}
      </button>}
    <div className="stepper-buttons">
      <button type="button" className="pressable" disabled={disabled || (v ?? 0) <= min} onClick={() => bump(-1)} aria-label={`${label} کمتر`}><Icon name="remove" /></button>
      <button type="button" className="pressable" disabled={disabled || (v ?? 0) >= max} onClick={() => bump(1)} aria-label={`${label} بیشتر`}><Icon name="add" /></button>
    </div>
  </div>
}
