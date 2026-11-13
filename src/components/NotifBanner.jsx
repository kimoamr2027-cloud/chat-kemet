import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { useLatestNotif, notifTarget, notifAction, markNotifRead, beep } from '../notifs.js'
import { useSettings } from '../store.js'

// شريط بيظهر فوق لما يجيلك إشعار جديد وانت فاتح التطبيق
export default function NotifBanner() {
  const { user, profile } = useAuth()
  const latest = useLatestNotif(user && profile ? user.uid : null)
  const [shown, setShown] = useState(null)
  const startedAt = useRef(Date.now())
  const lastKey = useRef('')
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [settings] = useSettings()

  useEffect(() => {
    if (!latest || latest.read) return
    const key = latest.id + ':' + latest.at.getTime()
    if (key === lastKey.current || latest.at.getTime() < startedAt.current - 5000) return
    lastKey.current = key
    // لو انت فاتح نفس المحادثة مش محتاج تنبيه
    if (pathname === notifTarget(latest) || pathname === '/notifications') return
    setShown(latest)
    if (settings.on?.sound !== false) beep()
  }, [latest]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(null), 4500)
    return () => clearTimeout(t)
  }, [shown])

  if (!shown) return null
  return (
    <button type="button" className="notif-banner" onClick={() => {
      markNotifRead(user.uid, shown.id)
      setShown(null)
      navigate(notifTarget(shown))
    }}>
      <b>{shown.fromName}</b> {notifAction(shown)}
      {shown.text && <span>{shown.text}</span>}
    </button>
  )
}
