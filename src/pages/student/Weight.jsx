import { useEffect, useState } from 'react'
import { supabase, must } from '../../lib/supabase.js'
import { fmtDate, fmtNum, todayISO } from '../../lib/plan.js'
import { Loading, useToast, errorText } from '../../components/ui.jsx'
import WeightChart from '../../components/WeightChart.jsx'
import { useMe } from '../../App.jsx'

export default function Weight() {
  const me = useMe()
  const toast = useToast()
  const [list, setList] = useState(null)
  const [w, setW] = useState('')
  const load = () => supabase.from('body_weights').select('*').order('date', { ascending: false }).limit(90)
    .then(({ data, error }) => { if (error) toast(errorText(error)); setList(data || []) })
  useEffect(() => { load() }, [])
  const save = async e => {
    e.preventDefault()
    const v = Number(String(w).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace('/', '.'))
    if (!(v >= 20 && v <= 400)) return toast('یک وزن معتبر وارد کن.')
    try {
      await must(supabase.from('body_weights').upsert({ student_id: me.student.id, date: todayISO(), weight: v }, { onConflict: 'student_id,date' }))
      setW(''); toast('وزن امروز ثبت شد'); load()
    } catch (err) { toast(errorText(err)) }
  }
  if (!list) return <Loading />
  const delta = list.length > 1 ? Number(list[0].weight) - Number(list[1].weight) : null
  return <>
    <div className="hdr"><h1>وزن بدن</h1></div>
    <form className="card row" onSubmit={save}>
      <input className="input grow" inputMode="decimal" placeholder="وزن امروز (kg)" value={w} onChange={e => setW(e.target.value)} />
      <button className="btn primary">ثبت</button>
    </form>
    {list[0] && <div className="card">
      <div className="row between"><div><div className="muted small">آخرین وزن</div><div style={{ fontSize: 28, fontWeight: 800 }}>{fmtNum(list[0].weight)} <span className="small muted">kg</span></div></div>
        {delta != null && delta !== 0 && <span className={'pill ' + (delta < 0 ? 'ok' : '')}>{delta > 0 ? '▲' : '▼'} {fmtNum(Math.abs(delta))}</span>}</div>
      <WeightChart points={[...list].reverse()} />
    </div>}
    <div className="list">{list.map(b => <div key={b.id} className="item" style={{ cursor: 'default' }}>
      <div className="grow">{fmtDate(b.date, { day: 'numeric', month: 'long', year: 'numeric' })}</div><b>{fmtNum(b.weight)} kg</b>
    </div>)}</div>
    {!list.length && <div className="empty">هنوز وزنی ثبت نکرده‌ای.</div>}
  </>
}
