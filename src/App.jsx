import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { supabase, configured } from './lib/supabase.js'
import { loadExercises } from './lib/exercises.js'
import { Loading } from './components/ui.jsx'
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
  if (me === undefined) return <div className="app"><Loading /></div>
  if (me === null) return <Login />
  if (me.role === 'none') return <NotRegistered email={me.session.user.email} />

  return <Me.Provider value={{ ...me, reload }}>
    <div className="app">
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
    </div>
    <nav className="nav">
      {me.role === 'coach' ? <>
        <NavLink to="/" end><span className="i">👥</span>شاگردان</NavLink>
        <NavLink to="/account"><span className="i">⚙️</span>حساب</NavLink>
      </> : <>
        <NavLink to="/" end><span className="i">🏠</span>امروز</NavLink>
        <NavLink to="/week"><span className="i">📅</span>برنامه</NavLink>
        <NavLink to="/history"><span className="i">📈</span>سابقه</NavLink>
        <NavLink to="/weight"><span className="i">⚖️</span>وزن</NavLink>
        <NavLink to="/account"><span className="i">⚙️</span>حساب</NavLink>
      </>}
    </nav>
  </Me.Provider>
}
