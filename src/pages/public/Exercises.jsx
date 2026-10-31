import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { loadExercises, exerciseById, exerciseName } from '../../lib/exercises.js'
import { Page, Loading, Empty, useToast } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { ExerciseList } from '../../components/ExercisePicker.jsx'
import { ExerciseDetails } from '../../components/ExerciseInfo.jsx'

// «حرکات»: the library, open to anyone. Every exercise has its own address to share.

export function Exercises() {
  useTitle('حرکات')
  return <Page>
    <header className="big-title"><div className="caption">با عکس و انیمیشن</div><h1>حرکات</h1></header>
    <ExerciseList linkTo={id => '/exercises/' + encodeURIComponent(id)} />
  </Page>
}

export function ExercisePage() {
  const { id } = useParams()
  const toast = useToast()
  const [ready, setReady] = useState(false)
  useEffect(() => { loadExercises().then(() => setReady(true)) }, [])
  const x = ready ? exerciseById(id) : null
  useTitle(x ? exerciseName(x.id) : null)
  if (!ready) return <Page back="/exercises"><Loading /></Page>
  if (!x) return <Page back="/exercises"><Empty icon="search_off" title="این حرکت پیدا نشد" /></Page>
  // An old id answers as its twin: the address moves to the twin's, so one exercise has one link.
  if (x.id !== id) return <Navigate to={'/exercises/' + encodeURIComponent(x.id)} replace />

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: exerciseName(x.id), url })
      else { await navigator.clipboard.writeText(url); toast('لینک کپی شد', 'success') }
    } catch { /* closed the share sheet */ }
  }
  return <Page title={exerciseName(x.id)} back="/exercises"
    actions={<button className="icon-btn glass interactive" onClick={share} aria-label="اشتراک‌گذاری"><Icon name="share" /></button>}>
    <div className="card glass-lite ex-page"><ExerciseDetails id={x.id} /></div>
  </Page>
}

// The browser tab says where you are; shared links read better too.
export function useTitle(title) {
  useEffect(() => {
    if (!title) return
    const before = document.title
    document.title = `${title} | Circle`
    return () => { document.title = before }
  }, [title])
}
