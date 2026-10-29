import { useEffect, useState } from 'react'
import { supabase, must } from '../lib/supabase.js'
import { fmtJ } from '../lib/jalali.js'
import { useToast, errorText } from './ui.jsx'
import Icon from './Icon.jsx'

// The conversation under one workout, between the student and their coach (0010_coaching.sql).
// otherName: what the other side is called here — «مربی» for the student, the student's name
// for the coach.
export default function WorkoutComments({ workoutId, me, otherName }) {
  const toast = useToast()
  const [list, setList] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => supabase.from('workout_comments').select('*').eq('workout_id', workoutId).order('created_at')
    .then(({ data, error }) => setList(error ? false : data || []))
  useEffect(() => { load() }, [workoutId])
  if (list === false) return null   // before migration 0010
  const send = async e => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try { await must(supabase.from('workout_comments').insert({ workout_id: workoutId, body: text.trim() })); setText(''); load() }
    catch (err) { toast(errorText(err), 'error') } finally { setBusy(false) }
  }
  return <div className="comments">
    {(list || []).map(c => <div key={c.id} className={'bubble' + (c.author === me ? ' mine' : '')}>
      <div className="caption">{c.author === me ? 'تو' : otherName} · {fmtJ(c.created_at.slice(0, 10), false)}</div>
      <div className="subhead" style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
    </div>)}
    <form className="comment-form" onSubmit={send}>
      <input className="input" placeholder={list?.length ? 'پاسخ…' : `نظری برای ${otherName}…`} value={text} onChange={e => setText(e.target.value)} maxLength={1000} aria-label="نوشتن نظر" />
      <button className="icon-btn glass interactive" disabled={busy || !text.trim()} aria-label="فرستادن"><Icon name="send" /></button>
    </form>
  </div>
}
