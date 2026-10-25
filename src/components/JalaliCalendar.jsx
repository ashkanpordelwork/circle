import { useState } from 'react'
import { J_MONTHS, isoToJ, monthGrid } from '../lib/jalali.js'
import { DAY_NAMES, WEEK, todayISO } from '../lib/plan.js'
import Icon from './Icon.jsx'

const fa = n => Number(n).toLocaleString('fa-IR', { useGrouping: false })

// A month of the Persian calendar, Saturday first. Tapping a day picks it; [value…rangeEnd] is
// shown as the span the choice covers (a program's weeks).
export default function JalaliCalendar({ value, rangeEnd, onChange }) {
  const [jy0, jm0] = isoToJ(value || todayISO())
  const [ym, setYm] = useState([jy0, jm0])
  const [jy, jm] = ym
  const step = d => setYm(([y, m]) => { const t = (y * 12 + m - 1) + d; return [Math.floor(t / 12), (t % 12) + 1] })
  const today = todayISO()
  return <div className="jcal">
    <div className="jcal-head">
      <button type="button" className="icon-btn glass interactive" onClick={() => step(-1)} aria-label="ماه قبل"><Icon name="chevron_right" /></button>
      <div className="headline">{J_MONTHS[jm - 1]} {fa(jy)}</div>
      <button type="button" className="icon-btn glass interactive" onClick={() => step(1)} aria-label="ماه بعد"><Icon name="chevron_left" /></button>
    </div>
    <div className="jcal-grid" role="grid" aria-label={`${J_MONTHS[jm - 1]} ${fa(jy)}`}>
      {/* The usual initials of a Persian calendar: seven full names do not fit seven narrow columns. */}
      {WEEK.map((d, k) => <div key={d} className="jcal-wd" title={DAY_NAMES[d]} aria-label={DAY_NAMES[d]}>{'شیدسچپج'[k]}</div>)}
      {monthGrid(jy, jm).map((iso, k) => !iso ? <span key={k} /> :
        <button key={iso} type="button" role="gridcell" aria-selected={iso === value}
          className={'jcal-day' + (iso === value ? ' on' : '') + (value && rangeEnd && iso > value && iso <= rangeEnd ? ' in' : '') + (iso === rangeEnd ? ' end' : '') + (iso === today ? ' today' : '')}
          onClick={() => onChange(iso)}>{fa(isoToJ(iso)[2])}</button>)}
    </div>
  </div>
}
