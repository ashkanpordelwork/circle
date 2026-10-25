import { supabase } from '../lib/supabase.js'
import { useMe } from '../App.jsx'

export default function Account() {
  const me = useMe()
  const name = me.role === 'coach' ? me.coach.full_name : me.student.full_name
  return <>
    <div className="hdr"><h1>حساب</h1></div>
    <div className="card">
      <div className="t" style={{ fontWeight: 700 }}>{name || 'بدون نام'}</div>
      <div className="muted small ltr">{me.session.user.email}</div>
      <div style={{ marginTop: 8 }}><span className="pill ok">{me.role === 'coach' ? 'مربی' : 'شاگرد'}</span></div>
    </div>
    <div className="card small muted">
      برای نصب روی گوشی: در کروم منوی ⋮ ← «افزودن به صفحه اصلی»؛ در سافاری دکمه اشتراک ← «Add to Home Screen».
    </div>
    <button className="btn danger block" onClick={() => supabase.auth.signOut()}>خروج از حساب</button>
    <p className="small muted" style={{ textAlign: 'center', marginTop: 16 }}>تصاویر و داده‌های حرکات: free-exercise-db (مالکیت عمومی)</p>
  </>
}
