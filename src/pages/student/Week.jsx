import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { routinesForDay, DAY_NAMES, WEEK, fmtTarget, faDigits, todayISO } from '../../lib/plan.js'
import { pickPrograms, weekOf, weekRange, weekLabel, sessionLabel, programEnd } from '../../lib/program.js'
import { fmtRange } from '../../lib/jalali.js'
import { Page, Loading, Empty, useToast, errorText } from '../../components/ui.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import ExerciseInfo, { Thumb, ExName } from '../../components/ExerciseInfo.jsx'
import { loadStudentPlan } from './data.js'

const fa = n => Number(n).toLocaleString('fa-IR')

// One session with its exercises; tapping an exercise shows how it is done.
function SessionCard({ r, title, onInfo }) {
  const nav = useNavigate()
  return <div className="group glass-lite" style={{ marginBottom: '1rem' }}>
    <div className="row with-leading">
      <div className="tile-icon"><Icon name="fitness_center" /></div>
      <div className="content"><div className="title-text">{title}</div><div className="sub">{fa(r.items.length)} حرکت</div></div>
      <button className="btn glass interactive prominent small" onClick={() => nav('/log/' + r.id)}>شروع</button>
    </div>
    {r.items.map((it, i) => <button key={i} className="row pressable" style={{ '--sep-inset': '5.25rem' }} onClick={() => onInfo(it.exercise_id)}>
      <Thumb id={it.exercise_id} />
      <div className="content"><ExName id={it.exercise_id} />
        <div className="sub">{fmtTarget(it)}{it.rest_sec !== '' ? ` · استراحت ${faDigits(it.rest_sec)} ثانیه` : ''}</div>
        {it.note && <div className="sub">{it.note}</div>}</div>
      <Disclosure />
    </button>)}
  </div>
}

// The program week by week: this week first, the others a tap away.
function ProgramWeeks({ programs, sessions, onInfo }) {
  const today = todayISO()
  const { current, next } = pickPrograms(programs, today)
  const p = current || next || programs.at(-1)
  const cur = weekOf(p, today)
  const [week, setWeek] = useState(cur || 1)
  const [a, b] = weekRange(p, week)
  const list = sessions.filter(s => s.program_id === p.id && s.week === week).sort((x, y) => x.session - y.session)
  return <>
    <div className="caption" style={{ padding: '0 0.25rem 0.5rem' }}>برنامه {fmtRange(p.start_date, programEnd(p))}</div>
    <div className="week-tabs" role="tablist">{Array.from({ length: p.weeks }, (_, k) => k + 1).map(n =>
      <button key={n} role="tab" aria-selected={n === week} className={'week-tab pressable' + (n === week ? ' on' : '') + (n === cur ? ' now' : '')} onClick={() => setWeek(n)}>
        <span className="t">{weekLabel(n)}</span><span className="f">{n === cur ? 'این هفته' : n < (cur || 0) ? 'گذشته' : ''}</span>
      </button>)}</div>
    <div className="section-title">{fmtRange(a, b)}</div>
    {!list.length ? <Empty icon="hourglass_top" title="هنوز نوشته نشده">مربی جلسه‌های این هفته را هنوز ننوشته.</Empty>
      : list.map(r => <SessionCard key={r.id} r={r} title={sessionLabel(r.session)} onInfo={onInfo} />)}
  </>
}

export default function Week() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [info, setInfo] = useState(null)
  useEffect(() => { loadStudentPlan().then(setData).catch(e => { toast(errorText(e), 'error'); setData({ programs: [], sessions: [], weekdays: [] }) }) }, [])
  const today = new Date().getDay()
  return <Page>
    {!data ? <Loading /> : data.programs.length ? <ProgramWeeks programs={data.programs} sessions={data.sessions} onInfo={setInfo} />
      : !data.weekdays.length ? <Empty icon="calendar_month" title="هنوز برنامه‌ای نداری">وقتی مربی برنامه را بفرستد، اینجا می‌بینی.</Empty>
        : WEEK.map(d => {
          const rs = routinesForDay(data.weekdays, d)
          return <div key={d} className="section">
            <div className="section-title" style={d === today ? { color: 'var(--accent)', fontWeight: 700 } : null}>{DAY_NAMES[d]}{d === today ? ' · امروز' : ''}</div>
            {!rs.length ? <div className="group glass-lite"><div className="row with-leading"><div className="tile-icon gray"><Icon name="bedtime" /></div>
              <div className="content"><div className="title-text secondary">استراحت</div></div></div></div>
              : rs.map(r => <SessionCard key={r.id} r={r} title={r.name} onInfo={setInfo} />)}
          </div>
        })}
    {info && <ExerciseInfo id={info} onClose={() => setInfo(null)} />}
  </Page>
}
