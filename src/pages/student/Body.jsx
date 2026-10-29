import { useEffect, useRef, useState } from 'react'
import { supabase, must } from '../../lib/supabase.js'
import { todayISO, faDigits, toNumber } from '../../lib/plan.js'
import { addDays, fmtJ } from '../../lib/jalali.js'
import { MEASURES, measureSummary, readinessScore, readinessAdvice, readinessTone } from '../../lib/body.js'
import { addPhoto, listPhotos, deletePhoto, photosAvailable } from '../../lib/photos.js'
import { Page, Loading, Confirm, useToast, errorText } from '../../components/ui.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import Screen from '../../components/Screen.jsx'
import LineChart from '../../components/LineChart.jsx'
import { ReadinessSheet } from '../../components/Readiness.jsx'
import { scope } from '../../lib/scope.js'

// «پیشرفت و بازیابی»: readiness over the last two weeks, tape measurements, and progress photos.
// All of it private: a coach sees none of this, and the photos never leave the phone.

const fa = n => Number(n).toLocaleString('fa-IR')

export default function Body() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [sheet, setSheet] = useState(null)   // 'check' | 'measure' | { measure: key }
  const today = todayISO()
  const load = async () => {
    try {
      // Before migration 0009 neither table exists: the page shows its empty states.
      const [checks, measures] = await Promise.all([
        supabase.from('readiness_checks').select('*').eq('student_id', scope.student).gte('date', addDays(today, -13)).order('date').then(r => r.data || []),
        supabase.from('body_measurements').select('*').eq('student_id', scope.student).order('date').then(r => r.data || [])])
      setData({ checks, measures })
    } catch (e) { toast(errorText(e), 'error'); setData({ checks: [], measures: [] }) }
  }
  useEffect(() => { load() }, [])
  if (!data) return <Page title="پیشرفت و بازیابی" back><Loading /></Page>
  const todayCheck = data.checks.find(c => c.date === today)
  const score = readinessScore(todayCheck)
  const sum = measureSummary(data.measures)
  const days = Array.from({ length: 14 }, (_, k) => addDays(today, k - 13))

  return <Page title="پیشرفت و بازیابی" subtitle="فقط خودت می‌بینی" back>
    <div className="section">
      <div className="section-title">آمادگی</div>
      <div className="card glass-lite" style={{ marginBottom: 0 }}>
        {todayCheck ? <div className={'readiness-result ' + readinessTone(score)} style={{ marginTop: 0 }}>
          <div className="tnum score">{fa(score)}٪</div><div className="subhead">{readinessAdvice(score)}</div>
        </div> : <div className="subhead secondary">امروز هنوز چک‌این نکرده‌ای.</div>}
        <div className="bars" style={{ gridTemplateColumns: 'repeat(14, 1fr)', height: '5rem' }} role="img" aria-label="آمادگی چهارده روز اخیر">
          {days.map(d => { const c = data.checks.find(x => x.date === d), s = readinessScore(c)
            return <div key={d} className={'bar' + (d === today ? ' now' : '')}><span className="b" style={{ height: s == null ? '2px' : `${Math.max(6, s)}%`, background: s == null ? undefined : `var(--${s >= 75 ? 'lime' : s >= 50 ? 'label-3' : s >= 30 ? 'orange' : 'red'})` }} /></div> })}
        </div>
        <div className="footnote" style={{ marginTop: '0.5rem' }}>دو هفته‌ی اخیر</div>
        <button className="btn glass interactive block mt" onClick={() => setSheet('check')}><Icon name="favorite" />{todayCheck ? 'ویرایش چک‌این امروز' : 'چک‌این امروز'}</button>
      </div>
    </div>

    <div className="section">
      <div className="section-head">
        <div className="section-title">اندازه‌های بدن</div>
        <button className="btn glass interactive small" onClick={() => setSheet('measure')}><Icon name="add" />ثبت اندازه</button>
      </div>
      <div className="group glass-lite">{MEASURES.map(([k, label, unit]) => { const m = sum[k]
        return <button key={k} className="row pressable" disabled={m.points.length < 1} onClick={() => setSheet({ measure: k })}>
          <div className="content"><div className="title-text">{label}</div><div className="sub">{m.last ? fmtJ(m.last.date, false) : 'ثبت نشده'}</div></div>
          {m.last && <span className="tnum" style={{ fontWeight: 600 }}>{faDigits(m.last.y)} <span className="caption">{unit === 'درصد' ? '٪' : 'سانت'}</span></span>}
          {m.change ? <span className="pill">{faDigits(Math.abs(m.change))} {m.change < 0 ? 'کمتر' : 'بیشتر'}</span> : null}
          {m.points.length > 0 && <Disclosure />}
        </button> })}</div>
      <div className="section-footer">هر چند هفته یک بار، صبح و ناشتا، با متر نواری.</div>
    </div>

    <Photos />

    {sheet === 'check' && <ReadinessSheet initial={todayCheck} onSaved={load} onClose={() => setSheet(null)} />}
    {sheet === 'measure' && <MeasureScreen last={sum} onSaved={() => { setSheet(null); load() }} onClose={() => setSheet(null)} />}
    {sheet?.measure && <Screen title={MEASURES.find(m => m[0] === sheet.measure)[1]} onClose={() => setSheet(null)}>
      <div className="card glass-lite"><LineChart points={sum[sheet.measure].points} unit={sheet.measure === 'body_fat' ? '٪' : 'سانت'} /></div>
      <div className="group glass-lite">{[...sum[sheet.measure].points].reverse().map(p => <div key={p.date} className="row">
        <div className="content">{fmtJ(p.date)}</div><span className="tnum" style={{ fontWeight: 600 }}>{faDigits(p.y)}</span></div>)}</div>
    </Screen>}
  </Page>
}

// Today's tape measurements: any of them, blanks skipped.
function MeasureScreen({ last, onSaved, onClose }) {
  const toast = useToast()
  const [v, setV] = useState({})
  const [busy, setBusy] = useState(false)
  const save = async () => {
    const row = { student_id: scope.student, date: todayISO() }
    for (const [k] of MEASURES) { const n = toNumber(v[k]); if (n != null) row[k] = n }
    if (Object.keys(row).length < 3) return toast('دست‌کم یک اندازه بنویس.', 'warning')
    setBusy(true)
    try { await must(supabase.from('body_measurements').upsert(row, { onConflict: 'student_id,date' })); toast('اندازه‌ها ثبت شد', 'success'); onSaved() }
    catch (e) { setBusy(false); toast(/body_measurements/.test(e?.message) ? 'ثبت اندازه هنوز فعال نشده.' : /check/.test(e?.message) ? 'یکی از عددها درست نیست.' : errorText(e), 'error') }
  }
  return <Screen title="ثبت اندازه" subtitle={fmtJ(todayISO())} onClose={onClose}>
    <div className="card glass-lite">{MEASURES.map(([k, label, unit]) => <div key={k} className="field">
      <label htmlFor={'m-' + k}>{label} <span className="caption">({unit}{last[k].last ? ` · قبلی ${faDigits(last[k].last.y)}` : ''})</span></label>
      <input id={'m-' + k} className="input num" inputMode="decimal" value={v[k] ?? ''} onChange={e => setV(x => ({ ...x, [k]: e.target.value }))} placeholder="—" />
    </div>)}</div>
    <div className="page-end"><button className="btn glass interactive prominent block" disabled={busy} onClick={save}>ثبت</button></div>
  </Screen>
}

// Progress photos, kept on this phone only.
function Photos() {
  const toast = useToast()
  const input = useRef(null)
  const [list, setList] = useState(null)
  const [urls, setUrls] = useState({})
  const [view, setView] = useState(null)
  const [del, setDel] = useState(null)
  const ok = photosAvailable()
  const load = () => listPhotos(scope.student).then(setList).catch(() => setList([]))
  useEffect(() => { if (ok) load(); else setList([]) }, [])
  useEffect(() => {
    if (!list) return
    const u = Object.fromEntries(list.map(p => [p.id, URL.createObjectURL(p.blob)]))
    setUrls(u)
    return () => Object.values(u).forEach(URL.revokeObjectURL)
  }, [list])
  const add = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try { await addPhoto(scope.student, file, todayISO()); load(); toast('عکس روی همین گوشی ذخیره شد', 'success') }
    catch { toast('ذخیره‌ی عکس در این مرورگر ممکن نشد.', 'error') }
  }
  return <div className="section">
    <div className="section-head">
      <div className="section-title">عکس پیشرفت</div>
      {ok && <button className="btn glass interactive small" onClick={() => input.current?.click()}><Icon name="add_a_photo" />عکس تازه</button>}
    </div>
    <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={add} />
    {!list ? <Loading /> : !list.length
      ? <div className="card glass-lite" style={{ marginBottom: 0 }}><p className="subhead secondary" style={{ margin: 0 }}>هر چند هفته یک عکس با همان نور و ژست؛ کنار هم که بگذاری، تغییر را بهتر از ترازو می‌بینی.</p></div>
      : <div className="photo-grid">{list.map(p => <button key={p.id} className="photo pressable" onClick={() => setView(p)}>
        {urls[p.id] && <img src={urls[p.id]} alt={`عکس ${fmtJ(p.date)}`} />}<span className="caption">{fmtJ(p.date, false)}</span>
      </button>)}</div>}
    <div className="section-footer"><Icon name="lock" style={{ fontSize: '1rem', verticalAlign: 'middle' }} /> فقط روی همین گوشی می‌ماند: نه به سرور می‌رود، نه مربی می‌بیند. با پاک کردن داده‌های مرورگر یا عوض کردن گوشی از دست می‌رود.</div>
    {view && <Screen title={fmtJ(view.date)} onClose={() => setView(null)}
      actions={<button className="icon-btn glass interactive danger" onClick={() => setDel(view)} aria-label="حذف عکس"><Icon name="delete" /></button>}>
      <img className="photo-full" src={urls[view.id]} alt={`عکس ${fmtJ(view.date)}`} />
    </Screen>}
    {del && <Confirm title="این عکس حذف شود؟" danger okText="حذف" onClose={() => setDel(null)} text="از روی گوشی پاک می‌شود و برنمی‌گردد."
      onOk={async () => { await deletePhoto(del.id); setView(null); load() }} />}
  </div>
}
