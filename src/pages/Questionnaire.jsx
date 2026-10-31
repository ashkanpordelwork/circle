import { useState } from 'react'
import { supabase, must } from '../lib/supabase.js'
import { visibleQuestions, optionsOf, toggle, problem, tidy, levelOf, needsAttention, isComplete, WEEKDAYS } from '../lib/questionnaire.js'
import { toNumber, todayISO, faDigits } from '../lib/plan.js'
import { useToast, errorText, haptic } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

// The questionnaire (SPEC §3.4): one question a screen, a progress bar, and a short «why we ask»
// under each. The first time it can be put off («بعداً»); from «حساب» it edits the answers.
// The questions and what follows from them are in lib/questionnaire.js.

const fa = n => Number(n).toLocaleString('fa-IR')

function Choice({ on, multi, disabled, children, onClick }) {
  return <button type="button" className={'row pressable choice' + (on ? ' on' : '')} role={multi ? 'checkbox' : 'radio'} aria-checked={on} disabled={disabled} onClick={onClick}>
    <div className="content"><div className="title-text">{children}</div></div>
    <span className={'tick' + (multi ? ' square' : '')} aria-hidden="true">{on && <Icon name="check" />}</span>
  </button>
}

function Answer({ q, a, set, advance }) {
  const v = a[q.key]
  // What is typed stays as typed (Persian digits too); the answer is its number.
  const [text, setText] = useState(() => (v == null ? '' : faDigits(v)))
  if (q.type === 'number') return <div className="field">
    <div className="hstack">
      <input className="input grow tnum q-number" inputMode={q.decimal ? 'decimal' : 'numeric'} autoFocus placeholder={q.placeholder}
        aria-label={q.title} value={text} onChange={e => { setText(e.target.value); set({ [q.key]: e.target.value.trim() === '' ? undefined : toNumber(e.target.value) ?? NaN }) }}
        onKeyDown={e => { if (e.key === 'Enter') advance() }} />
      {q.unit && <span className="subhead secondary">{q.unit}</span>}
    </div>
  </div>
  if (q.type === 'text') return <textarea className="input" rows={4} maxLength={600} placeholder={q.placeholder} aria-label={q.title}
    value={v ?? ''} onChange={e => set({ [q.key]: e.target.value || undefined })} />
  if (q.type === 'weekdays') {
    const days = v || []
    const full = days.length >= Number(a.days)
    return <>
      <div className="footnote q-hint">{fa(a.days)} روز را انتخاب کن.</div>
      <div className="group glass-lite" role="group" aria-label={q.title}>
        {WEEKDAYS.map(([d, name]) => <Choice key={d} multi on={days.includes(d)} disabled={full && !days.includes(d)}
          onClick={() => { haptic(4); set({ weekdays: days.includes(d) ? days.filter(x => x !== d) : [...days, d] }) }}>{name}</Choice>)}
      </div>
    </>
  }
  const multi = q.type === 'multi'
  return <>
    <div className="group glass-lite" role={multi ? 'group' : 'radiogroup'} aria-label={q.title}>
      {/* «ندارم» rules the rest out: they stay greyed until it is unticked. */}
      {optionsOf(q, a).map(([k, l]) => <Choice key={k} multi={multi} on={multi ? (v || []).includes(k) : v === k}
        disabled={multi && k !== 'none' && (v || []).includes('none')}
        onClick={() => {
          haptic(4)
          if (multi) return set({ [q.key]: toggle(v, k) })
          set({ [q.key]: k }); advance({ [q.key]: k })   // one choice: on to the next question
        }}>{l}</Choice>)}
    </div>
    {q.note && <Note value={a[q.key + '_note']} onChange={t => set({ [q.key + '_note']: t || undefined })} />}
  </>
}

// «توضیح بیشتر» opens a box for their own words; it stays open once there is text.
function Note({ value, onChange }) {
  const [open, setOpen] = useState(!!value)
  if (!open) return <button type="button" className="btn plain pressable note-open" onClick={() => setOpen(true)}><Icon name="edit_note" />توضیح بیشتر (اختیاری)</button>
  return <div className="field mt"><label>توضیح بیشتر <span className="caption">(اختیاری)</span></label>
    <textarea className="input" autoFocus={!value} value={value || ''} maxLength={600} onChange={e => onChange(e.target.value)} /></div>
}

// userId: whose profile; initial: earlier answers (editing); onDone(profile) after saving;
// onSkip for «بعداً» (first time only); onCancel to close without saving (editing).
export default function Questionnaire({ userId, studentId, initial, onDone, onSkip, onCancel }) {
  const toast = useToast()
  const [a, setA] = useState(() => ({ ...(initial || {}) }))
  const [i, setI] = useState(0)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const list = visibleQuestions(a)
  const q = list[Math.min(i, list.length - 1)]
  const last = i >= list.length - 1
  const set = patch => { setA(x => ({ ...x, ...patch })); setTried(false) }
  const wrong = problem(q, a)

  const save = async patch => {
    setBusy(true)
    try {
      const row = { user_id: userId, ...patch }
      const [saved] = await must(supabase.from('profiles').upsert(row).select())
      onDone(saved)
    } catch (e) { toast(errorText(e), 'error'); setBusy(false) }
  }
  const finish = async answers => {
    const clean = tidy(answers)
    if (!isComplete(clean)) return toast('چند سؤال جواب نگرفته؛ برگرد و کاملش کن.', 'warning')
    // The first weight also starts the weight chart (stage 5 reads body_weights).
    if (studentId && clean.weight && clean.weight !== initial?.weight) {
      await supabase.from('body_weights').upsert({ student_id: studentId, date: todayISO(), weight: clean.weight }, { onConflict: 'student_id,date' })
    }
    await save({ answers: clean, level: levelOf(clean), needs_attention: needsAttention(clean), completed_at: new Date().toISOString() })
  }
  // patch: an answer just chosen, not yet in state.
  const advance = (patch = {}) => {
    const next = { ...a, ...patch }
    if (problem(q, next)) return setTried(true)
    const nextList = visibleQuestions(next)
    if (i >= nextList.length - 1) return finish(next)
    setTimeout(() => { setI(nextList.indexOf(q) + 1); window.scrollTo(0, 0) }, patch[q.key] !== undefined ? 180 : 0)
  }
  const back = () => { if (i) { setI(i - 1); window.scrollTo(0, 0) } else onCancel?.() }
  const share = list.length ? (i + 1) / list.length : 0

  return <main className="intake page no-tabbar">
    <header className="intake-top">
      <div className="side">{(i > 0 || onCancel) && <button className="icon-btn glass interactive" onClick={back} aria-label={i ? 'قبلی' : 'بستن'}>
        <Icon name={i ? 'chevron_right' : 'close'} /></button>}</div>
      <div className="q-progress" role="progressbar" aria-valuemin={1} aria-valuemax={list.length} aria-valuenow={i + 1} aria-label="پیشرفت پرسشنامه">
        <span style={{ width: `${share * 100}%` }} /></div>
      <div className="side end caption tnum">{fa(i + 1)} از {fa(list.length)}</div>
    </header>

    {i === 0 && !initial && <p className="intake-hello footnote">خوش آمدی! چند سؤال کوتاه داریم تا برنامه‌ات واقعاً مال خودت باشد. حدود ۲ دقیقه طول می‌کشد.</p>}
    <div className="intake-head">
      <h1 className="title">{q.title}</h1>
      <div className="q-why footnote"><Icon name="info" />{q.why}</div>
    </div>

    <Answer key={q.key} q={q} a={a} set={set} advance={advance} />
    {tried && wrong && <div className="caption q-wrong" role="alert">{wrong}</div>}

    <div className="float-bar no-tabbar">
      {q.type !== 'single' || last ? <button className="btn glass interactive prominent block" disabled={busy} onClick={() => advance()}>
        {busy ? 'در حال ثبت…' : last ? (initial ? 'ذخیره' : 'تمام') : q.optional && !a[q.key] ? 'رد شدن' : 'ادامه'}
        {!last && !busy && <Icon name="chevron_left" />}
      </button> : null}
      {onSkip && <button className="btn plain pressable block" disabled={busy} onClick={() => save({ skipped_at: new Date().toISOString() })}>بعداً</button>}
    </div>
  </main>
}
