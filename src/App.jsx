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
import Routines from './pages/student/Routines.jsx'
import RoutineEdit from './pages/student/RoutineEdit.jsx'
import CoachLink from './pages/student/CoachLink.jsx'
import Body from './pages/student/Body.jsx'
import Apply from './pages/student/Apply.jsx'
import { StartSheet, MoreSheet } from './pages/student/sheets.jsx'
import Account from './pages/Account.jsx'
import Intake from './pages/student/Intake.jsx'
import { AdminHome, AdminPeople, AdminUser, AdminActivity, AdminApplications } from './pages/admin/Admin.jsx'
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
  // A student a coach registered answers the questionnaire once before seeing the plan. An athlete who
  // started alone is not stopped by it: «امروز» offers it once they have a coach (it is for a coach).
  if (me.role === 'student' && me.student.coach_id && !me.student.self_started && !me.intake?.completed_at && !me.intake?.skipped) {
    return <Intake student={me.student} initial={me.intake?.answers} onDone={setIntake} />
  }

  const setCoach = coach => setMe(m => ({ ...m, coach }))
  // The admin's pages sit beside whatever else this person is; an admin opens any student's page.
  const adminRoutes = me.admin && <>
    <Route path="/admin" element={<AdminHome />} />
    <Route path="/admin/people" element={<AdminPeople />} />
    {/* Coaches, students and accounts were three lists, and a coach had a page apart from their account. */}
    <Route path="/admin/coaches" element={<Navigate to="/admin/people?f=coach" replace />} />
    <Route path="/admin/students" element={<Navigate to="/admin/people?f=student" replace />} />
    <Route path="/admin/users" element={<Navigate to="/admin/people" replace />} />
    <Route path="/admin/c/:id" element={<AdminUser />} />
    <Route path="/admin/u/:id" element={<AdminUser />} />
    <Route path="/admin/activity" element={<AdminActivity />} />
    <Route path="/admin/applications" element={<AdminApplications />} />
    <Route path="/s/:id" element={<StudentPage />} />
  </>
  const tabs = me.role === 'coach'
    // A coach who is also the admin reaches the admin panel from «حساب»; the tab bar stays the coach's.
    ? [['/', 'group', 'شاگردان', '/s/'], ['/account', 'person', 'حساب', '/admin']]
    : me.role === 'admin'
      ? [['/admin', 'admin_panel_settings', 'مدیریت', '/s/'], ['/account', 'person', 'حساب']]
      // The athlete's: two tabs either side of the lime start button, and «بیشتر» for the rest.
      : [['/', 'home', 'امروز'], ['/routines', 'list_alt', 'روتین'], ['start', 'fitness_center', 'شروع'], ['/stats', 'monitoring', 'آمار', ['/progress', '/body']], ['more', 'more_horiz', 'بیشتر', ['/account', '/coach', '/intake', '/admin', '/apply']]]
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
      <Route path="/routines" element={<Routines />} />
      <Route path="/routines/:id" element={<RoutineEdit />} />
      <Route path="/stats" element={<Progress />} />
      <Route path="/coach" element={<CoachLink />} />
      <Route path="/body" element={<Body />} />
      <Route path="/apply" element={<Apply />} />
      <Route path="/progress" element={<Navigate to="/stats" replace />} />
      <Route path="/history" element={<Navigate to="/stats" replace />} />
      <Route path="/weight" element={<Navigate to="/stats" replace />} />
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
  // An athlete who joined a coach fills it the first time from here too (the card on «امروز»).
  const first = !me.intake?.completed_at
  if (first && !me.student?.coach_id) return <Navigate to="/account" replace />
  return <Intake student={me.student} initial={me.intake?.answers} onCancel={() => nav(first ? '/' : '/intake')} onDone={a => { me.setIntake(a); nav(first ? '/' : '/intake', { replace: true }) }} />
}

// A floating glass capsule; a droplet of glass sits under the current tab and slides to the next.
function TabBar({ tabs }) {
  const loc = useLocation()
  const box = useRef(null)
  const [sheet, setSheet] = useState(null)   // 'start' | 'more'
  // «امروز» without a routine offers an instant workout: the same sheet as the lime button.
  useEffect(() => { const f = () => setSheet('start'); document.addEventListener('start-workout', f); return () => document.removeEventListener('start-workout', f) }, [])
  // A tab may also own other paths (a student's page belongs to «شاگردان»). The lime start
  // button is not a place, so it never holds the droplet.
  const owns = (to, also) => (to === '/' ? loc.pathname === '/' : to.startsWith('/') && loc.pathname.startsWith(to))
    || [].concat(also || []).some(a => loc.pathname.startsWith(a))
  const places = tabs.filter(([to]) => to !== 'start')
  const index = places.findIndex(([to, , , also]) => owns(to, also))
  return <nav ref={box} className={'tabbar glass' + (tabs.some(([to]) => to === 'start') ? ' with-start' : '')} aria-label="بخش‌ها">
    <GlassDrop container={box} selector=".tab" index={index} className="drop" />
    {tabs.map(([to, icon, label, also]) => {
      if (to === 'start') return <button key={to} className="tab-start pressable" onClick={() => setSheet('start')} aria-label="شروع تمرین"><Icon name={icon} filled /></button>
      const on = owns(to, also)
      if (to === 'more') return <button key={to} className={'tab' + (on ? ' active' : '')} onClick={() => setSheet('more')} aria-current={on ? 'page' : undefined}>
        <Icon name={icon} filled={on} /><span>{label}</span></button>
      return <NavLink key={to} to={to} end={to === '/'} className={'tab' + (on ? ' active' : '')} aria-current={on ? 'page' : undefined}>
        <Icon name={icon} filled={on} /><span>{label}</span>
      </NavLink>
    })}
    {sheet === 'start' && <StartSheet onClose={() => setSheet(null)} />}
    {sheet === 'more' && <MoreSheet onClose={() => setSheet(null)} />}
  </nav>
}
