import { useEffect, useState } from 'react'
import { supabase, must } from '../../lib/supabase.js'
import { fmtDate, summarize, setText } from '../../lib/plan.js'
import { loadExercises } from '../../lib/exercises.js'
import { ExName } from '../../components/ExerciseInfo.jsx'
import { Page, Loading, Empty, useToast, errorText } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'

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
      } catch (e) { toast(errorText(e), 'error'); setData({ workouts: [], sets: [] }) }
    })()
  }, [])
  return <Page>
    {!data ? <Loading /> : !data.workouts.length ? <Empty icon="history" title="هنوز تمرینی ثبت نکرده‌ای">بعد از اولین تمرین، اینجا می‌بینی چه زدی.</Empty>
      : <div className="group glass-lite">{data.workouts.map(w => {
        const sets = data.sets.filter(s => s.workout_id === w.id)
        const sum = summarize(sets)
        const isOpen = open === w.id
        return <div key={w.id}>
          <button className="row with-leading pressable" onClick={() => setOpen(isOpen ? null : w.id)} aria-expanded={isOpen}>
            <div className="tile-icon"><Icon name="check" /></div>
            <div className="content"><div className="title-text">{w.routine_name || 'تمرین'}</div>
              <div className="sub">{fmtDate(w.date)} · {sets.length.toLocaleString('fa-IR')} ست</div></div>
            <Icon name={isOpen ? 'expand_less' : 'expand_more'} style={{ color: 'var(--label-3)' }} />
          </button>
          {isOpen && <div style={{ padding: '0 1rem 0.75rem 1rem', paddingInlineStart: '4rem' }}>
            {[...sum.keys()].map(id => <div key={id} style={{ padding: '0.375rem 0' }}>
              <ExName id={id} className="subhead" style={{ fontWeight: 600 }} />
              <div className="footnote tnum">{sets.filter(s => s.exercise_id === id).sort((a, b) => a.set_index - b.set_index).map(setText).join('   ·   ')}</div>
            </div>)}
          </div>}
        </div>
      })}</div>}
  </Page>
}
