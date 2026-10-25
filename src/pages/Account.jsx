import { supabase } from '../lib/supabase.js'
import { useMe } from '../App.jsx'
import { phoneOfEmail, fmtPhone } from '../lib/phone.js'
import { Page } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

export default function Account() {
  const me = useMe()
  const name = me.role === 'coach' ? me.coach.full_name : me.student.full_name
  const phone = phoneOfEmail(me.session.user.email)
  return <Page title="حساب">
    <div className="section"><div className="group">
      <div className="row with-leading">
        <div className="tile-icon"><Icon name="person" filled /></div>
        <div className="content">
          <div className="title-text">{name || (me.role === 'coach' ? 'مربی' : 'شاگرد')}</div>
          <div className="sub latin" style={{ textAlign: 'right' }}>{phone ? fmtPhone(phone) : me.session.user.email}</div>
        </div>
        <span className="pill ok">{me.role === 'coach' ? 'مربی' : 'شاگرد'}</span>
      </div>
    </div></div>
    <div className="section">
      <div className="section-title">نصب روی گوشی</div>
      <div className="group">
        <div className="row with-leading"><div className="tile-icon blue"><Icon name="smartphone" /></div>
          <div className="content"><div className="title-text">اندروید (کروم)</div><div className="sub">منوی ⋮ ← «افزودن به صفحه اصلی»</div></div></div>
        <div className="row with-leading"><div className="tile-icon gray"><Icon name="share" /></div>
          <div className="content"><div className="title-text">آیفون (سافاری)</div><div className="sub">دکمه اشتراک ← Add to Home Screen</div></div></div>
      </div>
    </div>
    <div className="section"><div className="group">
      <button className="row pressable" onClick={() => supabase.auth.signOut()} style={{ color: 'var(--red)', justifyContent: 'center' }}>
        <Icon name="logout" mirror /><span className="title-text">خروج از حساب</span>
      </button>
    </div>
    <div className="section-footer" style={{ textAlign: 'center' }}>تصاویر و داده‌های حرکات: free-exercise-db (مالکیت عمومی)</div></div>
  </Page>
}
