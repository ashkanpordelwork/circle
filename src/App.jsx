import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { supabase, configured } from './lib/supabase.js'
import { loadExercises } from './lib/exercises.js'
import { Loading, Page } from './components/ui.jsx'
import IntakeSummary from './components/IntakeSummary.jsx'
import Icon from './components/Icon.jsx'
import GlassDrop from './components/GlassDrop.jsx'
import Login, { NotRegistered, NotConfigured, Stopped } from './pages/Login.jsx'
import Students from './pages/coach/Students.jsx'
import StudentPage from './pages/coach/StudentPage.jsx'
import Today from './pages/student/Today.jsx'
import LogWorkout from './pages/student/LogWorkout.jsx'
import Progress from './pages/student/Progress.jsx'
import Account from './pages/Account.jsx'
import Intake from './pages/student/Intake.jsx'
import { AdminHome, AdminCoaches, AdminCoach, AdminStudents, AdminUsers, AdminUser, AdminActivity } from './pages/admin/Admin.jsx'
import { setScope } from './lib/scope.js'

// Who is signed in: { session, role: 'coach' | 'student' | 'admin' | 'stopped' | 'none', admin, coach?, student? }
//   admin    the system's owner (0005_admin.sql); also a coach or student when they are one too
//   stopped  a coach whose access an admin switched off
const Me = createContext(null)
export const useMe = () => useContext(Me)

async function resolveRole(session) {
  const uid = session.user.id
  const [{ data: coach }, { data: student }, { data: admin }] = await Promise.all([
    supabase.from('coaches').select('*').eq('id', uid).maybeSingle(),
    supabase.from('students').select('*').eq('user_id', uid).maybeSingle(),
    supabase.rpc('is_admin')   // before migration 0005 this fails, and nobody is an admin
  ])
  const isAdmin = admin === true
  setScope(uid, student?.id ?? null)
  if (coach && coach.active !== false) return { session, role: 'coach', coach, admin: isAdmin }
  if (student) {
    // Before migration 0004 there is no intakes table: the questionnaire is skipped, not a wall.
    const { data: intake, error } = await supabase.from('intakes').select('answers, completed_at').eq('student_id', student.id).maybeSingle()
    return { session, role: 'student', student, intake: error ? { skipped: true } : intake, admin: isAdmin }
  }
  if (isAdmin) return { session, role: 'admin', admin: true, coach: coach || null }
  if (coach) return { session, role: 'stopped', coach }
  return { session, role: 'none' }
}

export default function App() {
  const loc = useLocation()
  const [me, setMe] = useState(undefined)   // undefined = still finding out, null = signed out
  const reload = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setMe(session ? await resolveRole(session) : null)
  }
  useEffect(() => {
    if (!configured) return
    reload()
    loadExercises()   // warm the library while the first screen loads
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setMe(null)
      else if (event === 'SIGNED_IN' && session) resolveRole(session).then(setMe)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!configured) return <NotConfigured />
  if (me === undefined) return <Loading />
  if (me === null) return <Login />
  if (me.role === 'none') return <NotRegistered email={me.session.user.email} />
  if (me.role === 'stopped') return <Stopped />
  const setIntake = answers => setMe(m => ({ ...m, intake: { answers, completed_at: new Date().toISOString() } }))
  // A new student answers the questionnaire once before seeing the plan.
  if (me.role === 'student' && !me.intake?.completed_at && !me.intake?.skipped) {
    return <Intake student={me.student} initial={me.intake?.answers} onDone={setIntake} />
  }

  const setCoach = coach => setMe(m => ({ ...m, coach }))
  // The admin's pages sit beside whatever else this person is; an admin opens any student's page.
  const adminRoutes = me.admin && <>
    <Route path="/admin" element={<AdminHome />} />
    <Route path="/admin/coaches" element={<AdminCoaches />} />
    <Route path="/admin/c/:id" element={<AdminCoach />} />
    <Route path="/admin/students" element={<AdminStudents />} />
    <Route path="/admin/users" element={<AdminUsers />} />
    <Route path="/admin/u/:id" element={<AdminUser />} />
    <Route path="/admin/activity" element={<AdminActivity />} />
    <Route path="/s/:id" element={<StudentPage />} />
  </>
  const tabs = me.role === 'coach'
    // A coach who is also the admin reaches the admin panel from «حساب»; the tab bar stays the coach's.
    ? [['/', 'group', 'شاگردان', '/s/'], ['/account', 'person', 'حساب', '/admin']]
    : me.role === 'admin'
      ? [['/admin', 'admin_panel_settings', 'مدیریت', '/s/'], ['/account', 'person', 'حساب']]
      : [['/', 'today', 'امروز'], ['/progress', 'monitoring', 'پیشرفت'], ['/account', 'person', 'حساب', '/intake']]
  return <Me.Provider value={{ ...me, reload, setIntake, setCoach }}>
    {me.role === 'coach' ? <Routes>
      {/* «داشبورد» and «شاگردان» were two tabs once; the students list is the home now. */}
      <Route path="/" element={<Students />} />
      <Route path="/students" element={<Navigate to="/" replace />} />
      <Route path="/s/:id" element={<StudentPage />} />
      <Route path="/account" element={<Account />} />
      {adminRoutes}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes> : me.role === 'admin' ? <Routes>
      {adminRoutes}
      <Route path="/account" element={<Account />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes> : <Routes>
      <Route path="/" element={<Today />} />
      {/* «برنامه», «سابقه» and «وزن» were tabs once; old links land where they went. */}
      <Route path="/week" element={<Navigate to="/" replace />} />
      <Route path="/log/:routineId" element={<LogWorkout />} />
      <Route path="/progress" element={<Progress />} />
      <Route path="/history" element={<Navigate to="/progress" replace />} />
      <Route path="/weight" element={<Navigate to="/progress" replace />} />
      <Route path="/intake" element={<IntakeView />} />
      <Route path="/intake/edit" element={<EditIntake />} />
      <Route path="/account" element={<Account />} />
      {me.admin && <>{adminRoutes}</>}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>}
    {/* A workout in progress owns the screen: no tabs to wander off into. */}
    {!loc.pathname.startsWith('/log/') && loc.pathname !== '/intake/edit' && <TabBar tabs={tabs} />}
  </Me.Provider>
}

// The student reads their answers from «حساب», laid out like the coach sees them…
function IntakeView() {
  const me = useMe()
  const nav = useNavigate()
  if (!me.intake?.completed_at) return <Navigate to="/account" replace />
  return <Page title="پرسشنامه من" back="/account"
    actions={<button className="btn glass interactive small" onClick={() => nav('/intake/edit')}><Icon name="edit_note" />ویرایش</button>}>
    <IntakeSummary intake={me.intake} own />
    <div className="section-footer">اگر چیزی تغییر کرد (مثلاً آسیب جدید)، ویرایشش کن تا مربی بداند.</div>
  </Page>
}

// …and changes them with the same steps they answered first.
function EditIntake() {
  const me = useMe()
  const nav = useNavigate()
  if (!me.intake?.completed_at) return <Navigate to="/account" replace />
  return <Intake student={me.student} initial={me.intake?.answers} onCancel={() => nav('/intake')} onDone={a => { me.setIntake(a); nav('/intake', { replace: true }) }} />
}

// A floating glass capsule; a droplet of glass sits under the current tab and slides to the next.
function TabBar({ tabs }) {
  const loc = useLocation()
  const box = useRef(null)
  // A tab may also own other paths (a student's page belongs to «شاگردان»).
  const index = tabs.findIndex(([to, , , also]) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to)) || (also && loc.pathname.startsWith(also)))
  return <nav ref={box} className="tabbar glass" aria-label="بخش‌ها">
    <GlassDrop container={box} selector="a" index={index} className="drop" />
    {tabs.map(([to, icon, label], i) => <NavLink key={to} to={to} end={to === '/'} className={i === index ? 'active' : ''} aria-current={i === index ? 'page' : undefined}>
      <Icon name={icon} filled={i === index} /><span>{label}</span>
    </NavLink>)}
  </nav>
}
