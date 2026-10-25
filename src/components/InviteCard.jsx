import { fmtPhone } from '../lib/phone.js'
import { useToast } from './ui.jsx'

export const appUrl = () => window.location.origin + import.meta.env.BASE_URL

export const inviteText = s =>
  `سلام ${s.full_name}! برنامه تمرینی‌ات آماده است.\n` +
  `۱. وارد این سایت شو: ${appUrl()}\n` +
  `۲. «ثبت‌نام» را بزن، شماره ${fmtPhone(s.phone)} و یک رمز دلخواه وارد کن.\n` +
  `۳. کد دعوت: ${s.invite_code}`

// What the coach sends a new student: the link, their number and their code, in one message.
export default function InviteCard({ student, onNewCode }) {
  const toast = useToast()
  const text = inviteText(student)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast('متن دعوت کپی شد') } catch { toast('کپی نشد؛ متن را دستی انتخاب کن') }
  }
  const share = () => navigator.share({ text }).catch(() => {})
  if (student.user_id) return <div className="card"><h2>ورود شاگرد</h2>
    <p className="small muted" style={{ margin: 0 }}>این شاگرد ثبت‌نام کرده و به شما وصل است. با شماره {fmtPhone(student.phone || '')} و رمز خودش وارد می‌شود.</p></div>
  return <div className="card" style={{ borderColor: 'var(--acc)' }}>
    <h2>کد دعوت</h2>
    <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '.25em', textAlign: 'center', direction: 'ltr', margin: '4px 0 10px' }}>{student.invite_code}</div>
    <p className="small muted">این پیام را برای شاگرد بفرستید. او با شماره خودش ثبت‌نام می‌کند و این کد را وارد می‌کند.</p>
    <pre className="small" style={{ whiteSpace: 'pre-wrap', background: 'var(--bg)', padding: 10, borderRadius: 10, fontFamily: 'inherit' }}>{text}</pre>
    <div className="row wrap">
      {navigator.share && <button className="btn primary grow" onClick={share}>ارسال (تلگرام، واتساپ…)</button>}
      <button className="btn grow" onClick={copy}>کپی متن</button>
      {onNewCode && <button className="btn ghost" onClick={onNewCode}>کد جدید</button>}
    </div>
  </div>
}
