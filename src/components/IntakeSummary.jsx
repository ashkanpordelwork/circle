import Icon from './Icon.jsx'
import { profile } from '../lib/intake.js'
import { fmtDate, fmtNum } from '../lib/plan.js'

const faN = n => Number(n).toLocaleString('fa-IR')
const Quote = ({ children }) => children ? <div className="quote">«{children}»</div> : null

// The questionnaire, read back in order of importance: safety first, then the body, goal,
// background and diet. The coach reads it on the student's «پرونده» tab, the student on «پرسشنامه من».
export default function IntakeSummary({ intake, own = false }) {
  const p = profile(intake.answers)
  return <>
    <div className="caption profile-stamp">آخرین به‌روزرسانی: {fmtDate(intake.completed_at.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}</div>

    {p.alerts.length ? <section className="card alert-card" aria-label="نکات ایمنی">
      <div className="card-head"><div className="tile-icon red"><Icon name="warning" filled /></div>
        <div className="grow"><div className="headline">نکات ایمنی</div>
          <div className="caption">{own ? 'مربی برنامه را با توجه به این‌ها می‌نویسد' : 'قبل از نوشتن برنامه بخوانید'}</div></div></div>
      {p.alerts.map(x => <div key={x.kind} className="alert-item">
        <div className="alert-title">{x.title}</div>
        {x.items.length > 0 && <div className="hstack wrap">{x.items.map(l => <span key={l} className="pill bad">{l}</span>)}</div>}
        <Quote>{x.note}</Quote>
      </div>)}
      {p.conditionsNote && <div className="alert-item"><div className="alert-title">داروها و توضیحات</div><Quote>{p.conditionsNote}</Quote></div>}
    </section>
      : <div className="group glass-lite section"><div className="row with-leading">
        <div className="tile-icon"><Icon name="check" /></div>
        <div className="content"><div className="title-text">{own ? 'آسیب یا بیماری خاصی گزارش نکرده‌ای' : 'آسیب یا بیماری خاصی گزارش نکرده'}</div>
          {p.conditionsNote && <div className="sub">«{p.conditionsNote}»</div>}</div>
      </div></div>}

    <div className="section-title">بدن</div>
    <div className="stats">
      <div className="stat glass-lite"><div className="v">{p.age ? faN(p.age) : '—'}</div><div className="l">سال{p.sex ? ' · ' + p.sex : ''}</div></div>
      <div className="stat glass-lite"><div className="v">{p.height ? faN(p.height) : '—'}</div><div className="l">قد (سانتی‌متر)</div></div>
      <div className="stat glass-lite"><div className="v">{p.weight ? fmtNum(p.weight) : '—'}</div><div className="l">وزن هنگام شروع (کیلو)</div></div>
      <div className="stat glass-lite"><div className="v">{p.bmi ? fmtNum(p.bmi.value) : '—'}</div>
        <div className="l">BMI {p.bmi && <span className={'pill ' + (p.bmi.ok ? 'ok' : '')}>{p.bmi.band}</span>}</div></div>
    </div>

    <section className="card glass-lite" aria-label="هدف">
      <div className="card-head"><div className="tile-icon"><Icon name="flag" /></div><div className="headline">هدف</div></div>
      <div className="hstack wrap">{p.goals.map(g => <span key={g} className="pill ok">{g}</span>)}</div>
      <Quote>{p.goalsNote}</Quote>
    </section>

    <section className="card glass-lite" aria-label="سابقه تمرین">
      <div className="card-head"><div className="tile-icon blue"><Icon name="fitness_center" /></div><div className="headline">سابقه تمرین</div></div>
      <div className="kv"><span>تجربه</span><b>{p.experience || '—'}</b></div>
      <div className="kv"><span>زمان در دسترس</span><b>{p.days ? `${faN(p.days)} روز در هفته` : '—'}</b></div>
      <Quote>{p.experienceNote}</Quote>
    </section>

    <section className="card glass-lite" aria-label="تغذیه">
      <div className="card-head"><div className="tile-icon orange"><Icon name="restaurant" /></div><div className="headline">محدودیت غذایی</div></div>
      {p.diet.length ? <div className="hstack wrap">{p.diet.map(d => <span key={d} className="pill">{d}</span>)}</div>
        : <div className="subhead secondary">{own ? 'محدودیتی نداری' : 'محدودیتی ندارد'}</div>}
      <Quote>{p.dietNote}</Quote>
    </section>
  </>
}
