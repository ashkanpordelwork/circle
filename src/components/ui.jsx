import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const show = useCallback(m => { setMsg(m); clearTimeout(show.t); show.t = setTimeout(() => setMsg(null), 2800) }, [])
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="toast" role="status">{msg}</div>}</ToastCtx.Provider>
}

export function Modal({ onClose, children, label }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [onClose])
  return <div className="modal-bg" onClick={onClose}>
    <div className="modal" role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}>{children}</div>
  </div>
}

export function Confirm({ title, text, okText = 'تأیید', danger, onOk, onClose }) {
  return <Modal onClose={onClose} label={title}>
    <h2 style={{ marginTop: 0 }}>{title}</h2>
    {text && <p className="muted">{text}</p>}
    <div className="row" style={{ marginTop: 16 }}>
      <button className={'btn grow ' + (danger ? 'danger' : 'primary')} onClick={() => { onClose(); onOk() }}>{okText}</button>
      <button className="btn grow" onClick={onClose}>انصراف</button>
    </div>
  </Modal>
}

export const Loading = () => <div className="empty"><div className="big">⏳</div>در حال بارگذاری…</div>

// Supabase / Postgres errors in words a coach or student can act on.
export function errorText(e) {
  const m = String(e?.message || e || '')
  if (e?.code === '23505' || /duplicate key/.test(m)) return 'این جیمیل قبلاً ثبت شده است.'
  if (e?.code === '42501' || /row-level security|permission denied/.test(m)) return 'اجازه این کار را ندارید.'
  if (/Failed to fetch|NetworkError/.test(m)) return 'اتصال به اینترنت برقرار نیست.'
  return m || 'خطایی رخ داد.'
}
