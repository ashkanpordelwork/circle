import { useEffect, useState } from 'react'
import { supabase, must } from '../../lib/supabase.js'
import { fmtDate, fmtNum, todayISO, toNumber, summarize, setText } from '../../lib/plan.js'
import { loadExercises } from '../../lib/exercises.js'
import { WeightField } from '../../components/Wheel.jsx'
import { ExName } from '../../components/ExerciseInfo.jsx'
import { Page, Loading, Empty, useToast, errorText } from '../../components/ui.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import WeightChart from '../../components/WeightChart.jsx'
import Screen from '../../components/Screen.jsx'
import { useMe } from '../../App.jsx'
import { scope } from '../../lib/scope.js'

// «پیشرفت» answers one question — how am I doing? — with the two things that show it:
// body weight (logged here) and the workouts done. They used to be two tabs, «وزن» and «سابقه».

const fa = n => Number(n).toLocaleString('fa-IR')
const longDate = d => fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' })

function WeightCard({ list, onSaved }) {
  const me = useMe()
  const toast = useToast()
  const [w, setW] = useState('')
  const [all, setAll] = useState(false)
  const save = async () => {
    const v = toNumber(w)
    if (!(v >= 20 && v <= 400)) return toast('یک وزن معتبر وارد کن.', 'warning')
    try {
      await must(supabase.from('body_weights').upsert({ student_id: me.student.id, date: todayISO(), weight: v }, { onConflict: 'student_id,date' }))
      setW(''); toast('وزن امروز ثبت شد', 'success'); onSaved()
    } catch (err) { toast(errorText(err), 'error') }
  }
  const delta = list.length > 1 ? Number(list[0].weight) - Number(list[1].weight) : null
  return <div className="section">
    <div className="section-title">وزن بدن</div>
    <div className="card glass-lite" style={{ marginBottom: 0 }}>
      {list.length ? <>
        <div className="hstack between">
          <div><div className="caption">آخرین وزن · {fmtDate(list[0].date, { day: 'numeric', month: 'long' })}</div>
            <div className="title-lg tnum">{fmtNum(list[0].weight)} <span className="subhead secondary">کیلو</span></div></div>
          {delta != null && delta !== 0 && <span className={'pill ' + (delta < 0 ? 'ok' : '')}><Icon name={delta > 0 ? 'trending_up' : 'trending_down'} />{fmtNum(Math.abs(delta))}</span>}
        </div>
        {list.length > 1 && <WeightChart points={[...list].reverse()} />}
      </> : <div className="subhead secondary" style={{ marginBottom: '0.25rem' }}>هر چند روز یک بار وزنت را ثبت کن تا روندش را ببینی.</div>}
      <div className="hstack mt">
        <WeightField value={w} onChange={setW} title="وزن امروز" fine min={30} max={250} hint={list[0]?.weight} hintLabel="آخرین وزن"
          placeholder="وزن امروز (کیلو)" ariaLabel="وزن امروز به کیلو" className="grow" />
        <button className="btn glass interactive prominent" disabled={w === ''} onClick={save}><Icon name="add" />ثبت</button>
      </div>
    </div>
    {list.length > 1 && <button className="btn plain small pressable" style={{ marginTop: '0.5rem' }} onClick={() => setAll(true)}>همه ثبت‌ها ({fa(list.length)})</button>}
    {all && <Screen title="همه ثبت‌های وزن" onClose={() => setAll(false)}>
      <div className="group glass-lite">{list.map(b => <div key={b.id} className="row">
        <div className="content">{longDate(b.date)}</div>
        <div className="tnum" style={{ fontWeight: 600 }}>{fmtNum(b.weight)} کیلو</div>
      </div>)}</div>
    </Screen>}
  </div>
}

function Workouts({ workouts, sets }) {
  const [open, setOpen] = useState(null)
  return <div className="section">
    <div className="section-title">تمرین‌های انجام‌شده</div>
    {!workouts.length ? <Empty icon="history" title="هنوز تمرینی ثبت نکرده‌ای">بعد از اولین تمرین، اینجا می‌بینی چه زدی.</Empty>
      : <div className="group glass-lite">{workouts.map(w => {
        const mine = sets.filter(s => s.workout_id === w.id)
        const sum = summarize(mine)
        const isOpen = open === w.id
        return <div key={w.id}>
          <button className="row with-leading pressable" onClick={() => setOpen(isOpen ? null : w.id)} aria-expanded={isOpen}>
            <div className="tile-icon"><Icon name="check" /></div>
            <div className="content"><div className="title-text">{w.routine_name || 'تمرین'}</div>
              <div className="sub">{fmtDate(w.date)} · {fa(mine.length)} ست</div></div>
            <Icon name={isOpen ? 'expand_less' : 'expand_more'} style={{ color: 'var(--label-3)' }} />
          </button>
          {isOpen && <div style={{ padding: '0 1rem 0.75rem', paddingInlineStart: '4.25rem' }}>
            {[...sum.keys()].map(id => <div key={id} style={{ padding: '0.5rem 0' }}>
              <ExName id={id} className="subhead" style={{ fontWeight: 600 }} />
              <div className="footnote tnum">{mine.filter(s => s.exercise_id === id).sort((a, b) => a.set_index - b.set_index).map(setText).join('   ·   ')}</div>
            </div>)}
          </div>}
        </div>
      })}</div>}
  </div>
}

export default function Progress() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const loadWeights = () => must(supabase.from('body_weights').select('*').eq('student_id', scope.student).order('date', { ascending: false }).limit(90))
  useEffect(() => {
    (async () => {
      try {
        await loadExercises()
        const [weights, workouts] = await Promise.all([loadWeights(),
          must(supabase.from('workouts').select('*').eq('student_id', scope.student).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(60))])
        const sets = workouts.length ? await must(supabase.from('workout_sets').select('*').in('workout_id', workouts.map(w => w.id))) : []
        setData({ weights, workouts, sets })
      } catch (e) { toast(errorText(e), 'error'); setData({ weights: [], workouts: [], sets: [] }) }
    })()
  }, [])
  const reloadWeights = () => loadWeights().then(weights => setData(d => ({ ...d, weights }))).catch(e => toast(errorText(e), 'error'))
  if (!data) return <Page><Loading /></Page>
  return <Page>
    <WeightCard list={data.weights} onSaved={reloadWeights} />
    <Workouts workouts={data.workouts} sets={data.sets} />
  </Page>
}
