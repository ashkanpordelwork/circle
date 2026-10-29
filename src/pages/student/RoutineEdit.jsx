import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { newItem, toPayload } from '../../lib/plan.js'
import { exerciseName } from '../../lib/exercises.js'
import { Page, Loading, Confirm, useToast, errorText } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import ItemRow from '../../components/ItemRow.jsx'
import ExercisePicker from '../../components/ExercisePicker.jsx'
import { useAutosave, SaveState } from '../../components/autosave.jsx'
import { loadPlan } from './data.js'
import { saveMine } from './Routines.jsx'

// One of the athlete's own routines: its name and exercises, saved as they change. Each exercise
// has the same editor a coach uses, rule for the next weight included.

const fa = n => Number(n).toLocaleString('fa-IR')
const keyOf = r => JSON.stringify(toPayload([{ id: r.id, name: r.name, days: [], items: r.items }]))

export default function RoutineEdit() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [r, setR] = useState(null)
  const [open, setOpen] = useState(null)
  const [picking, setPicking] = useState(false)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    loadPlan().then(all => {
      const x = all.find(y => y.id === id && y.owner === 'self')
      if (!x) { toast('این روتین پیدا نشد', 'error'); return nav('/routines', { replace: true }) }
      setR(x)
    }).catch(e => toast(errorText(e), 'error'))
  }, [id])
  const [status, retry] = useAutosave(r, keyOf, x => saveMine(x.id, x.name.trim() || 'روتین', x.items))
  if (!r) return <Page title="روتین" back="/routines"><Loading /></Page>

  const setItems = fn => setR(x => ({ ...x, items: fn(x.items) }))
  const removeAt = i => {
    const item = r.items[i]
    setItems(items => items.filter((_, k) => k !== i)); setOpen(null)
    toast(`«${exerciseName(item.exercise_id)}» حذف شد`, 'info', { label: 'بازگرداندن', onClick: () => setItems(items => [...items.slice(0, i), item, ...items.slice(i)]) })
  }
  const move = (i, d) => setItems(items => { const a = [...items]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a })

  return <Page title={r.name || 'روتین'} subtitle={<SaveState status={status} onRetry={retry} />} back="/routines"
    actions={r.items.length > 0 && <button className="btn glass interactive prominent small" onClick={() => nav('/log/' + r.id)}><Icon name="play_arrow" filled />شروع</button>}>
    <div className="field">
      <label htmlFor="rn">نام روتین</label>
      <input id="rn" className="input" value={r.name} maxLength={80} onChange={e => setR(x => ({ ...x, name: e.target.value }))} placeholder="مثلاً پا، یا فشاری" />
    </div>
    <div className="section">
      <div className="section-head">
        <div className="section-title">{fa(r.items.length)} حرکت</div>
        <button className="btn glass interactive small" onClick={() => setPicking(true)}><Icon name="add" />افزودن حرکت</button>
      </div>
      {!r.items.length
        ? <div className="card glass-lite" style={{ marginBottom: 0 }}><p className="subhead secondary" style={{ margin: 0 }}>اولین حرکت را اضافه کن. می‌توانی بعداً، حین تمرین هم حرکت اضافه کنی.</p></div>
        : <div className="group glass-lite">{r.items.map((it, i) => <ItemRow key={i + it.exercise_id} item={it} index={i} count={r.items.length}
          open={open === i} onToggle={() => setOpen(open === i ? null : i)}
          onChange={v => setItems(items => items.map((y, k) => (k === i ? v : y)))}
          onMove={d => { move(i, d); setOpen(i + d) }} onRemove={() => removeAt(i)} />)}</div>}
      <div className="section-footer">برای هر حرکت تعداد ست، تکرار و قانون پیشرفت را مشخص کن؛ وزنه‌ی هر جلسه را اپ پیشنهاد می‌دهد.</div>
    </div>
    <button className="btn glass interactive danger block" onClick={() => setConfirm(true)}><Icon name="delete" />حذف روتین</button>
    {picking && <ExercisePicker routineName={r.name} added={r.items.map(i => i.exercise_id)} onPick={x => setItems(items => [...items, newItem(x)])} onClose={() => setPicking(false)} />}
    {confirm && <Confirm title={`«${r.name}» حذف شود؟`} danger okText="حذف روتین" onClose={() => setConfirm(false)}
      text="تمرین‌هایی که با این روتین ثبت کرده‌ای در سابقه می‌ماند."
      onOk={async () => {
        try { await must(supabase.from('routines').delete().eq('id', r.id)); nav('/routines', { replace: true }) }
        catch (e) { toast(errorText(e), 'error') }
      }} />}
  </Page>
}
