import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { newId, faDigits } from '../../lib/plan.js'
import { DAY_NAMES } from '../../lib/plan.js'
import { loadExercises } from '../../lib/exercises.js'
import { previewPlan, unresolved, routineItems, PLAN_PROMPT } from '../../lib/importPlan.js'
import { missingMigration, NUTRITION_SETUP } from '../../lib/nutrition.js'
import { Page, Loading, useToast, errorText } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { ExName } from '../../components/ExerciseInfo.jsx'
import ExercisePicker from '../../components/ExercisePicker.jsx'
import { loadStudentPlan } from './data.js'
import { saveMine } from './Routines.jsx'

// «وارد کردن برنامه»: the plan the athlete's AI wrote comes in as one «کد برنامه». Four steps:
// copy the prompt, paste the answer, check the preview (and settle any exercise the library did
// not recognise for sure), save. Everything is worked out here, in the app (lib/importPlan.js).

const fa = n => Number(n).toLocaleString('fa-IR')
const STATUS = { sure: ['check_circle', 'پیدا شد'], maybe: ['help', 'مطمئن نیستیم'], missing: ['error', 'پیدا نشد'] }

export default function ImportPlan() {
  const nav = useNavigate()
  const toast = useToast()
  const [lib, setLib] = useState(null)
  const [mine, setMine] = useState([])
  const [text, setText] = useState('')
  const [errors, setErrors] = useState([])
  const [preview, setPreview] = useState(null)
  const [picking, setPicking] = useState(null)   // [workout, exercise]
  const [busy, setBusy] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  useEffect(() => {
    loadExercises().then(setLib)
    loadStudentPlan().then(p => setMine(p.mine)).catch(() => {})
  }, [])
  if (!lib) return <Page title="وارد کردن برنامه" back="/routines"><Loading /></Page>

  const copy = async () => {
    try { await navigator.clipboard.writeText(PLAN_PROMPT); toast('پرامپت کپی شد؛ برای هوش مصنوعی‌ات بفرست', 'success') }
    catch { setShowPrompt(true); toast('کپی ممکن نشد؛ متن را از پایین انتخاب و کپی کن.', 'warning') }
  }
  const check = () => {
    const r = previewPlan(text, lib)
    setErrors(r.errors); setPreview(r.preview || null)
    if (r.preview) setTimeout(() => document.getElementById('step3')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const setMatch = (w, x, match) => setPreview(p => ({ ...p, workouts: p.workouts.map((ww, i) => (i !== w ? ww
    : { ...ww, exercises: ww.exercises.map((xx, k) => (k !== x ? xx : { ...xx, match })) })) }))
  const drop = (w, x) => setPreview(p => ({ ...p, workouts: p.workouts.map((ww, i) => (i !== w ? ww : { ...ww, exercises: ww.exercises.filter((_, k) => k !== x) })) }))
  const left = preview ? unresolved(preview) : 0
  const replacing = preview?.workouts.length ? mine : []

  const save = async () => {
    setBusy(true)
    let nutritionSkipped = false
    try {
      // Workouts: the new routines first, then the old ones go — a failure halfway leaves the
      // old plan in place. Workouts already logged keep their name (and stay in the history).
      if (preview.workouts.length) {
        for (const [i, w] of preview.workouts.filter(w => w.exercises.length).entries()) {
          const id = newId()
          await saveMine(id, w.name, routineItems(w))
          await must(supabase.from('routines').update({ days: w.days, position: i }).eq('id', id))
        }
        if (mine.length) await must(supabase.from('routines').delete().in('id', mine.map(r => r.id)))
      }
      if (preview.nutrition || preview.supplements) {
        const { error } = await supabase.rpc('save_nutrition_plan', {
          p_targets: preview.nutrition?.targets ?? null, p_meals: preview.nutrition?.meals ?? [], p_supplements: preview.supplements ?? [] })
        if (error) { if (missingMigration(error)) nutritionSkipped = true; else throw error }
      }
      if (nutritionSkipped) toast(NUTRITION_SETUP, 'warning')
      else toast('برنامه‌ات ذخیره شد', 'success')
      nav('/routines', { replace: true })
    } catch (e) { toast(errorText(e), 'error'); setBusy(false) }
  }

  return <Page title="وارد کردن برنامه" back="/routines">
    <section className="card glass-lite step">
      <div className="step-head"><span className="step-n">{fa(1)}</span><div className="headline">پرامپت را برای هوش مصنوعی‌ات بفرست</div></div>
      <p className="subhead secondary">در همان گفتگویی که برنامه‌ات را نوشته (مثلاً Claude)، این پرامپت را بفرست. برنامه را در قالبی برمی‌گرداند که اپ می‌خواند.</p>
      <button className="btn glass interactive prominent block" onClick={copy}><Icon name="content_copy" />کپی پرامپت</button>
      {showPrompt && <textarea className="input code-text mt" readOnly value={PLAN_PROMPT} onFocus={e => e.target.select()} rows={8} />}
    </section>

    <section className="card glass-lite step">
      <div className="step-head"><span className="step-n">{fa(2)}</span><div className="headline">پاسخش را اینجا بچسبان</div></div>
      <textarea className="input code-text" dir="ltr" rows={7} value={text} onChange={e => setText(e.target.value)}
        placeholder={'```json\n{ "version": 1, ... }\n```'} aria-label="کد برنامه" />
      <button className="btn glass interactive prominent block mt" disabled={!text.trim()} onClick={check}><Icon name="fact_check" />بررسی کد</button>
      {errors.length > 0 && <div className="import-errors" role="alert">
        <div className="title-text">کد این مشکل‌ها را دارد:</div>
        <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        <div className="footnote">این‌ها را برای هوش مصنوعی‌ات بفرست تا کد درست را بدهد.</div>
      </div>}
    </section>

    {preview && <>
      <div id="step3" className="section">
        <div className="step-head plain"><span className="step-n">{fa(3)}</span><div className="headline">پیش‌نمایش</div></div>
        <div className="hstack wrap" style={{ gap: '0.5rem', marginBottom: '1rem' }}>
          <span className="pill ok"><Icon name="check_circle" />{fa(preview.counts.sure)} تطبیق مطمئن</span>
          {preview.counts.maybe > 0 && <span className="pill warn"><Icon name="help" />{fa(preview.counts.maybe)} تطبیق احتمالی</span>}
          {preview.counts.missing > 0 && <span className="pill bad"><Icon name="error" />{fa(preview.counts.missing)} پیدا نشد</span>}
        </div>

        {preview.workouts.map((w, wi) => <div key={wi} className="section import-workout">
          <div className="section-title">{w.name}{w.days.length ? ` · ${w.days.map(d => DAY_NAMES[d]).join('، ')}` : ''}</div>
          <div className="group glass-lite">{w.exercises.map((x, xi) => {
            const [icon, label] = STATUS[x.match.status]
            return <div key={xi} className={'row import-row ' + x.match.status}>
              <Icon name={icon} filled className="st" />
              <div className="content">
                <div className="caption ltr-name">{x.name}</div>
                {x.match.exercise_id ? <ExName id={x.match.exercise_id} /> : <div className="title-text secondary">{label}</div>}
                <div className="sub">{faDigits(x.sets)} × {faDigits(x.reps)}{x.rest_sec != null ? ` · استراحت ${faDigits(x.rest_sec)} ثانیه` : ''}</div>
                {x.match.status !== 'sure' && <div className="hstack wrap import-actions">
                  {x.match.status === 'maybe' && <button className="btn glass interactive prominent small" onClick={() => setMatch(wi, xi, { ...x.match, status: 'sure' })}>درسته</button>}
                  <button className="btn glass interactive small" onClick={() => setPicking([wi, xi])}>{x.match.status === 'maybe' ? 'تغییر' : 'انتخاب حرکت'}</button>
                  <button className="btn plain small pressable" onClick={() => drop(wi, xi)}>حذف</button>
                </div>}
              </div>
              {x.match.status === 'sure' && <button className="icon-btn bare" onClick={() => setPicking([wi, xi])} aria-label={`تغییر ${x.name}`}><Icon name="edit_note" /></button>}
            </div>
          })}</div>
        </div>)}

        {preview.nutrition && <div className="section">
          <div className="section-title">تغذیه</div>
          <div className="card glass-lite" style={{ marginBottom: 0 }}>
            {preview.nutrition.targets && <div className="macro-grid">{[['calories', 'کالری'], ['protein', 'پروتئین'], ['carbs', 'کربوهیدرات'], ['fat', 'چربی']].map(([k, l]) =>
              <div key={k}><div className="tnum title-text">{fa(preview.nutrition.targets[k])}</div><div className="caption">{l}{k === 'calories' ? '' : ' (گرم)'}</div></div>)}</div>}
            {preview.nutrition.meals.map((m, i) => <div key={i} className="import-meal">
              <div className="hstack between"><div className="title-text">{m.name}</div><span className="caption tnum">{m.time ? faDigits(m.time) : ''}</span></div>
              <div className="sub">{m.items.map(it => `${it.name}${it.amount ? ` (${it.amount})` : ''}`).join('، ') || 'بدون قلم'}</div>
              <div className="caption tnum">{fa(Math.round(m.items.reduce((s, it) => s + it.calories, 0)))} کالری · {fa(Math.round(m.items.reduce((s, it) => s + it.protein, 0)))} گرم پروتئین</div>
            </div>)}
          </div>
        </div>}

        {preview.supplements?.length > 0 && <div className="section">
          <div className="section-title">مکمل‌ها</div>
          <div className="group glass-lite">{preview.supplements.map((s, i) => <div key={i} className="row">
            <div className="content"><div className="title-text"><bdi>{s.name}</bdi>{s.dose ? <> · <bdi>{s.dose}</bdi></> : null}</div><div className="sub">{s.times.map(faDigits).join('، ') || 'زمان مشخص نشده'}</div></div>
          </div>)}</div>
        </div>}
      </div>

      <section className="card glass-lite step">
        <div className="step-head"><span className="step-n">{fa(4)}</span><div className="headline">ذخیره</div></div>
        {replacing.length > 0 && <p className="subhead secondary">این روتین‌ها جایگزین می‌شوند: {replacing.map(r => `«${r.name}»`).join('، ')}. تمرین‌هایی که ثبت کرده‌ای در سابقه می‌ماند.</p>}
        {(preview.nutrition || preview.supplements) && <p className="subhead secondary">وعده‌ها و مکمل‌های قبلی هم با این‌ها جایگزین می‌شوند.</p>}
        <button className="btn glass interactive prominent block" disabled={busy || left > 0} onClick={save}>
          <Icon name="check" />{busy ? 'در حال ذخیره…' : left > 0 ? `${fa(left)} حرکت مانده که مشخص کنی` : 'ذخیره‌ی برنامه'}</button>
      </section>
    </>}

    {picking && <ExercisePicker routineName={preview.workouts[picking[0]].exercises[picking[1]]?.name}
      added={[]} onPick={id => { setMatch(picking[0], picking[1], { status: 'sure', exercise_id: id, candidates: [] }); setPicking(null) }}
      onClose={() => setPicking(null)} />}
  </Page>
}
