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
import { isLoggedIn, useSettings } from './store.js'

// الشاشات دي محتاجة تسجيل دخول
function Private({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

export default function App() {
  useSettings() // بيطبق الوضع الليلي لو متفعل
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Navigate to={isLoggedIn() ? '/rooms' : '/login'} replace />} />
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
    </div>
  )
}
