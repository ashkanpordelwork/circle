import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO } from '../lib/plan.js'
import { READINESS, readinessScore, readinessAdvice, readinessTone } from '../lib/body.js'
import { scope } from '../lib/scope.js'
import { useToast, errorText } from './ui.jsx'
import Sheet, { useSheet } from './Sheet.jsx'
import Icon from './Icon.jsx'

const fa = n => Number(n).toLocaleString('fa-IR')

// The check-in before a workout: four taps, or skip. Only the athlete sees it (0009_body.sql).
export function ReadinessSheet({ initial, onSaved, onClose }) {
  return <Sheet title="امروز چطوری؟" onClose={onClose}><Body initial={initial} onSaved={onSaved} /></Sheet>
}
function Body({ initial, onSaved }) {
  const { close } = useSheet()
  const toast = useToast()
  const [v, setV] = useState(initial || {})
  const [busy, setBusy] = useState(false)
  const score = readinessScore(v)
  const save = async () => {
    setBusy(true)
    const row = { student_id: scope.student, date: todayISO(), ...Object.fromEntries(READINESS.map(([k]) => [k, v[k]])) }
    const { error } = await supabase.from('readiness_checks').upsert(row, { onConflict: 'student_id,date' })
    setBusy(false)
    if (error) return toast(/readiness_checks/.test(error.message) ? 'چک‌این آمادگی هنوز فعال نشده.' : errorText(error), 'error')
    onSaved?.(row); close()
  }
  return <>
    <p className="subhead secondary" style={{ marginTop: 0 }}>چهار سؤال کوتاه. فقط خودت می‌بینی.</p>
    {READINESS.map(([k, label, words]) => <div key={k} className="field">
      <label>{label}{v[k] ? <span className="caption"> · {words[v[k] - 1]}</span> : null}</label>
      <div className="scale" role="radiogroup" aria-label={label}>{[1, 2, 3, 4, 5].map(n =>
        <button key={n} type="button" role="radio" aria-checked={v[k] === n} aria-label={words[n - 1]}
          className={'scale-dot pressable' + (v[k] === n ? ' on' : '')} onClick={() => setV(x => ({ ...x, [k]: n }))}>{fa(n)}</button>)}</div>
    </div>)}
    {score != null && <div className={'readiness-result ' + readinessTone(score)}>
      <div className="tnum score">{fa(score)}٪</div><div className="subhead">{readinessAdvice(score)}</div>
    </div>}
    <button className="btn glass interactive prominent block mt" disabled={score == null || busy} onClick={save}><Icon name="check" />ثبت</button>
    <button className="btn plain block mt" onClick={close}>رد شدن</button>
  </>
}
