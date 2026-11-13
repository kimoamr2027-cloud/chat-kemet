import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { usePresenceHeartbeat } from '../presence.js'

// بيحدّث "متصل الآن" والغرفة اللي انت فيها
export default function PresenceKeeper() {
  const { user, profile, privacy } = useAuth()
  const { pathname } = useLocation()
  const room = (/^\/rooms\/([^/]+)$/.exec(pathname) || [])[1] || ''
  usePresenceHeartbeat(user && profile ? user.uid : null, room, privacy.showOnline !== false)
  return null
}
