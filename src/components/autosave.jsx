import { useEffect, useRef, useState } from 'react'
import { useToast, errorText } from './ui.jsx'

// Saves `value` a moment after it last changed, one save at a time, and once more on the way out.
//   keyOf(value)  what is compared to tell a change (the value as it would be stored)
//   save(value)   async; the stored result
// The first value seen counts as already saved. Returns [status, saveNow]:
// status is 'saved' | 'pending' | 'saving' | 'error'.
export function useAutosave(value, keyOf, save, delay = 700) {
  const toast = useToast()
  const [status, setStatus] = useState('saved')
  const saved = useRef(null)
  const latest = useRef(value)
  latest.current = value
  const fns = useRef({ keyOf, save })
  fns.current = { keyOf, save }
  const chain = useRef(Promise.resolve())
  const alive = useRef(true)
  const run = () => {
    const v = latest.current
    if (v == null || saved.current === null) return
    const key = fns.current.keyOf(v)
    if (key === saved.current) return
    chain.current = chain.current.then(async () => {
      if (key === saved.current) return
      if (alive.current) setStatus('saving')
      try {
        await fns.current.save(v)
        saved.current = key
        if (alive.current) setStatus(latest.current != null && fns.current.keyOf(latest.current) === key ? 'saved' : 'pending')
      } catch (e) { if (alive.current) { setStatus('error'); toast(errorText(e), 'error') } }
    })
  }
  useEffect(() => {
    if (value == null) return
    if (saved.current === null) { saved.current = keyOf(value); return }   // just loaded
    if (keyOf(value) === saved.current) return
    setStatus('pending')
    const t = setTimeout(run, delay)
    return () => clearTimeout(t)
  }, [value])
  useEffect(() => { alive.current = true; return () => { alive.current = false; run() } }, [])
  // A different thing to save (another program): forget the old one's state.
  const reset = v => { saved.current = v == null ? null : fns.current.keyOf(v); setStatus('saved') }
  return [status, run, reset]
}

export function SaveState({ status, onRetry }) {
  return <span className={'save-state ' + status}>{status === 'saved' ? 'ذخیره شد'
    : status === 'error' ? <button className="btn plain small pressable" onClick={onRetry}>ذخیره نشد؛ دوباره امتحان کنید</button> : 'در حال ذخیره…'}</span>
}
