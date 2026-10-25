import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { isEmail, fmtDate } from '../../lib/plan.js'
import { Modal, Loading, useToast, errorText } from '../../components/ui.jsx'
import { useMe } from '../../App.jsx'

function AddStudent({ onClose, onAdded }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const add = async e => {
    e.preventDefault()
    if (!name.trim()) return toast('نام را وارد کنید.')
    if (!isEmail(email)) return toast('یک آدرس جیمیل معتبر وارد کنید.')
    setBusy(true)
    try {
      const s = await must(supabase.from('students').insert({ full_name: name.trim(), email: email.trim().toLowerCase() }).select().single())
      toast(`${s.full_name} اضافه شد`)
      onAdded(s); onClose()
    } catch (err) { toast(errorText(err)) } finally { setBusy(false) }
  }
  return <Modal onClose={onClose} label="شاگرد جدید">
    <h2 style={{ marginTop: 0 }}>شاگرد جدید</h2>
    <p className="muted small">شاگرد فقط با همین جیمیل می‌تواند وارد شود.</p>
    <form onSubmit={add}>
      <div className="field"><label htmlFor="n">نام</label><input id="n" className="input" value={name} onChange={e => setName(e.target.value)} maxLength={60} autoFocus /></div>
      <div className="field"><label htmlFor="e">جیمیل</label><input id="e" className="input ltr" dir="ltr" type="email" inputMode="email" autoCapitalize="off" placeholder="name@gmail.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
      <button className="btn primary block" disabled={busy}>افزودن شاگرد</button>
    </form>
  </Modal>
}

export default function Students() {
  const me = useMe()
  const nav = useNavigate()
  const toast = useToast()
  const [list, setList] = useState(null)
  const [last, setLast] = useState({})
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  useEffect(() => {
    (async () => {
      try {
        const students = await must(supabase.from('students').select('*').order('full_name'))
        setList(students)
        const ws = await must(supabase.from('workouts').select('student_id, date').order('date', { ascending: false }).limit(1000))
        const m = {}
        for (const w of ws) if (!m[w.student_id]) m[w.student_id] = w.date
        setLast(m)
      } catch (e) { toast(errorText(e)); setList([]) }
    })()
  }, [])
  const shown = (list || []).filter(s => !q || (s.full_name + s.email).toLowerCase().includes(q.toLowerCase()))

  return <>
    <div className="hdr">
      <div><h1>شاگردان</h1><div className="sub">سلام {me.coach.full_name || 'مربی'} 👋</div></div>
      <button className="btn primary" onClick={() => setAdding(true)}>+ شاگرد جدید</button>
    </div>
    {list && list.length > 5 && <input className="input" style={{ marginBottom: 12 }} placeholder="جستجوی شاگرد" value={q} onChange={e => setQ(e.target.value)} />}
    {!list ? <Loading /> : !list.length ? <div className="empty"><div className="big">👥</div>
      هنوز شاگردی ندارید. اولین شاگرد را با جیمیلش اضافه کنید.
      <div style={{ marginTop: 14 }}><button className="btn primary" onClick={() => setAdding(true)}>+ شاگرد جدید</button></div>
    </div> : <div className="list">{shown.map(s => <button key={s.id} className="item" onClick={() => nav('/s/' + s.id)}>
      <div style={{ fontSize: 28 }}>🧑</div>
      <div className="grow">
        <div className="t">{s.full_name}</div>
        <div className="s ltr">{s.email}</div>
        <div className="s">{last[s.id] ? 'آخرین تمرین: ' + fmtDate(last[s.id], { day: 'numeric', month: 'long' }) : 'هنوز تمرینی ثبت نکرده'}</div>
      </div>
      {!s.active ? <span className="pill bad">غیرفعال</span> : !s.user_id ? <span className="pill">هنوز وارد نشده</span> : <span className="pill ok">فعال</span>}
      <span className="muted">‹</span>
    </button>)}</div>}
    {adding && <AddStudent onClose={() => setAdding(false)} onAdded={s => setList(l => [...(l || []), s].sort((a, b) => a.full_name.localeCompare(b.full_name, 'fa')))} />}
  </>
}
