import { fmtPhone } from '../lib/phone.js'
import { useToast } from './ui.jsx'
import Icon from './Icon.jsx'

export const appUrl = () => window.location.origin + import.meta.env.BASE_URL

export const inviteText = s =>
  `سلام ${s.full_name}! برنامه تمرینی‌ات آماده است.\n` +
  `۱. وارد این سایت شو: ${appUrl()}\n` +
  `۲. «ثبت‌نام» را بزن، شماره ${fmtPhone(s.phone)} و یک رمز دلخواه وارد کن.\n` +
  `۳. کد دعوت: ${s.invite_code}`

// What the coach sends a new student: link, number and code in one message.
export default function InviteCard({ student, onNewCode }) {
  const toast = useToast()
  const text = inviteText(student)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast('متن دعوت کپی شد', 'success') }
    catch { toast('کپی نشد؛ متن را دستی انتخاب کن', 'warning') }
  }
  const share = () => navigator.share({ text }).catch(() => {})
  if (student.user_id) return <div className="section"><div className="group glass-lite">
    <div className="row with-leading"><div className="tile-icon"><Icon name="check" /></div>
      <div className="content"><div className="title-text">ثبت‌نام کرده</div>
        <div className="sub">با شماره <span className="latin">{fmtPhone(student.phone || '')}</span> و رمز خودش وارد می‌شود.</div></div></div>
  </div></div>
  return <div className="card glass-lite">
    <div className="card-head"><div className="tile-icon orange"><Icon name="key" /></div>
      <div className="grow"><div className="headline">کد دعوت</div><div className="caption">شاگرد با این کد به شما وصل می‌شود</div></div></div>
    <div className="latin tnum" style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '0.3em', textAlign: 'center', margin: '0.25rem 0 0.75rem' }}>{student.invite_code}</div>
    <div className="subhead" style={{ whiteSpace: 'pre-wrap', background: 'var(--fill)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem' }}>{text}</div>
    <div className="hstack wrap">
      {navigator.share && <button className="btn glass interactive prominent grow" onClick={share}><Icon name="share" />ارسال</button>}
      <button className="btn glass interactive grow" onClick={copy}><Icon name="content_copy" />کپی متن</button>
      {onNewCode && <button className="btn plain pressable" onClick={onNewCode}><Icon name="refresh" />کد جدید</button>}
    </div>
  </div>
}
