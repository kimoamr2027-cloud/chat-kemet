import { NavLink } from 'react-router-dom'
import { Home, Chat, User } from './Icons.jsx'

export default function BottomNav() {
  const cls = ({ isActive }) => `nav-item ${isActive ? 'nav-on' : ''}`
  return (
    <nav className="bottom-nav">
      <NavLink to="/rooms" className={cls}><Home />الغرف</NavLink>
      <NavLink to="/messages" className={cls}><Chat />الرسائل</NavLink>
      <NavLink to="/profile" className={cls}><User />حسابي</NavLink>
    </nav>
  )
}
