import { NavLink } from 'react-router-dom'
import { Home, Chat, User, DiceIc } from './Icons.jsx'
import { useAuth } from '../auth.jsx'
import { useChats } from '../dm.js'
import { ar } from '../utils.js'

export default function BottomNav() {
  const cls = ({ isActive }) => `nav-item ${isActive ? 'nav-on' : ''}`
  const { user } = useAuth()
  const { chats } = useChats(user.uid)
  const unread = (chats || []).reduce((n, c) => n + (c.unread?.[user.uid] || 0), 0)
  return (
    <nav className="bottom-nav">
      <NavLink to="/rooms" className={cls}><Home />الغرف</NavLink>
      <NavLink to="/messages" className={cls}>
        <span className="nav-icon"><Chat />{unread > 0 && <span className="nav-badge">{unread > 99 ? '٩٩+' : ar(unread)}</span>}</span>
        الرسائل
      </NavLink>
      <NavLink to="/games" className={cls}><DiceIc />الألعاب</NavLink>
      <NavLink to="/profile" className={cls}><User />حسابي</NavLink>
    </nav>
  )
}
