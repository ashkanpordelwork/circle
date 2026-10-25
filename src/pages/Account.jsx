import { supabase } from '../lib/supabase.js'
import { useMe } from '../App.jsx'
import { phoneOfEmail, fmtPhone } from '../lib/phone.js'
import { useState } from 'react'
import { Page, Segmented } from '../components/ui.jsx'
import { getThemePref, setThemePref } from '../lib/theme.js'
import Icon, { Disclosure } from '../components/Icon.jsx'
import { Link } from 'react-router-dom'

export default function Account() {
  const me = useMe()
  const name = me.role === 'coach' ? me.coach.full_name : me.student.full_name
  const phone = phoneOfEmail(me.session.user.email)
  const [theme, setTheme] = useState(getThemePref)
  const pickTheme = t => { setTheme(t); setThemePref(t) }
  return <Page title="حساب">
    <div className="section"><div className="group glass-lite">
      <div className="row with-leading">
        <div className="tile-icon"><Icon name="person" filled /></div>
        <div className="content">
          <div className="title-text">{name || (me.role === 'coach' ? 'مربی' : 'شاگرد')}</div>
          <div className="sub latin" style={{ textAlign: 'right' }}>{phone ? fmtPhone(phone) : me.session.user.email}</div>
        </div>
        <span className="pill ok">{me.role === 'coach' ? 'مربی' : 'شاگرد'}</span>
      </div>
    </div></div>
    {me.role === 'student' && !me.intake?.skipped && <div className="section"><div className="group glass-lite">
      <Link to="/intake" className="row pressable with-leading">
        <div className="tile-icon blue"><Icon name="assignment" /></div>
        <div className="content"><div className="title-text">پرسشنامه من</div><div className="sub">هدف، آسیب‌ها، بیماری‌ها و تغذیه</div></div>
        <Disclosure />
      </Link>
    </div><div className="section-footer">اگر چیزی تغییر کرد (مثلاً آسیب جدید)، اینجا به‌روزش کن تا مربی بداند.</div></div>}
    <div className="section">
      <div className="section-title">ظاهر</div>
      <Segmented label="ظاهر برنامه" value={theme} onChange={pickTheme}
        options={[{ value: 'dark', label: 'تیره' }, { value: 'light', label: 'روشن' }, { value: 'auto', label: 'خودکار' }]} />
      <div className="section-footer">{theme === 'auto' ? 'مثل تنظیمات گوشی، روشن یا تیره می‌شود.' : 'این انتخاب روی همین دستگاه ذخیره می‌شود.'}</div>
    </div>
    <div className="section"><div className="group glass-lite">
      <button className="row pressable" onClick={() => supabase.auth.signOut()} style={{ color: 'var(--red)', justifyContent: 'center' }}>
        <Icon name="logout" mirror /><span className="title-text">خروج از حساب</span>
      </button>
    </div>
    <div className="section-footer" style={{ textAlign: 'center' }}>تصاویر و داده‌های حرکات: free-exercise-db (مالکیت عمومی)</div></div>
  </Page>
}
