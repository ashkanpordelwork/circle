import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { todayISO, toNumber, fmtNum, faDigits } from '../../lib/plan.js'
import { pickPrograms, studentWeek, sessionLabel, weekLabel } from '../../lib/program.js'
import { addDays, fmtJ, fmtRange, isoToJ } from '../../lib/jalali.js'
import { weekDays, streakWeeks, weeklyCounts, volumeOf, nextOwn, weekStartOf } from '../../lib/home.js'
import { DAY_NAMES, routinesForDay } from '../../lib/plan.js'
import { Page, Loading, useToast, errorText, haptic } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { WeightField } from '../../components/Wheel.jsx'
import { useMe } from '../../App.jsx'
import { loadStudentPlan } from './data.js'
import { startLabel, minutes, SessionScreen } from './plan-parts.jsx'
import { scope } from '../../lib/scope.js'
import { on } from '../../lib/features.js'

// «امروز»: what to do next, how the week is going, and the two habits worth a tap a day —
// body weight and water. The coach's whole plan lives under «روتین»; this is the front page.

const fa = n => Number(n).toLocaleString('fa-IR')
const WEEK_LETTERS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
const WATER = [[250, 'لیوان', '۲۵۰ میلی'], [500, 'شیکر', '۰٫۵ لیتر'], [1000, 'بطری', '۱ لیتر']]

// The session to do next: the coach's (program or today's weekday plan) first, else the
// athlete's own routine trained longest ago.
function upNext(data, today) {
  if (data.programs.length) {
    const { current } = pickPrograms(data.programs, today)
    if (current) {
      const w = studentWeek(current, data.sessions, data.doneIds, today)
      if (w.next) return { r: w.next, kicker: `${weekLabel(w.week)} · برنامه‌ی مربی`, title: sessionLabel(w.next.session) }
    }
  } else if (data.weekdays.length) {
    const r = routinesForDay(data.weekdays, new Date().getDay()).find(x => !data.doneToday.has(x.id))
    if (r) return { r, kicker: 'برنامه‌ی امروز مربی', title: r.name }
  }
  const own = nextOwn(data.mine, data.lastDone)
  return own ? { r: own, kicker: 'روتین بعدی تو', title: own.name } : null
}

export default function Today() {
  const me = useMe()
  const nav = useNavigate()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(null)
  const today = todayISO()
  useEffect(() => {
    (async () => {
      try {
        const since = addDays(weekStartOf(today), -7 * 9)
        const [plan, ws, weights, water] = await Promise.all([loadStudentPlan(),
          must(supabase.from('workouts').select('id, routine_id, date').eq('student_id', scope.student).gte('date', since).order('date')),
          must(supabase.from('body_weights').select('date, weight').eq('student_id', scope.student).order('date', { ascending: false }).limit(2)),
          // Before migration 0008 there is no water table: the card simply starts at zero.
          supabase.from('water_logs').select('ml').eq('student_id', scope.student).eq('date', today).maybeSingle().then(r => r.data?.ml ?? 0)])
        const thisWeek = ws.filter(w => w.date >= weekStartOf(today))
        const sets = thisWeek.length ? await must(supabase.from('workout_sets').select('weight, reps').in('workout_id', thisWeek.map(w => w.id))) : []
        const lastDone = {}
        for (const w of ws) if (w.routine_id) lastDone[w.routine_id] = w.date
        setData({ ...plan, ws, sets, weights, water, lastDone,
          doneIds: new Set(ws.map(w => w.routine_id)), doneToday: new Set(ws.filter(w => w.date === today).map(w => w.routine_id)) })
      } catch (e) { toast(errorText(e), 'error'); setData(false) }
    })()
  }, [])
  if (data === null) return <Page><Loading /></Page>
  if (!data) return <Page><Header today={today} /></Page>

  const dates = [...new Set(data.ws.map(w => w.date))]
  const week = weekDays(today, dates)
  const weekCount = data.ws.filter(w => w.date >= weekStartOf(today)).length
  const next = upNext(data, today)
  const counts = weeklyCounts(dates, today, 8)
  const top = Math.max(3, ...counts.map(c => c.count))

  return <Page>
    <Header today={today} />

    {me.student.note?.trim() && <div className="card glass-lite">
      <div className="card-head"><div className="tile-icon orange"><Icon name="sticky_note_2" filled /></div><div className="headline">از طرف مربی</div></div>
      <div className="subhead" style={{ whiteSpace: 'pre-wrap' }}>{me.student.note}</div>
    </div>}

    {on('intake') && me.student.coach_id && !me.intake?.completed_at && !me.intake?.skipped && <Link to="/intake/edit" className="alert-strip invite pressable">
      <Icon name="assignment" /><div className="grow"><div className="title-text">پرسشنامه برای مربی</div><div className="sub">هدف، آسیب‌ها و تغذیه؛ مربی با آن برنامه‌ات را می‌نویسد</div></div><Icon name="chevron_left" />
    </Link>}

    <div className="section">
      <div className="section-title">بعدی</div>
      {next ? <div className="up-next card hero">
        <button className="up-next-main pressable" onClick={() => setOpen(next.r)}>
          <div className="caption kicker">{next.kicker}</div>
          <h2 className="title">{next.title}</h2>
          <div className="footnote">{fa(next.r.items.length)} حرکت · حدود {fa(minutes(next.r))} دقیقه</div>
        </button>
        <button className="play pressable" onClick={() => nav('/log/' + next.r.id)} aria-label={startLabel(next.r, false)}><Icon name="play_arrow" filled /></button>
      </div> : <div className="card glass-lite">
        <div className="headline">اولین روتینت را بساز</div>
        <p className="subhead secondary">یکی از روتین‌های آماده را بردار، یا همین حالا بدون برنامه شروع کن و حرکت‌ها را حین تمرین اضافه کن.</p>
        <div className="hstack">
          <button className="btn glass interactive prominent grow" onClick={() => nav('/routines')}><Icon name="list_alt" />روتین‌ها</button>
          <button className="btn glass interactive grow" onClick={() => document.dispatchEvent(new Event('start-workout'))}><Icon name="bolt" />تمرین فوری</button>
        </div>
      </div>}
    </div>

    <div className="section">
      <div className="section-title">این هفته</div>
      <div className="card glass-lite" style={{ marginBottom: '0.75rem' }}>
        <div className="hstack between" style={{ marginBottom: '1rem' }}>
          <div><div className="headline">{fmtRange(week[0].date, week[6].date)}</div>
            <div className="footnote">{weekCount ? `${fa(weekCount)} جلسه انجام شد` : 'هنوز جلسه‌ای در این هفته نیست'}</div></div>
        </div>
        <div className="week-strip">{week.map((d, i) => <div key={d.date} className={'wday' + (d.today ? ' today' : '') + (d.trained ? ' trained' : '') + (d.future ? ' future' : '')}>
          <span className="l">{WEEK_LETTERS[i]}</span><span className="n">{fa(isoToJ(d.date)[2])}</span>
          <span className="m">{d.trained && <Icon name="check" />}</span>
        </div>)}</div>
      </div>
      <div className="stats" style={{ marginBottom: '0.75rem' }}>
        <div className="stat glass-lite"><div className="l"><Icon name="local_fire_department" />پیوستگی</div><div className="v">{fa(streakWeeks(dates, today))} <span className="of">هفته</span></div></div>
        <div className="stat glass-lite"><div className="l"><Icon name="fitness_center" />حجم این هفته</div><div className="v">{fa(volumeOf(data.sets))} <span className="of">کیلو</span></div></div>
      </div>
      <div className="card glass-lite" style={{ marginBottom: 0 }}>
        <div className="headline">جلسه در هفته</div>
        <div className="footnote">هشت هفته‌ی اخیر</div>
        <div className="bars" role="img" aria-label={`جلسه‌ها در هشت هفته‌ی اخیر: ${counts.map(c => c.count).join('، ')}`}>
          {counts.map((c, i) => <div key={c.start} className={'bar' + (i === counts.length - 1 ? ' now' : '')}>
            <span className="v">{c.count ? fa(c.count) : ''}</span>
            <span className="b" style={{ height: `${(c.count / top) * 100}%` }} />
            <span className="d">{fa(isoToJ(c.start)[2])}</span>
          </div>)}
        </div>
      </div>
    </div>

    <div className="section">
      <div className="section-title">بدن و عادت‌ها</div>
      <WeightCard weights={data.weights} onSaved={w => setData(d => ({ ...d, weights: [{ date: today, weight: w }, ...d.weights.filter(x => x.date !== today)] }))} />
      {on('water') && <WaterCard ml={data.water} onChange={ml => setData(d => ({ ...d, water: ml }))} />}
    </div>

    <div className="section">
      <div className="section-title">کتابخانه</div>
      <div className="stats">
        <Link to="/routines" className="stat glass-lite pressable"><div className="l"><Icon name="list_alt" />روتین‌های من</div><div className="v">{fa(data.mine.length)}</div></Link>
        <Link to="/stats" className="stat glass-lite pressable"><div className="l"><Icon name="history" />تمرین در ۹ هفته</div><div className="v">{fa(data.ws.length)}</div></Link>
      </div>
    </div>

    {open && <SessionScreen r={open} done={false} onClose={() => setOpen(null)} />}
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

function WeightCard({ weights, onSaved }) {
  const toast = useToast()
  const [w, setW] = useState('')
  const last = weights[0]
  const save = async () => {
    const v = toNumber(w)
    if (!(v >= 20 && v <= 400)) return toast('یک وزن معتبر وارد کن.', 'warning')
    try {
      await must(supabase.from('body_weights').upsert({ student_id: scope.student, date: todayISO(), weight: v }, { onConflict: 'student_id,date' }))
      setW(''); onSaved(v); toast('وزن امروز ثبت شد', 'success')
    } catch (e) { toast(errorText(e), 'error') }
  }
  const delta = weights.length > 1 ? Number(weights[0].weight) - Number(weights[1].weight) : null
  return <div className="card glass-lite" style={{ marginBottom: '0.75rem' }}>
    <div className="hstack between">
      <div><div className="headline">وزن بدن</div>
        <div className="footnote">{last ? fmtJ(last.date, false) : 'هنوز ثبت نشده'}</div></div>
      {last && <div className="tnum title-lg">{fmtNum(last.weight)} <span className="subhead secondary">کیلو</span>
        {delta ? <span className={'pill' + (delta < 0 ? ' ok' : '')} style={{ marginInlineStart: '0.5rem' }}><Icon name={delta > 0 ? 'trending_up' : 'trending_down'} />{fmtNum(Math.abs(delta))}</span> : null}</div>}
    </div>
    <div className="hstack mt">
      <WeightField value={w} onChange={setW} title="وزن امروز" fine min={30} max={250} hint={last?.weight} hintLabel="آخرین وزن"
        placeholder="وزن امروز (کیلو)" ariaLabel="وزن امروز به کیلو" className="grow" />
      <button className="btn glass interactive prominent" disabled={w === ''} onClick={save}><Icon name="add" />ثبت</button>
    </div>
  </div>
}

// Water: three taps for three sizes; the last one taken back with ↺.
function WaterCard({ ml, onChange }) {
  const toast = useToast()
  const [last, setLast] = useState([])
  const put = async (next, undo) => {
    const prev = ml
    onChange(next)
    const { error } = await supabase.from('water_logs').upsert({ student_id: scope.student, date: todayISO(), ml: next }, { onConflict: 'student_id,date' })
    if (error) { onChange(prev); return toast(/water_logs/.test(error.message) ? 'ثبت آب هنوز فعال نشده.' : errorText(error), 'error') }
    if (!undo) haptic(8)
  }
  return <div className="card glass-lite" style={{ marginBottom: 0 }}>
    <div className="hstack between">
      <div className="hstack"><div className="tile-icon blue"><Icon name="water_drop" /></div><div className="headline">آب</div></div>
      <button className="icon-btn bare" disabled={!last.length} onClick={() => { const a = last[last.length - 1]; setLast(l => l.slice(0, -1)); put(Math.max(0, ml - a), true) }} aria-label="برداشتن آخرین ثبت"><Icon name="undo" /></button>
    </div>
    <div className="water-total tnum">{faDigits(Math.round(ml / 100) / 10)} <span className="subhead secondary">لیتر امروز</span></div>
    <div className="water-buttons">{WATER.map(([amount, name, label]) =>
      <button key={amount} className="water-btn pressable" onClick={() => { setLast(l => [...l, amount]); put(Math.min(20000, ml + amount)) }}>
        <span className="a">+ {label}</span><span className="caption">{name}</span>
      </button>)}</div>
  </div>
}
