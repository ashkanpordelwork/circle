import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { routinesForDay, DAY_NAMES, WEEK, todayISO, fmtTarget, faDigits } from '../../lib/plan.js'
import { pickPrograms, studentWeek, weekOf, weekRange, weekLabel, sessionLabel, programEnd } from '../../lib/program.js'
import { fmtJ, fmtRange, addDays } from '../../lib/jalali.js'
import { Page, Loading, Empty, useToast, errorText } from '../../components/ui.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import ExerciseInfo, { Thumb, ExName } from '../../components/ExerciseInfo.jsx'
import Screen from '../../components/Screen.jsx'
import { useMe } from '../../App.jsx'
import { loadStudentPlan, sessionTitle } from './data.js'
import { scope } from '../../lib/scope.js'
import { readDraft } from '../../lib/session.js'

// «امروز» is the student's whole plan: the session to do now on top, and under it every week of
// the program, a tap away. (It used to be split over «امروز» and «برنامه», showing this week twice.)

const fa = n => Number(n).toLocaleString('fa-IR')
// A session left half done on this device continues where it stopped (lib/session.js).
const startLabel = (r, done) => (readDraft(localStorage, r.id) ? 'ادامه‌ی تمرین' : done ? 'ثبت دوباره' : 'شروع تمرین')
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
      <button className="btn glass interactive hero-start" onClick={() => nav('/log/' + r.id)}>{startLabel(r, done)}</button>
    </div>
  </section>
}

// Any session, opened from the plan: what it holds, how each move is done, and the start button.
function SessionScreen({ r, done, onClose }) {
  const nav = useNavigate()
  const [info, setInfo] = useState(null)
  return <Screen title={sessionTitle(r)} subtitle={`${fa(r.items.length)} حرکت · حدود ${fa(minutes(r))} دقیقه`} onClose={onClose}>
    <div className="section">
      <div className="group glass-lite">{r.items.map((it, i) => <button key={i} className="row pressable" style={{ '--sep-inset': '5.25rem' }} onClick={() => setInfo(it.exercise_id)}>
        <Thumb id={it.exercise_id} />
        <div className="content"><ExName id={it.exercise_id} />
          <div className="sub">{fmtTarget(it)}{it.rest_sec !== '' ? ` · استراحت ${faDigits(it.rest_sec)} ثانیه` : ''}</div>
          {it.note && <div className="sub">{it.note}</div>}</div>
        <Disclosure />
      </button>)}</div>
      <div className="section-footer">برای دیدن طرز اجرای هر حرکت، رویش بزن.</div>
    </div>
    <div className="page-end">
      <button className="btn glass interactive prominent block" onClick={() => nav('/log/' + r.id)}>{startLabel(r, done)}</button>
    </div>
    {info && <ExerciseInfo id={info} onClose={() => setInfo(null)} />}
  </Screen>
}

// One row of the plan: done, or its number in the week.
function SessionRow({ r, mark, title, done, when, onOpen }) {
  return <button className="row pressable with-leading" onClick={() => onOpen(r)}>
    <div className={'tile-icon num' + (done ? '' : ' gray')}>{done ? <Icon name="check" /> : mark}</div>
    <div className="content"><div className="title-text">{title}</div>
      <div className="sub">{when && <>{when} · </>}{done ? 'انجام شد' : when ? `${fa(r.items.length)} حرکت` : `${fa(r.items.length)} حرکت · حدود ${fa(minutes(r))} دقیقه`}</div></div>
    <Disclosure />
  </button>
}

// The program week by week: this week first, the others a tap away.
function ProgramWeeks({ p, sessions, doneIds, onOpen }) {
  const today = todayISO()
  const cur = weekOf(p, today)
  const [week, setWeek] = useState(cur || 1)
  const [a, b] = weekRange(p, week)
  const list = sessions.filter(s => s.program_id === p.id && s.week === week).sort((x, y) => x.session - y.session)
  return <div className="section">
    <div className="section-title">برنامه · {fmtRange(p.start_date, programEnd(p))}</div>
    {p.weeks > 1 && <div className="week-tabs" role="tablist">{Array.from({ length: p.weeks }, (_, k) => k + 1).map(n =>
      <button key={n} role="tab" aria-selected={n === week} className={'week-tab pressable' + (n === week ? ' on' : '') + (n === cur ? ' now' : '')} onClick={() => setWeek(n)}>
        <span className="t">{weekLabel(n)}</span><span className="f">{n === cur ? 'این هفته' : n < (cur || 0) ? 'گذشته' : ''}</span>
      </button>)}</div>}
    {!list.length ? <div className="group glass-lite"><div className="row with-leading"><div className="tile-icon gray"><Icon name="hourglass_top" /></div>
      <div className="content"><div className="title-text secondary">هنوز نوشته نشده</div><div className="sub">{fmtRange(a, b)}</div></div></div></div>
      : <div className="group glass-lite">{list.map(s => <SessionRow key={s.id} r={s} mark={fa(s.session)} title={sessionLabel(s.session)} done={doneIds.has(s.id)} onOpen={onOpen} />)}</div>}
    <div className="section-footer">{fmtRange(a, b)} · جلسه‌ها را به ترتیب و در هر روزی که برایت مناسب است انجام بده.</div>
  </div>
}

// A monthly program: the next session up front, the program under it.
function ProgramToday({ programs, sessions, doneIds, onOpen }) {
  const today = todayISO()
  const { current, next } = pickPrograms(programs, today)
  const shown = current || next || programs.at(-1)
  let top
  if (!current) top = next
    ? <Empty icon="calendar_month" title="برنامه جدیدت در راه است">از {fmtJ(next.start_date)} شروع می‌شود.</Empty>
    : <Empty icon="hourglass_top" title="برنامه‌ات تمام شد">مربی برنامه بعدی را می‌نویسد؛ به محض آماده شدن همین‌جا می‌بینی.</Empty>
  else {
    const w = studentWeek(current, sessions, doneIds, today)
    const doneCount = w.list.filter(s => s.done).length
    top = <>
      <div className="week-head">
        <div><div className="caption kicker">{weekLabel(w.week)} از {fa(current.weeks)}</div>
          <div className="headline">{w.list.length ? `${fa(doneCount)} از ${fa(w.list.length)} جلسه این هفته` : 'این هفته هنوز جلسه‌ای ندارد'}</div></div>
        {w.list.length > 0 && <div className="pips big" aria-hidden="true">{w.list.map(s => <span key={s.id} className={s.done ? 'done' : s === w.next ? 'today' : ''} />)}</div>}
      </div>
      {!w.list.length ? null
        : w.next ? <SessionHero r={w.next} kicker="جلسه بعدی" />
          : <div className="card glass-lite">
            <div className="card-head" style={{ marginBottom: 0 }}><div className="tile-icon"><Icon name="check" /></div>
              <div><div className="headline">همه جلسه‌های این هفته انجام شد</div>
                <div className="footnote">{w.end >= programEnd(current) ? 'این آخرین هفته برنامه بود.' : `هفته بعد از ${fmtJ(addDays(w.end, 1), false)} شروع می‌شود.`}</div></div></div>
          </div>}
    </>
  }
  return <>{top}<ProgramWeeks key={shown.id} p={shown} sessions={sessions} doneIds={doneIds} onOpen={onOpen} /></>
}

// A weekday plan from before monthly programs: today's session, then the week day by day.
function WeekdayToday({ plan, doneToday, onOpen }) {
  const today = new Date().getDay()
  const todays = routinesForDay(plan, today)
  const next = !todays.length ? WEEK.map((_, k) => (today + k + 1) % 7).find(d => routinesForDay(plan, d).length) : undefined
  if (!plan.length) return <Empty icon="hourglass_top" title="برنامه‌ات در راه است">مربی هنوز برنامه را نفرستاده. به محض آماده شدن همین‌جا می‌بینی.</Empty>
  return <>
    {!todays.length ? <div className="card glass-lite">
      <div className="card-head" style={{ marginBottom: 0 }}><div className="tile-icon blue"><Icon name="bedtime" filled /></div>
        <div><div className="headline">امروز روز استراحت است</div>
          {next !== undefined && <div className="footnote">تمرین بعدی: {DAY_NAMES[next]} — {routinesForDay(plan, next).map(r => r.name).join(' + ')}</div>}</div></div>
    </div> : todays.map(r => <SessionHero key={r.id} r={r} kicker="تمرین امروز" done={doneToday.has(r.id)} />)}
    <div className="section">
      <div className="section-title">برنامه هفته</div>
      <div className="group glass-lite">{WEEK.flatMap(d => routinesForDay(plan, d).map(r =>
        <SessionRow key={d + r.id} r={r} mark={<Icon name="fitness_center" />} title={r.name} onOpen={onOpen}
          when={d === today ? <span style={{ color: 'var(--accent)' }}>{DAY_NAMES[d]}، امروز</span> : DAY_NAMES[d]}
          done={d === today && doneToday.has(r.id)} />))}</div>
      <div className="section-footer">روزهایی که اینجا نیستند، روز استراحت‌اند.</div>
    </div>
  </>
}

export default function Today() {
  const me = useMe()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(null)
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
    {data.programs.length ? <ProgramToday programs={data.programs} sessions={data.sessions} doneIds={data.doneIds} onOpen={setOpen} />
      : <WeekdayToday plan={data.weekdays} doneToday={data.doneToday} onOpen={setOpen} />}
    {open && <SessionScreen r={open} done={data.programs.length ? data.doneIds.has(open.id) : data.doneToday.has(open.id)} onClose={() => setOpen(null)} />}
  </Page>
}
