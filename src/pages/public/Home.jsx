import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadExercises } from '../../lib/exercises.js'
import { Page } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import Logo from '../../components/Logo.jsx'
import { Thumb } from '../../components/ExerciseInfo.jsx'
import { useTitle } from './Exercises.jsx'

// The front door for someone not signed in: what Circle gives, and the ways in (SPEC §3.1).
// The sections and their order move to the dashboard later (SPEC §5.5).

// A few everyday lifts to show the library at a glance.
const SHOWCASE = ['0043', '0025', '0027', '0334']

export default function PublicHome() {
  useTitle('سلامت بدن، تغذیه و خواب')
  const nav = useNavigate()
  const [count, setCount] = useState(null)
  useEffect(() => { loadExercises().then(l => setCount(l.length)) }, [])
  return <Page>
    <header className="big-title with-action">
      <div className="grow"><div className="caption">بدن، تغذیه، خواب</div><h1 className="latin brand">Circle</h1></div>
      <Link to="/login" className="btn glass interactive small">ورود</Link>
    </header>

    <section className="card glass-lite home-hero">
      <div className="mark app"><Logo size="2rem" /></div>
      <div className="title-lg">برنامه تمرین یک‌ماهه، رایگان</div>
      <p className="subhead secondary">چند سؤال کوتاه جواب بده؛ برنامه‌ای می‌گیری که با بدن، هدف و وقتت جور است. هر جلسه وزنه‌ی بعدی را هم پیشنهاد می‌دهد.</p>
      <button className="btn glass interactive prominent block" onClick={() => nav('/login?signup=1')}>شروع رایگان</button>
    </section>

    <Link to="/exercises" className="card glass-lite home-link pressable">
      <div className="grow">
        <div className="headline">حرکات</div>
        <div className="sub">{count ? `${count.toLocaleString('fa-IR')} حرکت` : 'حرکت‌ها'}، با عکس و انیمیشن و روش اجرا.</div>
        <div className="home-thumbs">{SHOWCASE.map(id => <Thumb key={id} id={id} />)}</div>
      </div>
      <Icon name="chevron_left" />
    </Link>

    <Link to="/calculator" className="card glass-lite home-link pressable">
      <div className="tile-icon lime"><Icon name="calculate" /></div>
      <div className="grow">
        <div className="headline">نیاز روزانه‌ات چقدر است؟</div>
        <div className="sub">کالری و پروتئین روزانه، بر اساس بدن و هدفت.</div>
      </div>
      <Icon name="chevron_left" />
    </Link>
  </Page>
}
