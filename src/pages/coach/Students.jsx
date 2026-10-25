import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, must } from '../../lib/supabase.js'
import { fmtDate } from '../../lib/plan.js'
import { isPhone, normPhone, fmtPhone } from '../../lib/phone.js'
import { Page, Loading, Empty, useToast, errorText } from '../../components/ui.jsx'
import Sheet from '../../components/Sheet.jsx'
import Icon, { Disclosure } from '../../components/Icon.jsx'
import InviteCard from '../../components/InviteCard.jsx'
import { useMe } from '../../App.jsx'

function AddStudent({ onClose, onAdded }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(null)
  const phoneBad = phone.length >= 4 && !isPhone(phone)
  const add = async e => {
    e.preventDefault()
    if (!name.trim()) return toast('نام را وارد کنید.', 'warning')
    if (!isPhone(phone)) return toast('شماره موبایل معتبر وارد کنید.', 'warning')
    setBusy(true)
    try {
      const s = await must(supabase.from('students').insert({ full_name: name.trim(), phone: normPhone(phone) }).select().single())
      onAdded(s); setAdded(s); toast(`${s.full_name} اضافه شد`, 'success')
    } catch (err) { toast(errorText(err), 'error') } finally { setBusy(false) }
  }
  return <Sheet title={added ? 'دعوت شاگرد' : 'شاگرد جدید'} onClose={onClose}>
    {added ? <InviteCard student={added} /> : <form onSubmit={add}>
      <p className="subhead secondary" style={{ marginTop: 0 }}>بعد از افزودن، یک کد دعوت می‌گیرید که برای شاگرد می‌فرستید.</p>
      <div className="field"><label htmlFor="n">نام</label><input id="n" className="input" value={name} onChange={e => setName(e.target.value)} maxLength={60} autoFocus /></div>
      <div className="field"><label htmlFor="p">شماره موبایل</label>
        <input id="p" className="input ltr" type="tel" inputMode="tel" placeholder="0912 123 4567" value={phone} onChange={e => setPhone(e.target.value)} aria-invalid={phoneBad} />
        {phoneBad && <div className="caption" style={{ color: 'var(--red)' }}>شماره ۱۱ رقمی با ۰۹ شروع می‌شود.</div>}</div>
      <button className="btn glass interactive prominent block" disabled={busy}><Icon name="person_add" />افزودن شاگرد</button>
    </form>}
  </Sheet>
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
        setList(await must(supabase.from('students').select('*').order('full_name')))
        const ws = await must(supabase.from('workouts').select('student_id, date').order('date', { ascending: false }).limit(1000))
        const m = {}
        for (const w of ws) if (!m[w.student_id]) m[w.student_id] = w.date
        setLast(m)
      } catch (e) { toast(errorText(e), 'error'); setList([]) }
    })()
  }, [])
  const shown = (list || []).filter(s => !q || (s.full_name + (s.phone || '')).toLowerCase().includes(q.toLowerCase()))
  const addBtn = <button className="icon-btn glass interactive" onClick={() => setAdding(true)} aria-label="شاگرد جدید"><Icon name="person_add" /></button>

  return <Page title="شاگردان" subtitle={`سلام ${me.coach.full_name || 'مربی'}`} actions={addBtn}>
    {list && list.length > 5 && <div className="field">
      <input className="input" placeholder="جستجوی نام یا شماره" value={q} onChange={e => setQ(e.target.value)} aria-label="جستجوی شاگرد" /></div>}
    {!list ? <Loading /> : !list.length ? <>
      <Empty icon="group" title="هنوز شاگردی ندارید">اولین شاگرد را با شماره موبایلش اضافه کنید.</Empty>
      <button className="btn glass interactive prominent block" onClick={() => setAdding(true)}><Icon name="person_add" />شاگرد جدید</button>
    </> : <div className="section">
      <div className="section-title">{list.length.toLocaleString('fa-IR')} شاگرد</div>
      <div className="group glass-lite">{shown.map(s => <button key={s.id} className="row with-leading pressable" onClick={() => nav('/s/' + s.id)}>
        <div className={'tile-icon' + (s.user_id && s.active ? '' : ' gray')}><Icon name="person" filled /></div>
        <div className="content">
          <div className="title-text">{s.full_name}</div>
          <div className="sub">{!s.active ? 'غیرفعال' : !s.user_id ? 'هنوز ثبت‌نام نکرده' : last[s.id] ? 'آخرین تمرین ' + fmtDate(last[s.id], { day: 'numeric', month: 'long' }) : 'هنوز تمرینی ثبت نکرده'}</div>
        </div>
        <div className="trailing"><span className="latin caption">{s.phone ? fmtPhone(s.phone) : ''}</span><Disclosure /></div>
      </button>)}</div>
    </div>}
    {adding && <AddStudent onClose={() => setAdding(false)} onAdded={s => setList(l => [...(l || []), s].sort((a, b) => a.full_name.localeCompare(b.full_name, 'fa')))} />}
  </Page>
}
