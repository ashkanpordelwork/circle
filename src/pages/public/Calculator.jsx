import { useState } from 'react'
import { GOALS, ACTIVITY, checkInput, dailyNeeds } from '../../lib/calculator.js'
import { toNumber } from '../../lib/plan.js'
import { Page, Segmented } from '../../components/ui.jsx'
import { useTitle } from './Exercises.jsx'

// «محاسبه‌گر نیاز روزانه»: open to anyone (SPEC §3.8). The working-out is in lib/calculator.js.

const fa = n => Number(n).toLocaleString('fa-IR')
const opts = o => Object.entries(o).map(([value, label]) => ({ value, label }))

export default function Calculator() {
  useTitle('محاسبه‌گر نیاز روزانه')
  const [f, setF] = useState({ sex: 'male', birthYear: '', height: '', weight: '', goal: 'health', activity: 'mid', days: '3' })
  const [shown, setShown] = useState(false)
  const set = k => v => { setF(s => ({ ...s, [k]: v })); setShown(false) }
  const input = { ...f, birthYear: toNumber(f.birthYear), height: toNumber(f.height), weight: toNumber(f.weight), days: Number(f.days) }
  const errors = checkInput(input)
  const result = shown && !errors.length ? dailyNeeds(input) : null

  const num = (k, label, unit, placeholder) => <div className="field">
    <label htmlFor={k}>{label}</label>
    <div className="hstack">
      <input id={k} className="input grow tnum" inputMode="numeric" placeholder={placeholder} value={f[k]} onChange={e => set(k)(e.target.value)} />
      {unit && <span className="caption">{unit}</span>}
    </div>
  </div>

  return <Page>
    <header className="big-title"><div className="caption">کالری و پروتئین روزانه</div><h1>محاسبه‌گر</h1></header>
    <section className="card glass-lite calc">
      <div className="field"><label>جنسیت</label>
        <Segmented label="جنسیت" value={f.sex} onChange={set('sex')} options={[{ value: 'male', label: 'مرد' }, { value: 'female', label: 'زن' }]} /></div>
      {num('birthYear', 'سال تولد', null, '۱۳۷۵')}
      <div className="hstack calc-pair">{num('height', 'قد', 'سانتی‌متر', '۱۷۵')}{num('weight', 'وزن', 'کیلو', '۷۰')}</div>
      <div className="field"><label>هدفت</label>
        <Segmented label="هدف" value={f.goal} onChange={set('goal')} options={opts(GOALS)} /></div>
      <div className="field"><label>فعالیت روزانه، بیرون از تمرین</label>
        <Segmented label="فعالیت روزانه" value={f.activity} onChange={set('activity')} options={opts(ACTIVITY)} /></div>
      <div className="field"><label>روزهای تمرین در هفته</label>
        <Segmented label="روزهای تمرین" value={f.days} onChange={set('days')}
          options={[{ value: '3', label: '۳ یا کمتر' }, { value: '4', label: '۴' }, { value: '5', label: '۵' }]} /></div>
      {shown && errors.length > 0 && <ul className="calc-errors" role="alert">{errors.map(e => <li key={e}>{e}</li>)}</ul>}
      <button className="btn glass interactive prominent block mt" onClick={() => setShown(true)}>حساب کن</button>
    </section>

    {result && <section className="card glass-lite calc-result" aria-live="polite">
      <div className="calc-big"><span className="tnum">{fa(result.calories)}</span><span className="caption">کالری در روز</span></div>
      <div className="calc-big small"><span className="tnum">{fa(result.protein)}</span><span className="caption">گرم پروتئین در روز</span></div>
      <p className="footnote">این یک برآورد است. بدن هر کس کمی فرق دارد؛ دو هفته امتحانش کن و با وزنت تنظیمش کن.</p>
      <p className="subhead">یک برنامه غذایی ایرانی که دقیقاً به این عدد برسی؟ برنامه غذایی اختصاصی به‌زودی اینجاست.</p>
    </section>}
  </Page>
}
