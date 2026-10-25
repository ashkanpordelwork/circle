import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { supabase, configured } from './lib/supabase.js'
import { loadExercises } from './lib/exercises.js'
import { Loading } from './components/ui.jsx'
import Icon from './components/Icon.jsx'
import GlassDrop from './components/GlassDrop.jsx'
import Login, { NotRegistered, NotConfigured } from './pages/Login.jsx'
import Students from './pages/coach/Students.jsx'
import StudentPage from './pages/coach/StudentPage.jsx'
import Today from './pages/student/Today.jsx'
import Week from './pages/student/Week.jsx'
import LogWorkout from './pages/student/LogWorkout.jsx'
import History from './pages/student/History.jsx'
import Weight from './pages/student/Weight.jsx'
import Account from './pages/Account.jsx'

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
  if (student) return { session, role: 'student', student }
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

  return <Me.Provider value={{ ...me, reload }}>
    {me.role === 'coach' ? <Routes>
      <Route path="/" element={<Students />} />
      <Route path="/s/:id" element={<StudentPage />} />
      <Route path="/account" element={<Account />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes> : <Routes>
      <Route path="/" element={<Today />} />
      <Route path="/week" element={<Week />} />
      <Route path="/log/:routineId" element={<LogWorkout />} />
      <Route path="/history" element={<History />} />
      <Route path="/weight" element={<Weight />} />
      <Route path="/account" element={<Account />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>}
    {/* A workout in progress owns the screen: no tabs to wander off into. */}
    {!loc.pathname.startsWith('/log/') && <TabBar tabs={me.role === 'coach'
      ? [['/', 'group', 'شاگردان'], ['/account', 'person', 'حساب']]
      : [['/', 'today', 'امروز'], ['/week', 'calendar_month', 'برنامه'], ['/history', 'history', 'سابقه'], ['/weight', 'monitor_weight', 'وزن'], ['/account', 'person', 'حساب']]} />}
  </Me.Provider>
}

// A floating glass capsule; a droplet of glass sits under the current tab and slides to the next.
function TabBar({ tabs }) {
  const loc = useLocation()
  const box = useRef(null)
  const index = tabs.findIndex(([to]) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to)))
  return <nav ref={box} className="tabbar glass" aria-label="بخش‌ها">
    <GlassDrop container={box} selector="a" index={index} className="drop" />
    {tabs.map(([to, icon, label]) => <NavLink key={to} to={to} end={to === '/'}>
      {({ isActive }) => <><Icon name={icon} filled={isActive} /><span>{label}</span></>}
    </NavLink>)}
  </nav>
}
