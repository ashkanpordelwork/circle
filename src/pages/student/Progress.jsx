import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { fmtDate, fmtNum, todayISO, faDigits, summarize, setText, kg } from '../../lib/plan.js'
import { addDays, fmtJ, isoToJ } from '../../lib/jalali.js'
import { loadExercises, exerciseById, exerciseName, MUSCLES } from '../../lib/exercises.js'
import { streakWeeks } from '../../lib/home.js'
import { PERIODS, insights, thisMonth, weightChange, activityGrid, muscleBalance, exerciseSeries, trainedExercises } from '../../lib/stats.js'
import { END_REASONS } from '../../lib/session.js'
import { ExName } from '../../components/ExerciseInfo.jsx'
import { Page, Loading, Empty, Segmented, useToast, errorText } from '../../components/ui.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import LineChart from '../../components/LineChart.jsx'
import BodyMap from '../../components/BodyMap.jsx'
import WeightChart from '../../components/WeightChart.jsx'
import Screen from '../../components/Screen.jsx'
import Sheet, { useSheet } from '../../components/Sheet.jsx'
import { scope } from '../../lib/scope.js'
import { motivation, mainLifts, proteinAdherence } from '../../lib/progress.js'
import { missingMigration } from '../../lib/nutrition.js'
import { on } from '../../lib/features.js'
import { useMe } from '../../App.jsx'
import WorkoutComments from '../../components/WorkoutComments.jsx'

// «پیشرفت»: one sentence from the athlete's own week, the one-rep max of the main lifts over
// time, how often protein was hit, and the recent workouts (lib/progress.js). The detailed
// statistics — period insights, activity map, muscle balance, weight, any lift — are kept below,
// behind the detailedStats flag (lib/features.js).

const fa = n => Number(n).toLocaleString('fa-IR')
const END_LABEL = Object.fromEntries(END_REASONS)
const WEEK_LETTERS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
const WEIGHT_RANGES = [['30', '۱ ماه'], ['90', '۳ ماه'], ['365', '۱ سال'], ['all', 'همه']]

export default function Progress() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const today = todayISO()
  useEffect(() => {
    (async () => {
      try {
        await loadExercises()
        // '*' so the page also works before migration 0007 (no duration or end reason yet).
        const [workouts, weights, food] = await Promise.all([
          must(supabase.from('workouts').select('*').eq('student_id', scope.student).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(500)),
          must(supabase.from('body_weights').select('*').eq('student_id', scope.student).order('date').limit(400)),
          loadProtein(today)])
        const sets = workouts.length ? await must(supabase.from('workout_sets').select('*').in('workout_id', workouts.map(w => w.id))) : []
        setData({ workouts, weights, sets, food })
      } catch (e) { toast(errorText(e), 'error'); setData({ workouts: [], weights: [], sets: [], food: null }) }
    })()
  }, [])
  if (!data) return <Page><Loading /></Page>
  const { workouts, weights, sets, food } = data
  const line = motivation(workouts, sets, today, exerciseName)
  const lifts = mainLifts(workouts, sets, 3)
  const protein = food ? proteinAdherence(food.logs, food.target, today, 7) : null

  return <Page>
    <header className="big-title"><div className="caption">تمرین‌ها و رکوردها</div><h1>پیشرفت</h1></header>

    {/* One sentence from the athlete's own week. */}
    <section className={'card glass-lite motivation ' + line.kind}>
      <div className="tile-icon lime"><Icon name={line.kind === 'record' ? 'emoji_events' : line.kind === 'volume' ? 'trending_up' : line.kind === 'streak' ? 'local_fire_department' : 'fitness_center'} filled /></div>
      <p className="headline">{line.text}</p>
    </section>

    {lifts.length > 0 && <div className="section">
      <div className="section-title">یک‌تکرار تخمینی حرکت‌های اصلی</div>
      <div className="stack">{lifts.map(l => <div key={l.exercise_id} className="card glass-lite lift" style={{ marginBottom: 0 }}>
        <div className="hstack between" style={{ alignItems: 'flex-start' }}>
          <div className="grow"><ExName id={l.exercise_id} /></div>
          <div className="tnum lift-best">{faDigits(l.best.e1rm)}<span className="caption"> کیلو</span></div>
        </div>
        {l.points.length > 1 ? <LineChart points={l.points.map(p => ({ y: p.e1rm }))} unit="کیلو" label={`یک‌تکرار تخمینی ${exerciseName(l.exercise_id)} در ${l.points.length} جلسه`} />
          : <div className="footnote mt">نمودار از جلسه‌ی دوم شروع می‌شود.</div>}
        <div className="footnote">{l.change ? `${faDigits(Math.abs(l.change))} کیلو ${l.change > 0 ? 'بیشتر' : 'کمتر'} از جلسه‌ی اول · ` : ''}بهترین ست: <bdi className="nowrap">{faDigits(l.best.w)} کیلو × {faDigits(l.best.r)}</bdi> · <bdi className="nowrap">{fmtJ(l.best.date, false)}</bdi></div>
      </div>)}</div>
      <div className="section-footer">از ست‌های با ۱۲ تکرار یا کمتر، با فرمول Epley.</div>
    </div>}

    {protein && <div className="section">
      <div className="section-title">رعایت تغذیه</div>
      <div className="card glass-lite" style={{ marginBottom: 0 }}>
        <div className="hstack between">
          <div><div className="headline">هدف پروتئین</div><div className="footnote">{fa(protein.hit)} روز از {fa(protein.of)} روز اخیر به هدف رسیدی.</div></div>
          <div className="tnum title-lg">{fa(Math.round(protein.share * 100))}٪</div>
        </div>
        {/* Day by day, oldest to today (right to left, the way the page reads). */}
        <div className="week-dots" aria-hidden="true">{protein.days.map(d => <span key={d.date} className={d.hit ? 'on' : ''} title={fmtJ(d.date, false)} />)}</div>
      </div>
    </div>}

    {!workouts.length && <Empty icon="monitoring" title="هنوز تمرینی ثبت نکرده‌ای">بعد از اولین تمرین، پیشرفتت اینجا می‌آید.</Empty>}
    {workouts.length > 0 && <Recent workouts={workouts} sets={sets} />}

    {/* The detailed statistics: kept, and hidden (lib/features.js). */}
    {on('detailedStats') && <>
      <Overview workouts={workouts} weights={weights} today={today} />
      {on('body') && <div className="section"><div className="group glass-lite">
        <Link to="/body" className="row pressable with-leading">
          <div className="tile-icon lime"><Icon name="favorite" /></div>
          <div className="content"><div className="title-text">پیشرفت و بازیابی</div><div className="sub">آمادگی، اندازه‌های بدن و عکس‌ها؛ فقط خودت می‌بینی</div></div>
          <Disclosure />
        </Link>
      </div></div>}
      {workouts.length > 0 && <>
        <Insights workouts={workouts} sets={sets} today={today} />
        <Activity workouts={workouts} sets={sets} today={today} />
        <Balance workouts={workouts} sets={sets} today={today} />
      </>}
      <BodyWeight weights={weights} today={today} />
      {sets.length > 0 && <ExerciseProgress workouts={workouts} sets={sets} />}
    </>}
  </Page>
}

// The protein target and the last week of meals; null when there is no target, or before 0011.
async function loadProtein(today) {
  const [t, logs] = await Promise.all([
    supabase.from('nutrition_targets').select('protein').eq('student_id', scope.student).maybeSingle(),
    supabase.from('meal_logs').select('date, protein').eq('student_id', scope.student).gte('date', addDays(today, -6))])
  const err = t.error || logs.error
  if (err) { if (missingMigration(err)) return null; throw err }
  return t.data ? { target: t.data.protein, logs: logs.data } : null
}

function Overview({ workouts, weights, today }) {
  const dates = [...new Set(workouts.map(w => w.date))]
  const change = weightChange(weights, today)
  return <div className="section">
    <div className="section-title">نمای کلی</div>
    <div className="stats" style={{ marginBottom: 0 }}>
      <div className="stat glass-lite"><div className="l"><Icon name="fitness_center" />تمرین‌ها</div><div className="v">{fa(workouts.length)}</div></div>
      <div className="stat glass-lite"><div className="l"><Icon name="calendar_month" />این ماه</div><div className="v">{fa(thisMonth(workouts, today))}</div></div>
      <div className="stat glass-lite"><div className="l"><Icon name="local_fire_department" />پیوستگی</div><div className="v">{fa(streakWeeks(dates, today))} <span className="of">هفته</span></div></div>
      <div className="stat glass-lite"><div className="l"><Icon name="monitor_weight" />وزن در ۳۰ روز</div>
        {/* In words, not a sign: a minus jumps to the wrong side of a number in Persian text. */}
        <div className="v">{change == null ? '—' : change === 0 ? <>بدون <span className="of">تغییر</span></> : <>{faDigits(Math.abs(change))} <span className="of">کیلو {change < 0 ? 'کمتر' : 'بیشتر'}</span></>}</div></div>
    </div>
  </div>
}

function Insights({ workouts, sets, today }) {
  const [period, setPeriod] = useState('30')
  const x = useMemo(() => insights(workouts, sets, period, today), [period])
  return <div className="section">
    <div className="section-title">بینش تمرین</div>
    <Segmented label="بازه" value={period} onChange={setPeriod} options={PERIODS.map(([value, label]) => ({ value, label }))} />
    <div className="stats" style={{ marginBottom: 0 }}>
      <div className="stat glass-lite"><div className="l">جلسه</div><div className="v">{fa(x.sessions)}</div></div>
      <div className="stat glass-lite"><div className="l">زمان تمرین</div><div className="v">{x.minutes ? <>{fa(x.minutes)} <span className="of">دقیقه</span></> : '—'}</div></div>
      <div className="stat glass-lite"><div className="l">ست کامل</div><div className="v">{fa(x.sets)}</div></div>
      <div className="stat glass-lite"><div className="l">حجم</div><div className="v">{fa(x.volume)} <span className="of">کیلو</span></div></div>
    </div>
    <div className="section-footer">
      {fa(x.reps)} تکرار{x.avgMinutes ? ` · میانگین هر جلسه ${fa(x.avgMinutes)} دقیقه` : ''}{x.endedEarly ? ` · ${fa(x.endedEarly)} جلسه زودتر تمام شد` : ''}
    </div>
  </div>
}

// Fifteen weeks, Saturday to Friday down, oldest week on the right (it reads right to left).
function Activity({ workouts, sets, today }) {
  const grid = useMemo(() => activityGrid(workouts, sets, today, 15), [])
  // A month's name over the first week that starts in it; never two names side by side.
  const months = grid.map((col, i) => {
    const m = isoToJ(col[0].date)[1]
    return i > 0 && m !== isoToJ(grid[i - 1][0].date)[1] && i < grid.length - 1 ? fmtJ(col[0].date, false).split(' ')[1] : ''
  })
  return <div className="section">
    <div className="section-title">فعالیت</div>
    <div className="card glass-lite" style={{ marginBottom: 0 }}>
      <div className="footnote" style={{ marginBottom: '0.75rem' }}>پانزده هفته‌ی اخیر · بر اساس ست‌های انجام‌شده</div>
      <div className="heat">
        <div className="heat-days"><span />{WEEK_LETTERS.map((l, i) => <span key={i}>{i % 2 ? '' : l}</span>)}</div>
        <div className="heat-grid">{grid.map((col, c) => <div key={c} className="heat-col">
          <span className="heat-month">{months[c]}</span>
          {col.map(d => <span key={d.date} className={'cell l' + d.level + (d.future ? ' future' : '') + (d.date === today ? ' today' : '')}
            title={`${fmtJ(d.date, false)}: ${d.sets ? fa(d.sets) + ' ست' : 'بدون تمرین'}`} />)}
        </div>)}</div>
      </div>
      <div className="heat-legend caption"><span>کمتر</span>{[1, 2, 3, 4].map(l => <span key={l} className={'cell l' + l} />)}<span>بیشتر</span></div>
    </div>
  </div>
}

function Balance({ workouts, sets, today }) {
  const [period, setPeriod] = useState('30')
  const rows = useMemo(() => muscleBalance(workouts, sets, period, today, id => exerciseById(id)?.m), [period])
  const top = Math.max(1, ...rows.map(r => r.sets))
  const missing = Object.keys(MUSCLES).filter(m => !rows.some(r => r.muscle === m))
  return <div className="section">
    <div className="section-title">تعادل عضلات</div>
    <Segmented label="بازه" value={period} onChange={setPeriod} options={PERIODS.map(([value, label]) => ({ value, label }))} />
    <div className="card glass-lite" style={{ marginBottom: 0 }}>
      {!rows.length ? <div className="subhead secondary">در این بازه تمرینی نیست.</div>
        : <><BodyMap counts={Object.fromEntries(rows.map(r => [r.muscle, r.sets]))} />
        <div className="balance">{rows.map(r => <div key={r.muscle} className="balance-row">
          <span className="name">{MUSCLES[r.muscle] || r.muscle}</span>
          <span className="track"><span style={{ width: `${(r.sets / top) * 100}%` }} /></span>
          <span className="n tnum">{fa(r.sets)} ست</span>
        </div>)}</div></>}
      {missing.length > 0 && rows.length > 0 && <>
        <div className="caption" style={{ margin: '1rem 0 0.5rem' }}>در این بازه تمرین نشده</div>
        <div className="hstack wrap" style={{ gap: '0.5rem' }}>{missing.map(m => <span key={m} className="pill">{MUSCLES[m]}</span>)}</div>
      </>}
    </div>
    <div className="section-footer">هر ست برای عضله‌های اصلی حرکتش حساب می‌شود.</div>
  </div>
}

function BodyWeight({ weights, today }) {
  const [range, setRange] = useState('90')
  const [all, setAll] = useState(false)
  const shown = range === 'all' ? weights : weights.filter(w => w.date >= addDays(today, -(Number(range) - 1)))
  const last = weights.at(-1)
  return <div className="section">
    <div className="section-title">وزن بدن</div>
    <div className="card glass-lite" style={{ marginBottom: 0 }}>
      <div className="hstack between">
        <div><div className="caption">{last ? `آخرین ثبت · ${fmtJ(last.date, false)}` : 'هنوز ثبت نشده'}</div>
          {last && <div className="title-lg tnum">{fmtNum(last.weight)} <span className="subhead secondary">کیلو</span></div>}</div>
      </div>
      {weights.length > 1 && <Segmented label="بازه‌ی وزن" value={range} onChange={setRange} options={WEIGHT_RANGES.map(([value, label]) => ({ value, label }))} />}
      {shown.length > 1 ? <WeightChart points={shown} /> : <div className="subhead secondary">{weights.length ? 'برای نمودار، در این بازه دست‌کم دو ثبت لازم است.' : 'وزنت را از «امروز» ثبت کن تا روندش اینجا بیاید.'}</div>}
    </div>
    {weights.length > 1 && <button className="btn plain small pressable" style={{ marginTop: '0.5rem' }} onClick={() => setAll(true)}>همه ثبت‌ها ({fa(weights.length)})</button>}
    {all && <Screen title="همه ثبت‌های وزن" onClose={() => setAll(false)}>
      <div className="group glass-lite">{[...weights].reverse().map(b => <div key={b.id || b.date} className="row">
        <div className="content">{fmtJ(b.date)}</div><div className="tnum" style={{ fontWeight: 600 }}>{fmtNum(b.weight)} کیلو</div>
      </div>)}</div>
    </Screen>}
  </div>
}

// One exercise over time: its estimated one-rep max, and the heaviest set of each session.
function ExerciseProgress({ workouts, sets }) {
  const ids = useMemo(() => trainedExercises(sets), [])
  const [ex, setEx] = useState(ids[0])
  const [picking, setPicking] = useState(false)
  const series = useMemo(() => exerciseSeries(workouts, sets, ex), [ex])
  const e1 = series.filter(p => p.e1rm != null)
  const best = e1.reduce((b, p) => (!b || p.e1rm > b.e1rm ? p : b), null)
  const heaviest = series.reduce((b, p) => Math.max(b, p.best), 0)
  return <div className="section">
    <div className="section-title">پیشرفت حرکت‌ها</div>
    <div className="group glass-lite" style={{ marginBottom: '0.75rem' }}>
      <button className="row pressable with-leading" onClick={() => setPicking(true)}>
        <div className="tile-icon"><Icon name="fitness_center" /></div>
        <div className="content"><ExName id={ex} /></div><Disclosure />
      </button>
    </div>
    <div className="card glass-lite" style={{ marginBottom: 0 }}>
      <div className="hstack between">
        <div><div className="caption">بهترین 1RM تخمینی</div>
          <div className="title-lg tnum">{best ? <>{faDigits(best.e1rm)} <span className="subhead secondary">کیلو</span></> : '—'}</div></div>
        {heaviest > 0 && <span className="pill ok"><Icon name="emoji_events" />سنگین‌ترین ست {kg(heaviest)}</span>}
      </div>
      {e1.length > 1 ? <LineChart points={e1.map(p => ({ y: p.e1rm }))} unit="کیلو" label={`1RM تخمینی ${exerciseName(ex)} در ${e1.length} جلسه`} />
        : <div className="subhead secondary mt">{e1.length ? 'نمودار از جلسه‌ی دوم شروع می‌شود.' : 'این حرکت ست وزنه‌دار با ۱۲ تکرار یا کمتر ندارد.'}</div>}
      {best && <div className="footnote mt">از {faDigits(best.w)} کیلو × {faDigits(best.r)} تکرار، {fmtJ(best.date, false)}</div>}
    </div>
    {picking && <Sheet title="کدام حرکت؟" onClose={() => setPicking(false)}><PickExercise ids={ids} value={ex} onPick={setEx} /></Sheet>}
  </div>
}
function PickExercise({ ids, value, onPick }) {
  const { close } = useSheet()
  return <div className="group glass-lite">{ids.map(id => <button key={id} className={'row pressable choice' + (id === value ? ' on' : '')} onClick={() => { onPick(id); close() }} role="radio" aria-checked={id === value}>
    <span className={'tick' + (id === value ? ' on' : '')}>{id === value && <Icon name="check" />}</span>
    <div className="content"><ExName id={id} /></div>
  </button>)}</div>
}

// The workouts themselves: the last five, the rest a tap away.
function Recent({ workouts, sets }) {
  const [all, setAll] = useState(false)
  return <div className="section">
    <div className="section-title">آخرین تمرین‌ها</div>
    <WorkoutList workouts={workouts.slice(0, 5)} sets={sets} />
    {workouts.length > 5 && <button className="btn plain small pressable" style={{ marginTop: '0.5rem' }} onClick={() => setAll(true)}>همه‌ی تمرین‌ها ({fa(workouts.length)})</button>}
    {all && <Screen title="همه‌ی تمرین‌ها" subtitle={`${fa(workouts.length)} تمرین`} onClose={() => setAll(false)}><WorkoutList workouts={workouts} sets={sets} /></Screen>}
  </div>
}
function WorkoutList({ workouts, sets }) {
  const me = useMe()
  const [open, setOpen] = useState(null)
  return <div className="group glass-lite">{workouts.map(w => {
    const mine = sets.filter(s => s.workout_id === w.id)
    const sum = summarize(mine)
    const isOpen = open === w.id
    const vol = Math.round(mine.reduce((v, s) => v + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0))
    return <div key={w.id}>
      <button className="row with-leading pressable" onClick={() => setOpen(isOpen ? null : w.id)} aria-expanded={isOpen}>
        <div className="tile-icon"><Icon name="check" /></div>
        <div className="content"><div className="title-text">{w.routine_name || 'تمرین'}</div>
          <div className="sub">{fmtDate(w.date)} · {fa(mine.length)} ست{w.duration_sec ? ` · ${fa(Math.max(1, Math.round(w.duration_sec / 60)))} دقیقه` : ''}{vol ? ` · ${fa(vol)} کیلو` : ''}</div>
          {w.end_reason && <div className="sub" style={{ color: 'var(--orange)' }}>زودتر تمام شد: {END_LABEL[w.end_reason]}</div>}</div>
        <Icon name={isOpen ? 'expand_less' : 'expand_more'} style={{ color: 'var(--label-3)' }} />
      </button>
      {isOpen && <div style={{ padding: '0 1rem 0.75rem', paddingInlineStart: '4.25rem' }}>
        {[...sum.keys()].map(id => <div key={id} style={{ padding: '0.5rem 0' }}>
          <ExName id={id} className="subhead" style={{ fontWeight: 600 }} />
          <div className="footnote tnum">{mine.filter(s => s.exercise_id === id).sort((a, b) => a.set_index - b.set_index).map(setText).join('   ·   ')}</div>
        </div>)}
        {w.note && <div className="footnote" style={{ paddingTop: '0.5rem' }}><Icon name="sticky_note_2" style={{ fontSize: '1rem', verticalAlign: 'middle' }} /> {w.note}</div>}
        {me.student.coach_id && <WorkoutComments workoutId={w.id} me={me.session.user.id} otherName="مربی" />}
      </div>}
    </div>
  })}</div>
}
