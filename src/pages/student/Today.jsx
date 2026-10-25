import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { routinesForDay, DAY_NAMES, WEEK, todayISO, fmtTarget } from '../../lib/plan.js'
import { pickPrograms, studentWeek, weekLabel, sessionLabel, programEnd } from '../../lib/program.js'
import { fmtJ, addDays } from '../../lib/jalali.js'
import { Page, Loading, Empty, useToast, errorText } from '../../components/ui.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import { Thumb, ExName } from '../../components/ExerciseInfo.jsx'
import { useMe } from '../../App.jsx'
import { loadStudentPlan, sessionTitle } from './data.js'
import { scope } from '../../lib/scope.js'

const fa = n => Number(n).toLocaleString('fa-IR')
const minutes = r => Math.max(15, Math.round(r.items.reduce((m, i) => m + i.sets * 2.2, 0)))

// A session to do: its exercises and the start button.
function SessionHero({ r, kicker, done }) {
  const nav = useNavigate()
  return <section className="card hero" aria-label={sessionTitle(r)}>
    <div className="hstack between">
      <div><div className="caption kicker">{kicker}</div><h2 className="title">{r.program_id ? sessionLabel(r.session) : r.name}</h2></div>
      {done && <span className="pill on-hero"><Icon name="check" />انجام شد</span>}
    </div>
    <div className="footnote" style={{ margin: '0.25rem 0 1rem' }}>{fa(r.items.length)} حرکت · حدود {fa(minutes(r))} دقیقه</div>
    <div className="group hero-list">
      {r.items.map((it, i) => <div key={i} className="row" style={{ '--sep-inset': '5.25rem' }}>
        <Thumb id={it.exercise_id} />
        <div className="content"><ExName id={it.exercise_id} /><div className="sub">{fmtTarget(it)}</div></div>
      </div>)}
    </div>
    <div className="hero-actions">
      <button className="btn glass interactive hero-start" onClick={() => nav('/log/' + r.id)}>{done ? 'ثبت دوباره' : 'شروع تمرین'}</button>
      <button className="hero-go pressable" aria-hidden="true" tabIndex={-1} onClick={() => nav('/log/' + r.id)}><Icon name="arrow_outward" mirror /></button>
    </div>
  </section>
}

// A monthly program: this week's sessions in order; the next one up front.
function ProgramToday({ programs, sessions, doneIds }) {
  const nav = useNavigate()
  const today = todayISO()
  const { current, next } = pickPrograms(programs, today)
  if (!current) return next
    ? <Empty icon="calendar_month" title="برنامه جدیدت در راه است">از {fmtJ(next.start_date)} شروع می‌شود.</Empty>
    : <Empty icon="hourglass_top" title="برنامه‌ات تمام شد">مربی برنامه بعدی را می‌نویسد؛ به محض آماده شدن همین‌جا می‌بینی.</Empty>
  const w = studentWeek(current, sessions, doneIds, today)
  const doneCount = w.list.filter(s => s.done).length
  return <>
    <div className="week-head">
      <div><div className="caption kicker">{weekLabel(w.week)} از {fa(current.weeks)}</div>
        <div className="headline">{w.list.length ? `${fa(doneCount)} از ${fa(w.list.length)} جلسه این هفته` : 'این هفته هنوز جلسه‌ای ندارد'}</div></div>
      {w.list.length > 0 && <div className="pips big" aria-hidden="true">{w.list.map(s => <span key={s.id} className={s.done ? 'done' : s === w.next ? 'today' : ''} />)}</div>}
    </div>
    {!w.list.length ? <Empty icon="hourglass_top" title="جلسه‌های این هفته در راه است">مربی هنوز جلسه‌های این هفته را ننوشته.</Empty>
      : w.next ? <SessionHero r={w.next} kicker="جلسه بعدی" />
        : <div className="card glass-lite">
          <div className="card-head"><div className="tile-icon"><Icon name="check" /></div>
            <div><div className="headline">همه جلسه‌های این هفته انجام شد</div>
              <div className="footnote">{w.end >= programEnd(current) ? 'این آخرین هفته برنامه بود.' : `هفته بعد از ${fmtJ(addDays(w.end, 1), false)} شروع می‌شود.`}</div></div></div>
        </div>}
    {w.list.length > 1 && <div className="section">
      <div className="section-title">جلسه‌های این هفته</div>
      <div className="group glass-lite">{w.list.map(s => <button key={s.id} className="row pressable with-leading" onClick={() => nav('/log/' + s.id)}>
        <div className={'tile-icon num' + (s.done ? '' : ' gray')}>{s.done ? <Icon name="check" /> : fa(s.session)}</div>
        <div className="content"><div className="title-text">{sessionLabel(s.session)}</div><div className="sub">{s.done ? 'انجام شد' : `${fa(s.items.length)} حرکت · حدود ${fa(minutes(s))} دقیقه`}</div></div>
        <Disclosure />
      </button>)}</div>
      <div className="section-footer">جلسه‌ها را به ترتیب و در هر روزی که برایت مناسب است انجام بده.</div>
    </div>}
  </>
}

// A weekday plan from before monthly programs.
function WeekdayToday({ plan, doneToday }) {
  const nav = useNavigate()
  const today = new Date().getDay()
  const todays = routinesForDay(plan, today)
  const next = !todays.length ? WEEK.map((_, k) => (today + k + 1) % 7).find(d => routinesForDay(plan, d).length) : undefined
  if (!plan.length) return <Empty icon="hourglass_top" title="برنامه‌ات در راه است">مربی هنوز برنامه را نفرستاده. به محض آماده شدن همین‌جا می‌بینی.</Empty>
  if (!todays.length) return <div className="card glass-lite">
    <div className="card-head"><div className="tile-icon blue"><Icon name="bedtime" filled /></div>
      <div><div className="headline">امروز روز استراحت است</div>
        {next !== undefined && <div className="footnote">تمرین بعدی: {DAY_NAMES[next]} — {routinesForDay(plan, next).map(r => r.name).join(' + ')}</div>}</div></div>
    <button className="btn glass interactive block" onClick={() => nav('/week')}><Icon name="calendar_month" />برنامه هفتگی</button>
  </div>
  return todays.map(r => <SessionHero key={r.id} r={r} kicker="تمرین امروز" done={doneToday.has(r.id)} />)
}

export default function Today() {
  const me = useMe()
  const toast = useToast()
  const [data, setData] = useState(null)
  useEffect(() => {
    (async () => {
      try {
        const [plan, ws] = await Promise.all([loadStudentPlan(),
          must(supabase.from('workouts').select('routine_id, date').eq('student_id', scope.student).gte('date', addDays(todayISO(), -120)))])
        setData({ ...plan, doneIds: new Set(ws.map(w => w.routine_id)), doneToday: new Set(ws.filter(w => w.date === todayISO()).map(w => w.routine_id)) })
      } catch (e) { toast(errorText(e), 'error'); setData({ programs: [], sessions: [], weekdays: [], doneIds: new Set(), doneToday: new Set() }) }
    })()
  }, [])
  if (!data) return <Page><Loading /></Page>
  return <Page>
    {me.student.note?.trim() && <div className="card glass-lite">
      <div className="card-head"><div className="tile-icon orange"><Icon name="sticky_note_2" filled /></div><div className="headline">از طرف مربی</div></div>
      <div className="subhead" style={{ whiteSpace: 'pre-wrap' }}>{me.student.note}</div>
    </div>}
    {data.programs.length ? <ProgramToday programs={data.programs} sessions={data.sessions} doneIds={data.doneIds} />
      : <WeekdayToday plan={data.weekdays} doneToday={data.doneToday} />}
  </Page>
}
