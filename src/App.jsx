import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { supabase, configured } from './lib/supabase.js'
import { loadExercises } from './lib/exercises.js'
import { Loading, Page } from './components/ui.jsx'
import IntakeSummary from './components/IntakeSummary.jsx'
import Icon from './components/Icon.jsx'
import GlassDrop from './components/GlassDrop.jsx'
import Login, { NotRegistered, NotConfigured } from './pages/Login.jsx'
import Students from './pages/coach/Students.jsx'
import Dashboard from './pages/coach/Dashboard.jsx'
import StudentPage from './pages/coach/StudentPage.jsx'
import Today from './pages/student/Today.jsx'
import Week from './pages/student/Week.jsx'
import LogWorkout from './pages/student/LogWorkout.jsx'
import History from './pages/student/History.jsx'
import Weight from './pages/student/Weight.jsx'
import Account from './pages/Account.jsx'
import Intake from './pages/student/Intake.jsx'

// Who is signed in: { session, role: 'coach' | 'student' | 'none', coach?, student? }
const Me = createContext(null)
export const useMe = () => useContext(Me)

async function resolveRole(session) {
  const uid = session.user.id
  const [{ data: coach }, { data: student }] = await Promise.all([
    supabase.from('coaches').select('*').eq('id', uid).maybeSingle(),
    supabase.from('students').select('*').eq('user_id', uid).maybeSingle()
  ])
  if (coach) return { session, role: 'coach', coach }
  if (student) {
    // Before migration 0004 there is no intakes table: the questionnaire is skipped, not a wall.
    const { data: intake, error } = await supabase.from('intakes').select('answers, completed_at').eq('student_id', student.id).maybeSingle()
    return { session, role: 'student', student, intake: error ? { skipped: true } : intake }
  }
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
  const setIntake = answers => setMe(m => ({ ...m, intake: { answers, completed_at: new Date().toISOString() } }))
  // A new student answers the questionnaire once before seeing the plan.
  if (me.role === 'student' && !me.intake?.completed_at && !me.intake?.skipped) {
    return <Intake student={me.student} initial={me.intake?.answers} onDone={setIntake} />
  }

  return <Me.Provider value={{ ...me, reload, setIntake }}>
    {me.role === 'coach' ? <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/students" element={<Students />} />
      <Route path="/s/:id" element={<StudentPage />} />
      <Route path="/account" element={<Account />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes> : <Routes>
      <Route path="/" element={<Today />} />
      <Route path="/week" element={<Week />} />
      <Route path="/log/:routineId" element={<LogWorkout />} />
      <Route path="/history" element={<History />} />
      <Route path="/weight" element={<Weight />} />
      <Route path="/intake" element={<IntakeView />} />
      <Route path="/intake/edit" element={<EditIntake />} />
      <Route path="/account" element={<Account />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>}
    {/* A workout in progress owns the screen: no tabs to wander off into. */}
    {!loc.pathname.startsWith('/log/') && loc.pathname !== '/intake/edit' && <TabBar tabs={me.role === 'coach'
      ? [['/', 'dashboard', 'داشبورد'], ['/students', 'group', 'شاگردان', '/s/'], ['/account', 'person', 'حساب']]
      : [['/', 'today', 'امروز'], ['/week', 'calendar_month', 'برنامه'], ['/history', 'history', 'سابقه'], ['/weight', 'monitor_weight', 'وزن'], ['/account', 'person', 'حساب', '/intake']]} />}
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
  const index = tabs.findIndex(([to, , , also]) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to) || (also && loc.pathname.startsWith(also))))
  return <nav ref={box} className="tabbar glass" aria-label="بخش‌ها">
    <GlassDrop container={box} selector="a" index={index} className="drop" />
    {tabs.map(([to, icon, label], i) => <NavLink key={to} to={to} end={to === '/'} className={i === index ? 'active' : ''} aria-current={i === index ? 'page' : undefined}>
      <Icon name={icon} filled={i === index} /><span>{label}</span>
    </NavLink>)}
  </nav>
}
