import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { routinesForDay, DAY_NAMES, WEEK, fmtTarget, faDigits } from '../../lib/plan.js'
import { exerciseName } from '../../lib/exercises.js'
import { Page, Loading, Empty, useToast, errorText } from '../../components/ui.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import ExerciseInfo, { Thumb } from '../../components/ExerciseInfo.jsx'
import { loadPlan } from './data.js'

export default function Week() {
  const nav = useNavigate()
  const toast = useToast()
  const [plan, setPlan] = useState(null)
  const [info, setInfo] = useState(null)
  useEffect(() => { loadPlan().then(setPlan).catch(e => { toast(errorText(e), 'error'); setPlan([]) }) }, [])
  const today = new Date().getDay()
  return <Page title="برنامه هفته">
    {!plan ? <Loading /> : !plan.length ? <Empty icon="calendar_month" title="هنوز برنامه‌ای نداری">وقتی مربی برنامه را بفرستد، روزهای هفته اینجا پر می‌شود.</Empty>
      : WEEK.map(d => {
        const rs = routinesForDay(plan, d)
        return <div key={d} className="section">
          <div className="section-title" style={d === today ? { color: 'var(--accent)', fontWeight: 700 } : null}>{DAY_NAMES[d]}{d === today ? ' · امروز' : ''}</div>
          {!rs.length ? <div className="group glass-lite"><div className="row with-leading"><div className="tile-icon gray"><Icon name="bedtime" /></div>
            <div className="content"><div className="title-text secondary">استراحت</div></div></div></div>
            : rs.map(r => <div key={r.id} className="group glass-lite" style={{ marginBottom: '0.5rem' }}>
              <div className="row with-leading">
                <div className="tile-icon"><Icon name="fitness_center" /></div>
                <div className="content"><div className="title-text">{r.name}</div><div className="sub">{r.items.length.toLocaleString('fa-IR')} حرکت</div></div>
                <button className="btn glass interactive prominent small" onClick={() => nav('/log/' + r.id)}>شروع</button>
              </div>
              {r.items.map((it, i) => <button key={i} className="row pressable" style={{ '--sep-inset': '5.25rem' }} onClick={() => setInfo(it.exercise_id)}>
                <Thumb id={it.exercise_id} />
                <div className="content"><div className="title-text latin ellipsis" style={{ textAlign: 'right' }}>{exerciseName(it.exercise_id)}</div>
                  <div className="sub">{fmtTarget(it)}{it.rest_sec !== '' ? ` · استراحت ${faDigits(it.rest_sec)} ثانیه` : ''}</div>
                  {it.note && <div className="sub">{it.note}</div>}</div>
                <Disclosure />
              </button>)}
            </div>)}
        </div>
      })}
    {info && <ExerciseInfo id={info} onClose={() => setInfo(null)} />}
  </Page>
}
