import { useEffect, useState } from 'react'
import { supabase, must } from '../../lib/supabase.js'
import { fmtDate, fmtNum, todayISO, toNumber } from '../../lib/plan.js'
import { WeightField } from '../../components/Wheel.jsx'
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
  const save = async () => {
    const v = toNumber(w)
    if (!(v >= 20 && v <= 400)) return toast('یک وزن معتبر وارد کن.', 'warning')
    try {
      await must(supabase.from('body_weights').upsert({ student_id: me.student.id, date: todayISO(), weight: v }, { onConflict: 'student_id,date' }))
      setW(''); toast('وزن امروز ثبت شد', 'success'); load()
    } catch (err) { toast(errorText(err), 'error') }
  }
  const delta = list && list.length > 1 ? Number(list[0].weight) - Number(list[1].weight) : null
  return <Page title="وزن بدن">
    <div className="hstack" style={{ marginBottom: '1.25rem' }}>
      <WeightField value={w} onChange={setW} title="وزن امروز" fine min={30} max={250} hint={list?.[0]?.weight} hintLabel="آخرین وزن"
        placeholder="وزن امروز (کیلو)" ariaLabel="وزن امروز به کیلوگرم" className="grow" />
      <button className="btn glass interactive prominent" disabled={w === ''} onClick={save}><Icon name="add" />ثبت</button>
    </div>
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
