import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { fmtJ } from '../../lib/jalali.js'
import { FOCUS, APP_STATUS } from '../../lib/coaching.js'
import { Page, Loading, useToast, errorText } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { IntField } from '../../components/Wheel.jsx'
import { useMe } from '../../App.jsx'

// «مربی شو»: becoming a coach is asked for, not bought. The admin reads the application and
// says yes (the app turns into the coach's) or no, with a note; a «no» can be answered with a
// new application.

const fa = n => Number(n).toLocaleString('fa-IR')

export default function Apply() {
  const me = useMe()
  const toast = useToast()
  const [apps, setApps] = useState(null)
  const [f, setF] = useState({ first: '', last: '', years: '', focus: [], clients: '', credentials: '', note: '' })
  const [busy, setBusy] = useState(false)
  const load = () => supabase.from('coach_applications').select('*').order('created_at', { ascending: false })
    .then(({ data }) => setApps(data || []))
  useEffect(() => {
    load()
    const [first = '', ...rest] = (me.student?.full_name || '').trim().split(/\s+/)
    setF(x => ({ ...x, first, last: rest.join(' ') }))
  }, [])
  if (!apps) return <Page title="مربی شو" back><Loading /></Page>
  const latest = apps[0]
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const ready = f.first.trim() && f.last.trim() && f.years !== '' && f.focus.length && f.clients !== ''
  const submit = async e => {
    e.preventDefault()
    if (!ready) return toast('بخش‌های ستاره‌دار را کامل کن.', 'warning')
    setBusy(true)
    const { error } = await supabase.rpc('apply_to_coach', { p_first: f.first.trim(), p_last: f.last.trim(), p_years: Number(f.years), p_focus: f.focus,
      p_clients: Number(f.clients), p_credentials: f.credentials.trim(), p_note: f.note.trim() })
    setBusy(false)
    if (error) return toast(/already applied/.test(error.message) ? 'درخواستت در حال بررسی است.' : /apply_to_coach/.test(error.message) ? 'درخواست مربی‌گری هنوز فعال نشده.' : errorText(error), 'error')
    toast('درخواستت ثبت شد', 'success'); load()
  }

  return <Page title="مربی شو" back>
    {latest && <section className={'card glass-lite app-status ' + latest.status}>
      <div className="hstack between"><div className="headline">درخواست {fmtJ(latest.created_at.slice(0, 10), false)}</div><span className="pill">{APP_STATUS[latest.status]}</span></div>
      {latest.status === 'pending' && <p className="subhead secondary" style={{ marginBottom: 0 }}>مدیر درخواستت را می‌خواند. وقتی پذیرفته شود، با ورود دوباره، اپ به حالت مربی باز می‌شود.</p>}
      {latest.status === 'approved' && <>
        <p className="subhead" style={{ marginBottom: '1rem' }}>{latest.review_note || 'حالا مربی هستی.'}</p>
        <button className="btn glass interactive prominent block" onClick={() => window.location.reload()}>ورود به حالت مربی</button></>}
      {latest.status === 'declined' && <p className="subhead" style={{ marginBottom: 0 }}>{latest.review_note || 'این بار پذیرفته نشد.'} می‌توانی دوباره درخواست بدهی.</p>}
    </section>}

    {(!latest || latest.status === 'declined') && <form onSubmit={submit}>
      <p className="lead" style={{ textAlign: 'start' }}>مربی‌ها شاگرد اضافه می‌کنند، برنامه‌ی ماهانه می‌نویسند و تمرین‌ها را می‌بینند. مدیر درخواستت را بررسی می‌کند؛ پلن رایگان تا {fa(10)} شاگرد است.</p>
      <div className="card glass-lite">
        <div className="inline-fields two">
          <div className="field"><label htmlFor="af">نام *</label><input id="af" className="input" value={f.first} onChange={e => set('first', e.target.value)} maxLength={40} /></div>
          <div className="field"><label htmlFor="al">نام خانوادگی *</label><input id="al" className="input" value={f.last} onChange={e => set('last', e.target.value)} maxLength={40} /></div>
        </div>
        <div className="inline-fields two">
          <div className="field"><label>سال‌های تجربه *</label><IntField value={f.years} onChange={v => set('years', v)} title="سال‌های تجربه" max={60} unit="سال" suffix="سال" fallback={3} placeholder="انتخاب" /></div>
          <div className="field"><label>تعداد شاگرد فعلی *</label><IntField value={f.clients} onChange={v => set('clients', v)} title="تعداد شاگرد" max={500} unit="شاگرد" fallback={5} placeholder="انتخاب" /></div>
        </div>
        <div className="field"><label>حوزه‌های اصلی *</label>
          <div className="chips wrap-chips">{FOCUS.map(x => <button key={x} type="button" aria-pressed={f.focus.includes(x)}
            className={'chip glass-lite pressable' + (f.focus.includes(x) ? ' on' : '')}
            onClick={() => set('focus', f.focus.includes(x) ? f.focus.filter(y => y !== x) : [...f.focus, x])}>{x}</button>)}</div></div>
        <div className="field"><label htmlFor="ac">مدارک (اختیاری)</label>
          <textarea id="ac" className="input" value={f.credentials} onChange={e => set('credentials', e.target.value)} maxLength={1000} placeholder="مثلاً کارت مربیگری فدراسیون، دوره‌ها" /></div>
        <div className="field" style={{ marginBottom: 0 }}><label htmlFor="an">توضیح برای مدیر (اختیاری)</label>
          <textarea id="an" className="input" value={f.note} onChange={e => set('note', e.target.value)} maxLength={1000} placeholder="چطور کار می‌کنی، کجا مربی هستی" /></div>
      </div>
      <button className="btn glass interactive prominent block" disabled={busy || !ready}><Icon name="send" />{busy ? 'کمی صبر کن…' : 'فرستادن درخواست'}</button>
    </form>}
  </Page>
}
