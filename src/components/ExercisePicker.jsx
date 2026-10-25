import { useEffect, useMemo, useState } from 'react'
import { loadExercises, searchExercises, MUSCLES, EQUIPMENT } from '../lib/exercises.js'
import { Modal, Loading } from './ui.jsx'
import { Frames } from './ExerciseInfo.jsx'

// Pick exercises for a routine. Stays open so several can be added in a row.
export default function ExercisePicker({ onPick, onClose, added = [] }) {
  const [all, setAll] = useState(null)
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equipment, setEquipment] = useState('')
  const [limit, setLimit] = useState(40)
  useEffect(() => { loadExercises().then(setAll) }, [])
  const found = useMemo(() => (all ? searchExercises(all, q, { muscle, equipment }) : []), [all, q, muscle, equipment])
  useEffect(() => setLimit(40), [q, muscle, equipment])
  const has = new Set(added)

  return <Modal onClose={onClose} label="افزودن حرکت">
    <div className="row between" style={{ marginBottom: 10 }}>
      <h2 style={{ margin: 0 }}>افزودن حرکت</h2>
      <button className="btn sm primary" onClick={onClose}>تمام</button>
    </div>
    <input className="input" placeholder="جستجو (انگلیسی یا نام عضله، مثلاً squat یا سینه)" value={q} onChange={e => setQ(e.target.value)} autoFocus />
    <div className="chips" style={{ margin: '10px 0 6px' }}>
      <button className={'chip' + (!muscle ? ' on' : '')} onClick={() => setMuscle('')}>همه عضلات</button>
      {Object.entries(MUSCLES).map(([k, v]) => <button key={k} className={'chip' + (muscle === k ? ' on' : '')} onClick={() => setMuscle(k)}>{v}</button>)}
    </div>
    <div className="chips" style={{ marginBottom: 10 }}>
      <button className={'chip' + (!equipment ? ' on' : '')} onClick={() => setEquipment('')}>همه تجهیزات</button>
      {Object.entries(EQUIPMENT).map(([k, v]) => <button key={k} className={'chip' + (equipment === k ? ' on' : '')} onClick={() => setEquipment(k)}>{v}</button>)}
    </div>
    {!all ? <Loading /> : <>
      <div className="small muted" style={{ marginBottom: 6 }}>{found.length.toLocaleString('fa-IR')} حرکت</div>
      <div className="list">{found.slice(0, limit).map(x => <button key={x.id} className="item" onClick={() => onPick(x.id)}>
        <Frames id={x.id} small />
        <div className="grow">
          <div className="t ltr">{x.n}</div>
          <div className="s">{x.m.map(m => MUSCLES[m] || m).join('، ')} · {EQUIPMENT[x.e] || x.e}</div>
        </div>
        <span className={'pill' + (has.has(x.id) ? ' ok' : '')}>{has.has(x.id) ? '✓ اضافه شد' : '+ افزودن'}</span>
      </button>)}</div>
      {found.length > limit && <button className="btn block" style={{ marginTop: 10 }} onClick={() => setLimit(l => l + 40)}>نمایش بیشتر</button>}
    </>}
  </Modal>
}
