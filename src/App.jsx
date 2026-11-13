import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './screens/Login.jsx'
import Rooms from './screens/Rooms.jsx'
import Room from './screens/Room.jsx'
import Messages from './screens/Messages.jsx'
import DM from './screens/DM.jsx'
import Profile from './screens/Profile.jsx'
import Notifications from './screens/Notifications.jsx'
import Settings from './screens/Settings.jsx'
import { useSettings } from './store.js'
import { AuthProvider, useAuth } from './auth.jsx'
import pyramids from './assets/pyramids.png'
import NotifBanner from './components/NotifBanner.jsx'
import UpdateBar from './components/UpdateBar.jsx'

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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
      </AuthProvider>
    </div>
  )
}
