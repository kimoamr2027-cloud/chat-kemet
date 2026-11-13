import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import { rooms } from '../demoData.js'
import { loadProfile, clearProfile } from '../profile.js'

export default function RoomsScreen() {
  const navigate = useNavigate()
  const profile = loadProfile()
  const greeting = profile
    ? `${profile.gender === 'female' ? 'أهلاً بيكي' : 'أهلاً بيك'} يا ${profile.name}`
    : 'أهلاً بيك'

  function logout() {
    clearProfile()
    navigate('/')
  }

  return (
    <main className="screen">
      <header className="topbar">
        <div className="topbar-brand">
          <Logo size={36} />
          <div>
            <h1 className="topbar-title">شات كيمت</h1>
            <p className="topbar-sub">{greeting}</p>
          </div>
        </div>
        <button className="btn-ghost" onClick={logout}>خروج</button>
      </header>

      <h2 className="section-title">غرف الدردشة</h2>

      <ul className="rooms">
        {rooms.map((room) => (
          <li key={room.id}>
            <Link to={`/rooms/${room.id}`} className="card room">
              <span className="room-icon">{room.icon}</span>
              <div className="room-body">
                <div className="room-row">
                  <h3 className="room-name">{room.name}</h3>
                  <span className="room-time">{room.lastTime}</span>
                </div>
                <div className="room-row">
                  <p className="room-last">{room.lastMessage}</p>
                  {room.unread > 0 && <span className="badge">{room.unread}</span>}
                </div>
                <p className="room-meta">
                  <span className="dot" /> {room.online} متصل · {room.members} عضو
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
