import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { todayISO, toNumber, faDigits, fmtTarget, DAY_NAMES } from '../../lib/plan.js'
import { pickPrograms, studentWeek, sessionLabel, weekLabel } from '../../lib/program.js'
import { addDays, fmtJ } from '../../lib/jalali.js'
import { routinesForDay } from '../../lib/plan.js'
import { ownSession, macroProgress, mealLog, dosesOf, reminders } from '../../lib/today.js'
import { missingMigration, NUTRITION_SETUP } from '../../lib/nutrition.js'
import { Page, Loading, useToast, errorText, haptic } from '../../components/ui.jsx'
import Sheet, { useSheet } from '../../components/Sheet.jsx'
import Icon from '../../components/Icon.jsx'
import { Thumb, ExName } from '../../components/ExerciseInfo.jsx'
import { useMe } from '../../App.jsx'
import { loadStudentPlan } from './data.js'
import { startLabel, minutes } from './plan-parts.jsx'
import { scope } from '../../lib/scope.js'

// «امروز»: the day's three things, top to bottom — the workout, the food (what is left of each
// macro, the meals to tick), the supplements (the dose that is due stands out). The numbers are
// worked out in lib/today.js; ticks go straight to the database, so they survive a refresh.

const fa = n => Number(n).toLocaleString('fa-IR')

// The session for today: the coach's plan first, when there is one, else the athlete's own.
function todaysSession(data, today, weekday) {
  if (data.programs.length) {
    const { current } = pickPrograms(data.programs, today)
    if (current) {
      const w = studentWeek(current, data.sessions, data.doneIds, today)
      if (w.next) return { r: w.next, kicker: weekLabel(w.week), title: sessionLabel(w.next.session), done: false }
    }
  } else if (data.weekdays.length) {
    const r = routinesForDay(data.weekdays, weekday)[0]
    if (r) return { r, kicker: 'تمرین امروز', title: r.name, done: data.doneToday.has(r.id) }
  }
  const own = ownSession(data.mine, weekday, data.lastDone, today)
  if (!own) return null
  const kicker = own.kind === 'rest' ? `امروز استراحت · جلسه‌ی بعدی ${DAY_NAMES[own.day]}` : own.kind === 'next' ? 'جلسه‌ی بعدی' : 'تمرین امروز'
  return { r: own.r, kicker, title: own.r.name, done: own.done, rest: own.kind === 'rest' }
}

async function loadNutrition(today) {
  const q = (t, f) => f(supabase.from(t).select('*').eq('student_id', scope.student))
  const [targets, meals, mealLogs, sups, supLogs] = await Promise.all([
    supabase.from('nutrition_targets').select('*').eq('student_id', scope.student).maybeSingle(),
    q('meals', x => x.order('position')),
    q('meal_logs', x => x.eq('date', today).order('created_at')),
    q('supplements', x => x.order('position')),
    q('supplement_logs', x => x.eq('date', today))])
  const err = [targets, meals, mealLogs, sups, supLogs].map(r => r.error).find(Boolean)
  if (err) { if (missingMigration(err)) return { missing: true }; throw err }
  const items = meals.data.length ? await must(supabase.from('meal_items').select('*').in('meal_id', meals.data.map(m => m.id)).order('position')) : []
  return { targets: targets.data, meals: meals.data.map(m => ({ ...m, items: items.filter(i => i.meal_id === m.id) })),
    mealLogs: mealLogs.data, supplements: sups.data, supLogs: supLogs.data }
}

export default function Today() {
  const me = useMe()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [food, setFood] = useState(null)
  const [now, setNow] = useState(new Date())
  const today = todayISO()
  useEffect(() => {
    (async () => {
      try {
        const [plan, ws] = await Promise.all([loadStudentPlan(),
          must(supabase.from('workouts').select('routine_id, date').eq('student_id', scope.student).gte('date', addDays(today, -90)).order('date'))])
        const lastDone = {}
        for (const w of ws) if (w.routine_id) lastDone[w.routine_id] = w.date
        setData({ ...plan, lastDone, workedOut: ws.some(w => w.date === today),
          doneIds: new Set(ws.map(w => w.routine_id)), doneToday: new Set(ws.filter(w => w.date === today).map(w => w.routine_id)) })
      } catch (e) { toast(errorText(e), 'error'); setData(false) }
    })()
    loadNutrition(today).then(setFood).catch(e => { toast(errorText(e), 'error'); setFood({ missing: false, failed: true }) })
    // Doses come due as the day goes on.
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])
  if (data === null || food === null) return <Page><Header today={today} /><Loading /></Page>

  const weekday = new Date().getDay()
  const session = data && todaysSession(data, today, weekday)
  const hasFood = !food.missing && !food.failed && (!!food.targets || food.meals.length > 0)
  const hasSups = !food.missing && !food.failed && food.supplements.length > 0
  const empty = !session && !hasFood && !hasSups

  return <Page>
    <Header today={today} />
    {me.student.note?.trim() && <div className="card glass-lite">
      <div className="card-head"><div className="tile-icon orange"><Icon name="sticky_note_2" filled /></div><div className="headline">از طرف مربی</div></div>
      <div className="subhead" style={{ whiteSpace: 'pre-wrap' }}>{me.student.note}</div>
    </div>}

    {empty ? <section className="card glass-lite empty-plan">
      <div className="tile-icon big lime"><Icon name="download" /></div>
      <div className="headline">هنوز برنامه‌ای نداری</div>
      <p className="subhead secondary">برنامه‌ی تمرین، غذا و مکملی که هوش مصنوعی‌ات نوشته را با یک کد بیاور.</p>
      <Link to="/routines/import" className="btn glass interactive prominent block">برنامه‌ات را وارد کن</Link>
    </section> : <>
      {session && <WorkoutCard s={session} />}
      {food.missing && <div className="section"><div className="section-title">تغذیه امروز</div>
        <div className="card glass-lite" style={{ marginBottom: 0 }}><p className="subhead secondary" style={{ margin: 0 }}>{NUTRITION_SETUP}</p></div></div>}
      {hasFood && <Food food={food} setFood={setFood} today={today} />}
      {hasSups && <Supplements food={food} setFood={setFood} today={today} now={now} workedOut={data?.workedOut} />}
    </>}
  </Page>
}

function Header({ today }) {
  return <header className="big-title with-action">
    <div className="grow"><div className="caption">{DAY_NAMES[new Date(today + 'T12:00:00').getDay()]} {fmtJ(today, false)}</div>
      <h1>امروز</h1></div>
    {/* «حساب» is no tab: it opens from here. */}
    <Link to="/account" className="icon-btn glass interactive" aria-label="حساب"><Icon name="person" /></Link>
  </header>
}

/* ---------- the workout ---------- */

function WorkoutCard({ s }) {
  const nav = useNavigate()
  const r = s.r
  return <div className="section">
    <div className="section-title">تمرین امروز</div>
    <section className={'card hero today-workout' + (s.rest ? ' rest' : '')} aria-label={s.title}>
      <div className="hstack between">
        <div><div className="caption kicker">{s.kicker}</div><h2 className="title">{s.title}</h2></div>
        {s.done && <span className="pill on-hero"><Icon name="check" />انجام شد</span>}
      </div>
      <div className="footnote" style={{ margin: '0.25rem 0 1rem' }}>{fa(r.items.length)} حرکت · حدود {fa(minutes(r))} دقیقه</div>
      <div className="group hero-list">{r.items.map((it, i) => <div key={i} className="row" style={{ '--sep-inset': '5.25rem' }}>
        <Thumb id={it.exercise_id} />
        <div className="content"><ExName id={it.exercise_id} /><div className="sub">{fmtTarget(it)}</div></div>
      </div>)}</div>
      <div className="hero-actions">
        <button className="btn glass interactive hero-start" onClick={() => nav('/log/' + r.id)}>{startLabel(r, s.done)}</button>
      </div>
    </section>
  </div>
}

/* ---------- food ---------- */

const BARS = [['protein', 'پروتئین', 'گرم'], ['calories', 'کالری', ''], ['carbs', 'کربوهیدرات', 'گرم']]

function Food({ food, setFood, today }) {
  const toast = useToast()
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const p = macroProgress(food.targets, food.mealLogs)
  const logOf = id => food.mealLogs.find(l => l.meal_id === id)
  // A tick shows at once; if the database says no, it is taken back.
  const tick = async meal => {
    const had = logOf(meal.id)
    if (had) {
      setFood(f => ({ ...f, mealLogs: f.mealLogs.filter(l => l !== had) }))
      const { error } = await supabase.from('meal_logs').delete().eq('id', had.id)
      if (error) { setFood(f => ({ ...f, mealLogs: [...f.mealLogs, had] })); toast(errorText(error), 'error') }
      return
    }
    const row = mealLog(meal, scope.student, today)
    const temp = { ...row, id: 'tmp-' + meal.id }
    setFood(f => ({ ...f, mealLogs: [...f.mealLogs, temp] })); haptic(8)
    const { data, error } = await supabase.from('meal_logs').insert(row).select().single()
    setFood(f => ({ ...f, mealLogs: f.mealLogs.filter(l => l !== temp).concat(error ? [] : [data]) }))
    if (error) toast(errorText(error), 'error')
  }
  const removeQuick = async l => {
    setFood(f => ({ ...f, mealLogs: f.mealLogs.filter(x => x !== l) }))
    const { error } = await supabase.from('meal_logs').delete().eq('id', l.id)
    if (error) { setFood(f => ({ ...f, mealLogs: [...f.mealLogs, l] })); toast(errorText(error), 'error') }
  }
  const quick = food.mealLogs.filter(l => !l.meal_id)
  return <div className="section">
    <div className="section-head">
      <div className="section-title">تغذیه امروز</div>
      <button className="btn glass interactive small" onClick={() => setAdding(true)}><Icon name="add" />افزودن سریع</button>
    </div>
    {food.targets && <div className="card glass-lite macros">
      {BARS.map(([k, label, unit]) => <div key={k} className={'macro' + (p[k].over ? ' over' : '')}>
        <div className="macro-top">
          <span className="title-text">{label}</span>
          <span className="tnum"><b>{fa(p[k].eaten)}</b> از {fa(p[k].target)}{unit && ` ${unit}`}</span>
        </div>
        <div className="macro-track" role="progressbar" aria-label={label} aria-valuenow={p[k].eaten} aria-valuemax={p[k].target}><span style={{ width: `${p[k].share * 100}%` }} /></div>
        <div className="caption tnum">{p[k].over ? `${fa(p[k].eaten - p[k].target)}${unit && ` ${unit}`} بیشتر از هدف` : `مانده ${fa(p[k].left)}${unit && ` ${unit}`}`}</div>
      </div>)}
      <div className="caption tnum fat-line">چربی: {fa(p.fat.eaten)} از {fa(p.fat.target)} گرم · مانده {fa(p.fat.left)}</div>
    </div>}
    {(food.meals.length > 0 || quick.length > 0) && <div className="group glass-lite">
      {food.meals.map(m => { const done = !!logOf(m.id), isOpen = open === m.id
        return <div key={m.id} className={'meal' + (done ? ' done' : '')}>
          <div className="row">
            <button className={'tick pressable' + (done ? ' on' : '')} onClick={() => tick(m)} aria-pressed={done} aria-label={`${m.name} خورده شد`}>{done && <Icon name="check" />}</button>
            <button className="content meal-open" onClick={() => setOpen(isOpen ? null : m.id)} aria-expanded={isOpen}>
              <div className="title-text">{m.name}{m.time && <span className="caption tnum"> · {faDigits(m.time)}</span>}</div>
              <div className="sub tnum">{fa(Math.round(m.protein))} گرم پروتئین · {fa(Math.round(m.calories))} کالری</div>
            </button>
            <Icon name={isOpen ? 'expand_less' : 'expand_more'} style={{ color: 'var(--label-3)' }} />
          </div>
          {isOpen && <ul className="meal-items">{m.items.map(it => <li key={it.id}>
            <span>{it.name}{it.amount && <span className="caption"> · {it.amount}</span>}</span>
            <span className="caption tnum">{fa(Math.round(it.protein))} پ · {fa(Math.round(it.calories))} ک</span>
          </li>)}{!m.items.length && <li className="caption">قلمی ثبت نشده</li>}</ul>}
        </div> })}
      {quick.map(l => <div key={l.id} className="row meal done">
        <div className="tick on" aria-hidden="true"><Icon name="bolt" /></div>
        <div className="content"><div className="title-text">{l.name || 'افزودن سریع'}</div>
          <div className="sub tnum">{fa(Math.round(l.protein))} گرم پروتئین · {fa(Math.round(l.calories))} کالری · {fa(Math.round(l.carbs))} گرم کربو</div></div>
        <button className="icon-btn bare" onClick={() => removeQuick(l)} aria-label="حذف"><Icon name="close" /></button>
      </div>)}
    </div>}
    {adding && <QuickAdd today={today} onClose={() => setAdding(false)} onAdded={row => setFood(f => ({ ...f, mealLogs: [...f.mealLogs, row] }))} />}
  </div>
}

// Something eaten outside the plan: a name if you like, and its numbers.
function QuickAdd({ today, onClose, onAdded }) {
  return <Sheet title="افزودن سریع" onClose={onClose}><QuickBody today={today} onAdded={onAdded} /></Sheet>
}
function QuickBody({ today, onAdded }) {
  const { close } = useSheet()
  const toast = useToast()
  const [v, setV] = useState({ name: '', protein: '', calories: '', carbs: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, x) => setV(o => ({ ...o, [k]: x }))
  const nums = { protein: toNumber(v.protein), calories: toNumber(v.calories), carbs: toNumber(v.carbs) }
  const ok = Object.values(nums).some(n => n > 0) && Object.values(nums).every(n => n == null || n >= 0)
  const save = async e => {
    e.preventDefault()
    if (!ok) return toast('دست‌کم یکی از عددها را بنویس.', 'warning')
    setBusy(true)
    const row = { student_id: scope.student, date: today, name: v.name.trim(), protein: nums.protein ?? 0, calories: nums.calories ?? 0, carbs: nums.carbs ?? 0, fat: 0 }
    const { data, error } = await supabase.from('meal_logs').insert(row).select().single()
    setBusy(false)
    if (error) return toast(errorText(error), 'error')
    onAdded(data); haptic(8); close()
  }
  return <form onSubmit={save}>
    <div className="field"><label htmlFor="qn">نام (اختیاری)</label><input id="qn" className="input" value={v.name} onChange={e => set('name', e.target.value)} maxLength={80} placeholder="مثلاً یک موز" /></div>
    <div className="inline-fields three">
      {[['protein', 'پروتئین (گرم)'], ['calories', 'کالری'], ['carbs', 'کربو (گرم)']].map(([k, l]) =>
        <div key={k} className="field"><label htmlFor={'q' + k}>{l}</label>
          <input id={'q' + k} className="input num" inputMode="decimal" value={v[k]} onChange={e => set(k, e.target.value)} placeholder="۰" /></div>)}
    </div>
    <button className="btn glass interactive prominent block" disabled={busy || !ok}><Icon name="add" />افزودن</button>
  </form>
}

/* ---------- supplements ---------- */

function Supplements({ food, setFood, today, now, workedOut }) {
  const toast = useToast()
  const mins = now.getHours() * 60 + now.getMinutes()
  const doses = useMemo(() => dosesOf(food.supplements, food.supLogs, mins, workedOut), [food, mins, workedOut])
  const tick = async d => {
    const had = food.supLogs.find(l => `${l.supplement_id}|${l.time}` === d.key)
    if (had) {
      setFood(f => ({ ...f, supLogs: f.supLogs.filter(l => l !== had) }))
      const { error } = await supabase.from('supplement_logs').delete().eq('id', had.id)
      if (error) { setFood(f => ({ ...f, supLogs: [...f.supLogs, had] })); toast(errorText(error), 'error') }
      return
    }
    const row = { student_id: scope.student, date: today, supplement_id: d.supplement.id, name: d.supplement.name, time: d.time }
    const temp = { ...row, id: 'tmp-' + d.key }
    setFood(f => ({ ...f, supLogs: [...f.supLogs, temp] })); haptic(8)
    const { data, error } = await supabase.from('supplement_logs').insert(row).select().single()
    setFood(f => ({ ...f, supLogs: f.supLogs.filter(l => l !== temp).concat(error ? [] : [data]) }))
    if (error) toast(errorText(error), 'error')
  }
  return <div className="section">
    <div className="section-head">
      <div className="section-title">مکمل‌ها</div>
      <Reminders doses={doses} />
    </div>
    <div className="group glass-lite">{doses.map(d => <button key={d.key} className={'row pressable dose' + (d.taken ? ' done' : d.due ? ' due' : '')}
      onClick={() => tick(d)} aria-pressed={d.taken}>
      <span className={'tick' + (d.taken ? ' on' : '')}>{d.taken && <Icon name="check" />}</span>
      <div className="content"><div className="title-text"><bdi>{d.supplement.name}</bdi>{d.supplement.dose && <span className="caption"> · <bdi>{d.supplement.dose}</bdi></span>}</div>
        <div className="sub tnum">{d.time ? faDigits(d.time) : 'روزانه'}{d.due && <span className="due-tag"> · وقتش است</span>}</div></div>
    </button>)}</div>
  </div>
}

// Reminders for the doses still to come today, while the app is open: only where the browser
// can show notifications and the athlete has allowed it. No server push in this version; where
// notifications are not supported (some iPhones), the due dose simply stands out on the page.
const REMIND = 'remind:supplements'
const canNotify = () => typeof window !== 'undefined' && 'Notification' in window
function Reminders({ doses }) {
  const toast = useToast()
  const [on, setOn] = useState(() => { try { return canNotify() && Notification.permission === 'granted' && localStorage.getItem(REMIND) === '1' } catch { return false } })
  const timers = useRef([])
  useEffect(() => {
    timers.current.forEach(clearTimeout); timers.current = []
    if (!on) return
    for (const r of reminders(doses)) {
      const wait = r.at - Date.now()
      if (wait > 0 && wait < 864e5) timers.current.push(setTimeout(() => notify(r), wait))
    }
    return () => timers.current.forEach(clearTimeout)
  }, [on, doses])
  if (!canNotify()) return null
  const toggle = async () => {
    if (on) { setOn(false); try { localStorage.removeItem(REMIND) } catch { /* nothing kept */ } return }
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (perm !== 'granted') return toast('اجازه‌ی اعلان داده نشد؛ نوبت‌ها فقط داخل اپ برجسته می‌شوند.', 'warning')
    setOn(true); try { localStorage.setItem(REMIND, '1') } catch { /* private mode: for this visit only */ }
    toast('تا وقتی اپ باز است، سر وقت یادت می‌اندازد', 'success')
  }
  return <button className={'btn small pressable ' + (on ? 'glass interactive' : 'plain')} onClick={toggle} aria-pressed={on}>
    <Icon name={on ? 'notifications_active' : 'notifications'} />{on ? 'یادآور روشن' : 'یادآور'}</button>
}
async function notify(r) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg?.showNotification) return reg.showNotification(r.title, { body: r.body, tag: r.key, lang: 'fa', dir: 'rtl' })
    new Notification(r.title, { body: r.body, tag: r.key, lang: 'fa', dir: 'rtl' })
  } catch { /* the page still shows the dose as due */ }
}
