import { useState } from 'react'
import { Link } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { Bell, User } from '../components/Icons.jsx'
import { Avatar, SearchBox, Tabs } from '../components/ui.jsx'
import { rooms, roomInitial } from '../data.js'
import { ar } from '../utils.js'

export default function Rooms() {
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')

  let list = rooms
  if (tab === 'active') list = [...rooms].sort((a, b) => b.online - a.online)
  if (tab === 'mine') list = rooms.filter((r) => r.mine)
  if (q.trim()) list = list.filter((r) => r.name.includes(q.trim()))

  return (
    <main className="screen">
      <header className="head head-col">
        <div className="head-row">
          <h1 className="h-big">غرف الدردشة</h1>
          <Link to="/notifications" aria-label="الإشعارات، فيه جديد" className="circle-btn">
            <Bell size={22} /><span className="red-dot" aria-hidden="true" />
          </Link>
          <Link to="/profile" aria-label="الملف الشخصي" className="circle-btn circle-gold"><User size={22} /></Link>
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="ابحث عن غرفة" />
        <Tabs tabs={[['all', 'الكل'], ['active', 'الأكثر نشاطًا'], ['mine', 'غرفي']]} value={tab} onChange={setTab} />
      </header>

      <div className="kemet-bg list">
        {list.map((r) => (
          <Link key={r.id} to={`/rooms/${r.id}`} className="card row-card">
            <Avatar text={roomInitial(r.name)} c={rooms.indexOf(r)} size={52} />
            <div className="row-body">
              <div className="row-line">
                <span className="row-title">{r.name}</span>
                <span className="row-time">{r.time}</span>
              </div>
              <span className="row-sub">{r.last}</span>
              <span className="online"><span className="green-dot" />{ar(r.online)} متصل الآن</span>
            </div>
            {r.unread > 0 && <span className="badge">{ar(r.unread)}</span>}
          </Link>
        ))}
        {list.length === 0 && <p className="empty">مفيش غرف بالاسم ده</p>}
      </div>

      <BottomNav />
    </main>
  )
}
