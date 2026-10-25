import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Sheet, { useSheet } from './Sheet.jsx'
import { faDigits } from '../lib/plan.js'
import { range, splitWeight, joinWeight, parseReps, joinReps, nearest } from '../lib/wheel.js'

// An iOS-style picker wheel: a column that scrolls and snaps one value at a time. Values curve
// away from the centre band like the face of a drum (rotateX + fade), the centred one is the
// value. Drag, flick, tap a value, or use the arrow keys.
export function Wheel({ values, value, onChange, format = faDigits, label, width = '4.5rem' }) {
  const ref = useRef(null)
  const idx = useRef(-1)
  const raf = useRef(0)
  const h = () => ref.current?.firstElementChild?.offsetHeight || 44
  const indexOf = v => {
    let i = values.indexOf(v)
    if (i < 0 && typeof values[0] === 'number') i = values.indexOf(nearest(values, v))
    return Math.max(0, i)
  }
  const paint = () => {
    const el = ref.current
    if (!el) return
    const c = el.scrollTop / h()
    ;[...el.children].forEach((opt, k) => {
      const d = k - c
      opt.style.transform = `rotateX(${Math.max(-75, Math.min(75, -d * 22))}deg)`
      opt.style.opacity = String(Math.max(0.18, 1 - Math.abs(d) * 0.3))
      opt.classList.toggle('sel', Math.abs(d) < 0.5)
    })
  }
  // Start on the current value, and follow it when it changes from outside.
  useLayoutEffect(() => {
    const i = indexOf(value)
    if (i === idx.current) return
    idx.current = i
    ref.current.scrollTop = i * h()
    paint()
  }, [value, values])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const onScroll = () => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      paint()
      const i = Math.max(0, Math.min(values.length - 1, Math.round(ref.current.scrollTop / h())))
      if (i !== idx.current) {
        idx.current = i
        navigator.vibrate?.(3)   // a detent under the finger where the device allows it
        onChange(values[i])
      }
    })
  }
  const go = i => ref.current.scrollTo({ top: Math.max(0, Math.min(values.length - 1, i)) * h(), behavior: 'smooth' })
  const onKey = e => {
    if (e.key === 'ArrowUp') { e.preventDefault(); go(idx.current - 1) }
    if (e.key === 'ArrowDown') { e.preventDefault(); go(idx.current + 1) }
  }
  return <div ref={ref} className="wheel" style={{ width }} onScroll={onScroll} onKeyDown={onKey} tabIndex={0} data-no-drag
    role="spinbutton" aria-label={label} aria-valuetext={format(values[Math.max(0, idx.current)])}>
    {values.map((v, k) => <div key={k} className="opt" onClick={() => go(k)}>{format(v)}</div>)}
  </div>
}

// Wheels side by side over one selection band, with optional text between them (".", "تا")
// and a caption under each column.
export function Wheels({ children, unit }) {
  return <div className="wheels-wrap">
    <div className="wheels" dir="ltr">{children}</div>
    {unit && <div className="wheels-unit">{unit}</div>}
  </div>
}
export const WheelSep = ({ children }) => <div className="wheel-sep" aria-hidden="true">{children}</div>
export const WheelCol = ({ caption, children }) => <div className="wheel-col">{children}<div className="wheel-caption">{caption}</div></div>

// A field that shows its value and opens a sheet of wheels. `render(draft, setDraft)` draws the
// wheels; the draft is applied on «تأیید».
function PickField({ title, text, placeholder, initial, render, onDone, clearText, onClear, ariaLabel, className = '', hint }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className={'input pick ' + className} onClick={() => setOpen(true)} aria-label={ariaLabel || title}>
      {text !== '' && text != null ? text : <span className="ph">{placeholder ?? '—'}</span>}
    </button>
    {open && <Sheet title={title} onClose={() => setOpen(false)}>
      <PickBody initial={initial} render={render} onDone={onDone} clearText={clearText} onClear={onClear} hint={hint} />
    </Sheet>}
  </>
}
function PickBody({ initial, render, onDone, clearText, onClear, hint }) {
  const { close } = useSheet()
  const [draft, setDraft] = useState(initial)
  return <>
    {hint && <div className="caption" style={{ textAlign: 'center', marginTop: '-0.25rem' }}>{hint}</div>}
    {render(draft, setDraft)}
    <div className="stack">
      <button className="btn glass interactive prominent block" onClick={() => { onDone(draft); close() }}>تأیید</button>
      {onClear && <button className="btn glass interactive block" onClick={() => { onClear(); close() }}>{clearText}</button>}
    </div>
  </>
}

const FRAC_QUARTER = [0, 0.25, 0.5, 0.75]
const FRAC_TENTH = range(0, 0.9, 0.1)
const fmtFrac = f => faDigits(String(f).replace(/^0\.?/, '') || '0')
const showKg = v => (v === '' || v == null ? '' : faDigits(v))

// Weight: whole kilos and a fraction (quarters for plates, tenths for body weight).
export function WeightField({ value, onChange, title = 'وزن', hint, hintLabel = 'پیشنهاد', min = 0, max = 400, fine = false, clearText, ariaLabel, placeholder, className }) {
  const fracs = fine ? FRAC_TENTH : FRAC_QUARTER
  const start = value !== '' && value != null ? value : hint ?? (fine ? 70 : 20)
  const [w0, f0] = splitWeight(start, fracs)
  const wholes = range(min, max)
  return <PickField title={title} ariaLabel={ariaLabel} className={'num ' + (className || '')} text={showKg(value)}
    placeholder={placeholder ?? (hint != null && hint !== '' ? faDigits(hint) : '—')}
    hint={hint != null && hint !== '' && (value === '' || value == null) ? `${hintLabel}: ${faDigits(hint)} کیلو` : null}
    initial={{ w: Math.min(max, Math.max(min, w0 ?? min)), f: f0 }}
    render={(d, set) => <Wheels unit="کیلو">
      <Wheel values={wholes} value={d.w} onChange={w => set(x => ({ ...x, w }))} label="کیلو" />
      <WheelSep>٫</WheelSep>
      <Wheel values={fracs} value={d.f} onChange={f => set(x => ({ ...x, f }))} format={fmtFrac} label="اعشار" width="3.5rem" />
    </Wheels>}
    onDone={d => onChange(joinWeight(d.w, d.f))}
    clearText={clearText} onClear={clearText ? () => onChange('') : null} />
}

// A whole number on one wheel: sets, reps, seconds.
export function IntField({ value, onChange, title, min = 0, max = 100, step = 1, unit, clearText, ariaLabel, placeholder, className, fallback }) {
  const values = range(min, max, step)
  const start = nearest(values, value !== '' && value != null ? value : fallback ?? min) ?? min
  return <PickField title={title} ariaLabel={ariaLabel} className={'num ' + (className || '')}
    text={value === '' || value == null ? '' : faDigits(value)} placeholder={placeholder}
    initial={start}
    render={(d, set) => <Wheels unit={unit}><Wheel values={values} value={d} onChange={set} label={title} /></Wheels>}
    onDone={onChange} clearText={clearText} onClear={clearText ? () => onChange('') : null} />
}

// Planned reps: a number, or a range "8-12" (the second wheel at «—» means no range).
export function RepsField({ value, onChange, title = 'تکرار', className }) {
  const [a, b] = parseReps(value)
  const froms = range(1, 50), tos = [0, ...range(2, 50)]
  return <PickField title={title} className={'num ' + (className || '')} text={faDigits(value || '')}
    initial={{ a, b: b || 0 }}
    render={(d, set) => <Wheels unit="تکرار">
      <Wheel values={froms} value={d.a} onChange={a => set(x => ({ ...x, a }))} label="از" />
      <WheelSep>تا</WheelSep>
      <Wheel values={tos} value={d.b} onChange={b => set(x => ({ ...x, b }))} format={v => (v ? faDigits(v) : '—')} label="تا" />
    </Wheels>}
    onDone={d => onChange(joinReps(d.a, d.b || null))} />
}

// Tempo: four wheels (down · pause · up · pause), or one tap on a common pattern.
const TEMPO_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'X']
export const TEMPO_PRESETS = ['3010', '2020', '3110', '4010', '20X0']
const fmtTempoChar = c => (c === 'X' ? 'X' : faDigits(c))
const tempoText = t => (t ? [...t].map(fmtTempoChar).join('-') : '')
export function TempoField({ value, onChange, className }) {
  const start = value && value.length === 4 ? [...value] : ['3', '0', '1', '0']
  return <PickField title="تمپو" className={'num ' + (className || '')} text={tempoText(value)} placeholder="بدون تمپو"
    initial={start}
    render={(d, set) => <>
      <div className="hstack wrap" data-no-drag style={{ justifyContent: 'center', marginBottom: '0.5rem' }}>
        {TEMPO_PRESETS.map(p => <button key={p} type="button" className={'chip glass-lite pressable' + (d.join('') === p ? ' on' : '')}
          onClick={() => set([...p])}>{tempoText(p)}</button>)}
      </div>
      <Wheels>
        {['پایین', 'مکث', 'بالا', 'مکث'].map((cap, i) => <WheelCol key={i} caption={cap}>
          <Wheel values={TEMPO_VALUES} value={d[i]} onChange={c => set(x => x.map((y, k) => (k === i ? c : y)))} format={fmtTempoChar} label={cap} width="3.25rem" />
        </WheelCol>).reverse()}
      </Wheels>
      <div className="caption" style={{ textAlign: 'center', marginBottom: '1rem' }}>ثانیه برای هر مرحله · X یعنی انفجاری</div>
    </>}
    onDone={d => onChange(d.join(''))} clearText="بدون تمپو" onClear={() => onChange('')} />
}
