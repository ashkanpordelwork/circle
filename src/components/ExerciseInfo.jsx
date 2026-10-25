import { useEffect, useState } from 'react'
import { exerciseById, exerciseName, imageUrl, MUSCLES, EQUIPMENT, LEVELS } from '../lib/exercises.js'
import { Modal } from './ui.jsx'

// The library has a start and an end photo per exercise; flipping between them shows the movement.
export function Frames({ id, small }) {
  const x = exerciseById(id)
  const [k, setK] = useState(0)
  const n = x?.img.length || 0
  useEffect(() => {
    if (small || n < 2) return
    const t = setInterval(() => setK(v => (v + 1) % n), 900)
    return () => clearInterval(t)
  }, [n, small])
  if (!n) return small ? <div className="thumb" /> : null
  if (small) return <img className="thumb" src={imageUrl(x.img[0])} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
  return <div className="frames">{x.img.map((p, i) =>
    <img key={p} src={imageUrl(p)} alt={exerciseName(id)} style={{ opacity: i === k ? 1 : 0, transition: 'opacity .25s' }} />)}</div>
}

export default function ExerciseInfo({ id, onClose }) {
  const x = exerciseById(id)
  return <Modal onClose={onClose} label={exerciseName(id)}>
    <div className="row between" style={{ marginBottom: 10 }}>
      <h2 className="ltr" style={{ margin: 0 }}>{exerciseName(id)}</h2>
      <button className="icon-btn" onClick={onClose} aria-label="بستن">✕</button>
    </div>
    <Frames id={id} />
    {x && <>
      <div className="row wrap" style={{ margin: '12px 0', gap: 6 }}>
        {x.m.map(m => <span key={m} className="pill ok">{MUSCLES[m] || m}</span>)}
        {x.s.map(m => <span key={m} className="pill">{MUSCLES[m] || m}</span>)}
        <span className="pill">{EQUIPMENT[x.e] || x.e}</span>
        {x.l && <span className="pill">{LEVELS[x.l]}</span>}
      </div>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>روش اجرا <span className="muted small">(انگلیسی)</span></h3>
      <ol className="ltr small" dir="ltr" style={{ textAlign: 'left', paddingInlineStart: 20 }}>{x.st.map((s, i) => <li key={i}>{s}</li>)}</ol>
    </>}
  </Modal>
}
