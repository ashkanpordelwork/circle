import { useEffect, useState } from 'react'
import { exerciseById, exerciseName, exerciseNameEn, imageUrl, MUSCLES, EQUIPMENT, LEVELS } from '../lib/exercises.js'
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

// The Persian name with the English one in small type beneath it (gym-floor names are often
// English). The English line is dropped when there is no Persian name to pair it with.
export function ExName({ id, className = 'title-text', style }) {
  const fa = exerciseName(id), en = exerciseNameEn(id)
  return <>
    <div className={className + ' ellipsis'} style={{ textAlign: 'right', ...style }}>{fa}</div>
    {en !== fa && <div className="en-name latin ellipsis">{en}</div>}
  </>
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
  const en = exerciseNameEn(id)
  return <Sheet title={exerciseName(id)} label={exerciseName(id)} onClose={onClose}>
    {en !== exerciseName(id) && <div className="en-name latin" style={{ marginTop: '-0.25rem', marginBottom: '0.75rem' }}>{en}</div>}
    <Frames id={id} />
    {x && <>
      <div className="hstack wrap" style={{ margin: '0.875rem 0' }}>
        {x.m.map(m => <span key={m} className="pill ok">{MUSCLES[m] || m}</span>)}
        {x.s.map(m => <span key={m} className="pill">{MUSCLES[m] || m}</span>)}
        <span className="pill">{EQUIPMENT[x.e] || x.e}</span>
        {x.l && <span className="pill">{LEVELS[x.l]}</span>}
      </div>
      <div className="section-title" style={{ paddingInline: 0 }}>روش اجرا</div>
      {x.st.length
        ? <ol className="steps">{x.st.map((s, i) => <li key={i}><span className="n tnum" aria-hidden="true">{(i + 1).toLocaleString('fa-IR')}</span><span>{s}</span></li>)}</ol>
        : <div className="subhead" style={{ color: 'var(--label-2)' }}>توضیحی برای این حرکت ثبت نشده است.</div>}
    </>}
  </Sheet>
}
