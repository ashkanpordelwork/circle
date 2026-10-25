import { useEffect, useState } from 'react'
import { supabase, must } from '../../lib/supabase.js'
import { fmtDate, fmtNum, todayISO, toNumber, showNum, readNum } from '../../lib/plan.js'
import { Page, Loading, Empty, useToast, errorText } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import WeightChart from '../../components/WeightChart.jsx'
import { useMe } from '../../App.jsx'

export default function Weight() {
  const me = useMe()
  const toast = useToast()
  const [list, setList] = useState(null)
  const [w, setW] = useState('')
  const load = () => supabase.from('body_weights').select('*').order('date', { ascending: false }).limit(90)
    .then(({ data, error }) => { if (error) toast(errorText(error), 'error'); setList(data || []) })
  useEffect(() => { load() }, [])
  const save = async e => {
    e.preventDefault()
    const v = toNumber(w)
    if (!(v >= 20 && v <= 400)) return toast('یک وزن معتبر وارد کن.', 'warning')
    try {
      await must(supabase.from('body_weights').upsert({ student_id: me.student.id, date: todayISO(), weight: v }, { onConflict: 'student_id,date' }))
      setW(''); toast('وزن امروز ثبت شد', 'success'); load()
    } catch (err) { toast(errorText(err), 'error') }
  }
  const delta = list && list.length > 1 ? Number(list[0].weight) - Number(list[1].weight) : null
  return <Page title="وزن بدن">
    <form className="hstack" onSubmit={save} style={{ marginBottom: '1.25rem' }}>
      <input className="input grow" style={{ background: 'var(--lite-fill)', boxShadow: 'inset 0 1px 0.5px var(--glass-specular)' }} inputMode="decimal" placeholder="وزن امروز (کیلو)" value={showNum(w)} onChange={e => setW(readNum(e.target.value))} aria-label="وزن امروز به کیلوگرم" />
      <button className="btn glass interactive prominent"><Icon name="add" />ثبت</button>
    </form>
    {!list ? <Loading /> : !list.length ? <Empty icon="monitor_weight" title="هنوز وزنی ثبت نکرده‌ای">هر چند روز یک بار وزنت را ثبت کن تا روند را ببینی.</Empty> : <>
      <div className="card glass-lite">
        <div className="hstack between">
          <div><div className="caption">آخرین وزن · {fmtDate(list[0].date, { day: 'numeric', month: 'long' })}</div>
            <div className="title-lg tnum">{fmtNum(list[0].weight)} <span className="subhead secondary">کیلو</span></div></div>
          {delta != null && delta !== 0 && <span className={'pill ' + (delta < 0 ? 'ok' : '')}><Icon name={delta > 0 ? 'trending_up' : 'trending_down'} />{fmtNum(Math.abs(delta))}</span>}
        </div>
        <WeightChart points={[...list].reverse()} />
      </div>
      <div className="section-title">همه ثبت‌ها</div>
      <div className="group glass-lite">{list.map(b => <div key={b.id} className="row">
        <div className="content">{fmtDate(b.date, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <div className="tnum" style={{ fontWeight: 650 }}>{fmtNum(b.weight)} کیلو</div>
      </div>)}</div>
    </>}
  </Page>
}
