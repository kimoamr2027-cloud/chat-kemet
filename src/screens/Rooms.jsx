import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { Bell, User } from '../components/Icons.jsx'
import { Avatar, SearchBox, Tabs } from '../components/ui.jsx'
import { roomInitial } from '../data.js'
import { useRooms, useLastMessage, fmtWhen } from '../rooms.js'
import { useAuth } from '../auth.jsx'
import { useUnreadNotifs } from '../notifs.js'

function RoomCard({ room, onLast }) {
  const last = useLastMessage(room.id)
  useEffect(() => { onLast(room.id, last?.at?.getTime() || 0) }, [last?.at?.getTime()])
  const lastText = last === undefined ? '...'
    : last === null ? 'مفيش رسايل لسه — ابدأ انت'
    : `${last.name}: ${last.kind === 'sticker' ? 'ستيكر' : last.text}`
  return (
    <Link to={`/rooms/${room.id}`} className="card row-card">
      <Avatar text={roomInitial(room.name)} c={(room.order || 1) - 1} size={52} />
      <div className="row-body">
        <div className="row-line">
          <span className="row-title">{room.name}</span>
          <span className="row-time">{last ? fmtWhen(last.at) : ''}</span>
        </div>
        <span className="row-sub">{lastText}</span>
      </div>
    </Link>
  )
}

export default function Rooms() {
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const { rooms, error } = useRooms()
  const { user, profile } = useAuth()
  const unreadNotifs = useUnreadNotifs(user.uid)
  const [lastAt, setLastAt] = useState({})
  const onLast = (id, t) => setLastAt((m) => (m[id] === t ? m : { ...m, [id]: t }))

  let list = rooms || []
  if (tab === 'active') list = [...list].sort((a, b) => (lastAt[b.id] || 0) - (lastAt[a.id] || 0))
  if (tab === 'mine') { const mine = profile.rooms || []; list = list.filter((r) => mine.includes(r.id)) }
  if (q.trim()) list = list.filter((r) => r.name.includes(q.trim()))

  return (
    <main className="screen">
      <header className="head head-col">
        <div className="head-row">
          <h1 className="h-big">غرف الدردشة</h1>
          <Link to="/notifications" aria-label={unreadNotifs ? 'الإشعارات، فيه جديد' : 'الإشعارات'} className="circle-btn">
            <Bell size={22} />{unreadNotifs > 0 && <span className="red-dot" aria-hidden="true" />}
          </Link>
          <Link to="/profile" aria-label="الملف الشخصي" className="circle-btn circle-gold"><User size={22} /></Link>
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="ابحث عن غرفة" />
        <Tabs tabs={[['all', 'الكل'], ['active', 'الأكثر نشاطًا'], ['mine', 'غرفي']]} value={tab} onChange={setTab} />
      </header>

      <div className="kemet-bg list">
        {error && <p className="empty">مقدرناش نجيب الغرف. اتأكد من النت وجرب تاني.</p>}
        {!error && rooms === null && <p className="empty">بيحمّل الغرف...</p>}
        {list.map((r) => <RoomCard key={r.id} room={r} onLast={onLast} />)}
        {rooms && list.length === 0 && (
          <p className="empty">{tab === 'mine' && !q.trim() ? 'لسه مادخلتش أي غرفة' : rooms.length ? 'مفيش غرف بالاسم ده' : 'مفيش غرف لسه'}</p>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
