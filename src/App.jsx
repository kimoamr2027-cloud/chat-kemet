import { Routes, Route, Navigate } from 'react-router-dom'
import LoginScreen from './screens/LoginScreen.jsx'
import RoomsScreen from './screens/RoomsScreen.jsx'
import RoomScreen from './screens/RoomScreen.jsx'

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<LoginScreen />} />
        <Route path="/rooms" element={<RoomsScreen />} />
        <Route path="/rooms/:roomId" element={<RoomScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
