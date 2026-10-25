import { useState } from 'react'
import { supabase, must } from '../../lib/supabase.js'
import { STEPS, SEX, DAYS_PER_WEEK, toggle, stepDone, clean } from '../../lib/intake.js'
import { todayISO } from '../../lib/plan.js'
import { IntField, WeightField } from '../../components/Wheel.jsx'
import { useToast, errorText, haptic } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'

const fa = n => Number(n).toLocaleString('fa-IR')

// One option of a question: a row with a radio or a checkbox at its end.
function Choice({ on, multi, children, onClick }) {
  return <button type="button" className={'row pressable choice' + (on ? ' on' : '')} role={multi ? 'checkbox' : 'radio'} aria-checked={on} onClick={onClick}>
    <div className="content"><div className="title-text">{children}</div></div>
    <span className={'tick' + (multi ? ' square' : '')} aria-hidden="true">{on && <Icon name="check" />}</span>
  </button>
}

// «توضیح بنویس» opens a box for the student's own words; it stays open once there is text.
function Note({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(!!value)
  if (!open) return <button type="button" className="btn plain pressable note-open" onClick={() => setOpen(true)}><Icon name="edit_note" />توضیح بیشتر (اختیاری)</button>
  return <div className="field mt"><label>توضیح بیشتر <span className="caption">(اختیاری)</span></label>
    <textarea className="input" autoFocus={!value} placeholder={placeholder} value={value || ''} maxLength={600} onChange={e => onChange(e.target.value)} /></div>
}

function Body({ a, set }) {
  return <>
    <div className="section-title">جنسیت</div>
    <div className="seg-choice" role="radiogroup" aria-label="جنسیت">
      {SEX.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={a.sex === k}
        className={'chip glass-lite pressable' + (a.sex === k ? ' on' : '')} onClick={() => set({ sex: k })}>{l}</button>)}
    </div>
    <div className="inline-fields mt" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
      <div className="field"><label>سن</label>
        <IntField value={a.age ?? ''} onChange={v => set({ age: v })} title="سن" min={10} max={90} unit="سال" fallback={25} placeholder="انتخاب" /></div>
      <div className="field"><label>قد (سانتی‌متر)</label>
        <IntField value={a.height ?? ''} onChange={v => set({ height: v })} title="قد" min={120} max={220} unit="سانتی‌متر" fallback={170} placeholder="انتخاب" /></div>
      <div className="field"><label>وزن (کیلو)</label>
        <WeightField value={a.weight ?? ''} onChange={v => set({ weight: v === '' ? undefined : Number(v) })} title="وزن" fine min={30} max={250} placeholder="انتخاب" /></div>
    </div>
  </>
}

function Options({ step, a, set }) {
  const multi = !!step.multi
  const val = a[step.key]
  return <>
    <div className="group glass-lite" role={multi ? 'group' : 'radiogroup'} aria-label={step.title}>
      {step.options.map(([k, l]) => <Choice key={k} multi={multi} on={multi ? (val || []).includes(k) : val === k}
        onClick={() => { haptic(4); set({ [step.key]: multi ? toggle(val, k) : k }) }}>{l}</Choice>)}
    </div>
    {step.key === 'experience' && <>
      <div className="section-title mt">چند روز در هفته می‌توانی تمرین کنی؟</div>
      <div className="days-choice" role="radiogroup" aria-label="روز در هفته">
        {DAYS_PER_WEEK.map(d => <button key={d} type="button" role="radio" aria-checked={a.days === d}
          className={'chip glass-lite pressable' + (a.days === d ? ' on' : '')} onClick={() => set({ days: d })}>{fa(d)}</button>)}
      </div>
    </>}
    <Note value={a[step.key + '_note']} onChange={v => set({ [step.key + '_note']: v })} placeholder={step.note} />
  </>
}

// The questionnaire, one screen per topic. `initial` holds earlier answers when editing.
export default function Intake({ student, initial, onDone, onCancel }) {
  const toast = useToast()
  const [a, setA] = useState(() => ({ ...(initial || {}) }))
  const [i, setI] = useState(0)
  const [busy, setBusy] = useState(false)
  const step = STEPS[i]
  const last = i === STEPS.length - 1
  const set = patch => setA(x => ({ ...x, ...patch }))
  const ok = stepDone(step.key, a)

  const finish = async () => {
    setBusy(true)
    try {
      const answers = clean({ ...a, answered_year: initial?.answered_year && initial.age === a.age ? initial.answered_year : new Date().getFullYear() })
      await must(supabase.from('intakes').upsert({ student_id: student.id, answers, completed_at: new Date().toISOString() }))
      // The first weight also starts the weight chart.
      if (answers.weight && answers.weight !== initial?.weight) {
        await supabase.from('body_weights').upsert({ student_id: student.id, date: todayISO(), weight: answers.weight }, { onConflict: 'student_id,date' })
      }
      toast(initial ? 'پرسشنامه به‌روز شد' : 'ممنون! مربی‌ات این اطلاعات را می‌بیند', 'success')
      onDone(answers)
    } catch (e) { toast(errorText(e), 'error') } finally { setBusy(false) }
  }
  const next = () => { if (last) finish(); else { setI(i + 1); window.scrollTo(0, 0) } }
  const back = () => { if (i) { setI(i - 1); window.scrollTo(0, 0) } else onCancel?.() }

  return <main className="intake page no-tabbar">
    <header className="intake-top">
      <div className="side">{(i > 0 || onCancel) && <button className="icon-btn glass interactive" onClick={back} aria-label={i ? 'قبلی' : 'بستن'}>
        <Icon name={i ? 'chevron_right' : 'close'} /></button>}</div>
      <div className="intake-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i + 1} aria-label="پیشرفت پرسشنامه">
        {STEPS.map((s, k) => <span key={s.key} className={k < i ? 'done' : k === i ? 'now' : ''} />)}
      </div>
      <div className="side end caption tnum">{fa(i + 1)} از {fa(STEPS.length)}</div>
    </header>

    {i === 0 && !initial && <p className="intake-hello footnote">سلام {student.full_name}! قبل از شروع، چند سؤال کوتاه داریم تا مربی برنامه‌ای مناسب خودت بنویسد.</p>}
    <div className="intake-head">
      <div className="tile-icon"><Icon name={step.icon} /></div>
      <h1 className="title">{step.title}</h1>
      <div className="footnote">{step.sub}</div>
    </div>

    {step.key === 'body' ? <Body a={a} set={set} /> : <Options key={step.key} step={step} a={a} set={set} />}

    <div className="float-bar no-tabbar">
      <button className="btn glass interactive prominent block" disabled={!ok || busy} onClick={next}>
        {busy ? 'در حال ثبت…' : last ? (initial ? 'ذخیره' : 'ثبت و شروع') : 'ادامه'}
        {!last && !busy && <Icon name="chevron_left" />}
      </button>
    </div>
  </main>
}
