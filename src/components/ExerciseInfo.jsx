import { useEffect, useState } from 'react'
import { exerciseById, exerciseName, imageUrl, MUSCLES, EQUIPMENT, LEVELS } from '../lib/exercises.js'
import { reducedMotion } from '../lib/spring.js'
import Sheet from './Sheet.jsx'
import Icon from './Icon.jsx'

// Small square photo; a quiet placeholder if the image cannot load.
export function Thumb({ id }) {
  const x = exerciseById(id)
  const [bad, setBad] = useState(false)
  return <div className="thumb">{x?.img.length && !bad
    ? <img src={imageUrl(x.img[0])} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} />
    : <Icon name="fitness_center" />}</div>
}

// The library has a start and an end photo per exercise; alternating them shows the movement.
// With reduced motion both stay still and the start photo is shown.
export function Frames({ id }) {
  const x = exerciseById(id)
  const [k, setK] = useState(0)
  const n = x?.img.length || 0
  useEffect(() => {
    if (n < 2 || reducedMotion()) return
    const t = setInterval(() => setK(v => (v + 1) % n), 1000)
    return () => clearInterval(t)
  }, [n])
  if (!n) return null
  return <div className="frames">{x.img.map((p, i) => <img key={p} src={imageUrl(p)} alt={i === 0 ? exerciseName(id) : ''} style={{ opacity: i === k ? 1 : 0 }} />)}</div>
}

export default function ExerciseInfo({ id, onClose }) {
  const x = exerciseById(id)
  return <Sheet title={<span className="latin">{exerciseName(id)}</span>} label={exerciseName(id)} onClose={onClose}>
    <Frames id={id} />
    {x && <>
      <div className="hstack wrap" style={{ margin: '0.875rem 0' }}>
        {x.m.map(m => <span key={m} className="pill ok">{MUSCLES[m] || m}</span>)}
        {x.s.map(m => <span key={m} className="pill">{MUSCLES[m] || m}</span>)}
        <span className="pill">{EQUIPMENT[x.e] || x.e}</span>
        {x.l && <span className="pill">{LEVELS[x.l]}</span>}
      </div>
      <div className="section-title" style={{ paddingInline: 0 }}>روش اجرا (انگلیسی)</div>
      <ol className="subhead latin" dir="ltr" style={{ textAlign: 'left', paddingInlineStart: '1.25rem', margin: 0 }}>{x.st.map((s, i) => <li key={i} style={{ marginBottom: '0.375rem' }}>{s}</li>)}</ol>
    </>}
  </Sheet>
}
