import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Suspense, lazy as lazyReact, useEffect } from 'react'
import Login from './screens/Login.jsx'
import Rooms from './screens/Rooms.jsx'
import Room from './screens/Room.jsx'
import { useSettings } from './store.js'

// الصفحات دي بتتحمّل لما تفتحها بس (علشان التطبيق يفتح أسرع)
// لو اتنشرت نسخة جديدة والملف القديم مبقاش موجود: نعمل تحديث للصفحة مرة واحدة
const lazy = (f) => lazyReact(() => f().catch((e) => {
  if (!sessionStorage.getItem('kemet-chunk-reload')) {
    sessionStorage.setItem('kemet-chunk-reload', '1')
    window.location.reload()
    return new Promise(() => {})
  }
  throw e
}))
const Messages = lazy(() => import('./screens/Messages.jsx'))
const DM = lazy(() => import('./screens/DM.jsx'))
const Profile = lazy(() => import('./screens/Profile.jsx'))
const Notifications = lazy(() => import('./screens/Notifications.jsx'))
const Settings = lazy(() => import('./screens/Settings.jsx'))
const Admin = lazy(() => import('./screens/Admin.jsx'))
const UserProfile = lazy(() => import('./screens/UserProfile.jsx'))
const Games = lazy(() => import('./screens/Games.jsx'))
const LudoTable = lazy(() => import('./screens/LudoTable.jsx'))
const SnakesTable = lazy(() => import('./screens/SnakesTable.jsx'))
const DominoTable = lazy(() => import('./screens/DominoTable.jsx'))
import { AuthProvider, useAuth } from './auth.jsx'
import pyramids from './assets/pyramids.png'
import NotifBanner from './components/NotifBanner.jsx'
import UpdateBar from './components/UpdateBar.jsx'
import PresenceKeeper from './components/PresenceKeeper.jsx'

function Splash() {
  return (
    <main className="screen splash">
      <img src={pyramids} alt="" />
      <p>شات كيمت</p>
    </main>
  )
}

// الشاشات دي محتاجة تسجيل دخول وبيانات كاملة
function Private({ children }) {
  const { user, profile } = useAuth()
  if (user === undefined || (user && profile === undefined)) return <Splash />
  if (!user || !profile) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <Suspense fallback={<main className="screen" />}>
    <Routes>
      <Route path="/" element={<Navigate to="/rooms" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/rooms" element={<Private><Rooms /></Private>} />
      <Route path="/rooms/:id" element={<Private><Room /></Private>} />
      <Route path="/messages" element={<Private><Messages /></Private>} />
      <Route path="/dm/:id" element={<Private><DM /></Private>} />
      <Route path="/profile" element={<Private><Profile /></Private>} />
      <Route path="/notifications" element={<Private><Notifications /></Private>} />
      <Route path="/settings" element={<Private><Settings /></Private>} />
      <Route path="/admin" element={<Private><Admin /></Private>} />
      <Route path="/games" element={<Private><Games /></Private>} />
      <Route path="/ludo/:id" element={<Private><LudoTable /></Private>} />
      <Route path="/snakes/:id" element={<Private><SnakesTable /></Private>} />
      <Route path="/domino/:id" element={<Private><DominoTable /></Private>} />
      <Route path="/u/:uid" element={<Private><UserProfile /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}

export default function App() {
  useSettings() // بيطبق الوضع الليلي لو متفعل
  return (
    <div className="app">
      <AuthProvider>
        <AppRoutes />
        <NotifBanner />
        <UpdateBar />
        <PresenceKeeper />
      </AuthProvider>
    </div>
  )
}
