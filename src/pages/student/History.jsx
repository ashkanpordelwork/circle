import { useEffect, useState } from 'react'
import { supabase, must } from '../../lib/supabase.js'
import { fmtDate, summarize, setText } from '../../lib/plan.js'
import { exerciseName, loadExercises } from '../../lib/exercises.js'
import { Loading, useToast, errorText } from '../../components/ui.jsx'

export default function History() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(null)
  useEffect(() => {
    (async () => {
      try {
        await loadExercises()
        const workouts = await must(supabase.from('workouts').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(60))
        const sets = workouts.length ? await must(supabase.from('workout_sets').select('*').in('workout_id', workouts.map(w => w.id))) : []
        setData({ workouts, sets })
      } catch (e) { toast(errorText(e)); setData({ workouts: [], sets: [] }) }
    })()
  }, [])
  if (!data) return <Loading />
  return <>
    <div className="hdr"><h1>سابقه تمرین</h1><span className="pill">{data.workouts.length.toLocaleString('fa-IR')} جلسه</span></div>
    {!data.workouts.length ? <div className="empty"><div className="big">📈</div>هنوز تمرینی ثبت نکرده‌ای.</div>
      : <div className="list">{data.workouts.map(w => {
        const sets = data.sets.filter(s => s.workout_id === w.id)
        const sum = summarize(sets)
        return <div key={w.id} className="card" style={{ marginBottom: 0, cursor: 'pointer' }} onClick={() => setOpen(open === w.id ? null : w.id)}>
          <div className="row between"><div><b>{w.routine_name || 'تمرین'}</b><div className="small muted">{fmtDate(w.date)} · {sets.length.toLocaleString('fa-IR')} ست</div></div><span className="muted">{open === w.id ? '▴' : '▾'}</span></div>
          {open === w.id && [...sum.keys()].map(id => <div key={id} className="small" style={{ borderTop: '1px solid var(--line)', padding: '6px 0' }}>
            <div className="ltr" style={{ fontWeight: 600 }}>{exerciseName(id)}</div>
            <div className="muted ltr" dir="ltr">{sets.filter(s => s.exercise_id === id).sort((a, b) => a.set_index - b.set_index).map(setText).join('   ·   ')}</div>
          </div>)}
        </div>
      })}</div>}
  </>
}
