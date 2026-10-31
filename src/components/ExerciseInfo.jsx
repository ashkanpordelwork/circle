import { useEffect, useState } from 'react'
import { exerciseById, exerciseName, exerciseNameEn, thumbUrl, gifUrl, photoUrls, MUSCLES, EQUIPMENT, LEVELS } from '../lib/exercises.js'
import { reducedMotion } from '../lib/spring.js'
import Sheet from './Sheet.jsx'
import Icon from './Icon.jsx'

// Small square picture; a quiet placeholder if the image cannot load.
export function Thumb({ id }) {
  const src = thumbUrl(exerciseById(id))
  const [bad, setBad] = useState(false)
  return <div className="thumb">{src && !bad
    ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} />
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

// The movement: the new library's animation (its still picture with reduced motion), or for an
// old entry its start and end photos, alternating.
export function Frames({ id }) {
  const x = exerciseById(id)
  const [k, setK] = useState(0)
  const photos = photoUrls(x)
  const n = photos.length
  useEffect(() => {
    if (n < 2 || reducedMotion()) return
    const t = setInterval(() => setK(v => (v + 1) % n), 1000)
    return () => clearInterval(t)
  }, [n])
  const gif = gifUrl(x)
  if (gif) return <div className="frames anim"><img src={reducedMotion() ? thumbUrl(x) : gif} alt={exerciseName(id)} /></div>
  if (!n) return null
  return <div className="frames">{photos.map((p, i) => <img key={p} src={p} alt={i === 0 ? exerciseName(id) : ''} style={{ opacity: i === k ? 1 : 0 }} />)}</div>
}

// Photos, muscles and the steps; shown in a sheet on its own, or inline inside a page.
export function ExerciseDetails({ id, showEn = true }) {
  const x = exerciseById(id)
  const en = exerciseNameEn(id)
  return <>
    {showEn && en !== exerciseName(id) && <div className="en-name latin" style={{ marginTop: '-0.25rem', marginBottom: '0.75rem' }}>{en}</div>}
    <Frames id={id} />
    {x && <>
      <div className="hstack wrap" style={{ margin: '1rem 0' }}>
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
  </>
}

export default function ExerciseInfo({ id, onClose }) {
  return <Sheet title={exerciseName(id)} label={exerciseName(id)} onClose={onClose}><ExerciseDetails id={id} /></Sheet>
}
