import { useEffect, useMemo, useState } from 'react'
import { loadExercises, searchExercises, MUSCLES, EQUIPMENT } from '../lib/exercises.js'
import Sheet, { useSheet } from './Sheet.jsx'
import Icon from './Icon.jsx'
import { Loading, haptic } from './ui.jsx'
import { Thumb, ExName } from './ExerciseInfo.jsx'

function Body({ onPick, added }) {
  const { close } = useSheet()
  const [all, setAll] = useState(null)
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equipment, setEquipment] = useState('')
  const [limit, setLimit] = useState(40)
  useEffect(() => { loadExercises().then(setAll) }, [])
  const found = useMemo(() => (all ? searchExercises(all, q, { muscle, equipment }) : []), [all, q, muscle, equipment])
  useEffect(() => setLimit(40), [q, muscle, equipment])
  const has = new Set(added)
  return <>
    <div className="hstack" style={{ marginBottom: '0.75rem' }}>
      <div className="grow" style={{ position: 'relative' }}>
        <input className="input" style={{ paddingInlineStart: '2.5rem' }} placeholder="جستجو: squat، سینه، دمبل…" value={q} onChange={e => setQ(e.target.value)} aria-label="جستجوی حرکت" />
        <Icon name="search" style={{ position: 'absolute', insetInlineStart: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--label-3)', fontSize: '1.25rem' }} />
      </div>
      <button className="btn glass interactive prominent small" onClick={() => close()}>تمام</button>
    </div>
    <div className="chips" data-no-drag>
      <button className={'chip glass-lite pressable' + (!muscle ? ' on' : '')} onClick={() => setMuscle('')}>همه عضلات</button>
      {Object.entries(MUSCLES).map(([k, v]) => <button key={k} className={'chip glass-lite pressable' + (muscle === k ? ' on' : '')} onClick={() => setMuscle(muscle === k ? '' : k)}>{v}</button>)}
    </div>
    <div className="chips" data-no-drag style={{ marginBottom: '0.5rem' }}>
      <button className={'chip glass-lite pressable' + (!equipment ? ' on' : '')} onClick={() => setEquipment('')}>همه تجهیزات</button>
      {Object.entries(EQUIPMENT).map(([k, v]) => <button key={k} className={'chip glass-lite pressable' + (equipment === k ? ' on' : '')} onClick={() => setEquipment(equipment === k ? '' : k)}>{v}</button>)}
    </div>
    {!all ? <Loading /> : <>
      <div className="caption" style={{ padding: '0 0.25rem 0.375rem' }}>{found.length.toLocaleString('fa-IR')} حرکت</div>
      <div className="group glass-lite">{found.slice(0, limit).map(x => <button key={x.id} className="row pressable" style={{ '--sep-inset': '5.25rem' }}
        onClick={() => { onPick(x.id); haptic(8) }}>
        <Thumb id={x.id} />
        <div className="content">
          <ExName id={x.id} />
          <div className="sub ellipsis">{x.m.map(m => MUSCLES[m] || m).join('، ')} · {EQUIPMENT[x.e] || x.e}</div>
        </div>
        <Icon name={has.has(x.id) ? 'check_circle' : 'add'} filled={has.has(x.id)} style={{ color: 'var(--accent)' }} />
      </button>)}</div>
      {found.length > limit && <button className="btn glass interactive block mt" onClick={() => setLimit(l => l + 40)}>نمایش بیشتر</button>}
    </>}
  </>
}

// Stays open, so several exercises can be added in a row; each tap is confirmed in place.
export default function ExercisePicker({ onPick, onClose, added = [] }) {
  return <Sheet title="افزودن حرکت" onClose={onClose}><Body onPick={onPick} added={added} /></Sheet>
}
