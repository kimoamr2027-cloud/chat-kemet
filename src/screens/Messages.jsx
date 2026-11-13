import { useState } from 'react'
import { Link } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { Avatar, SearchBox } from '../components/ui.jsx'
import { chats } from '../data.js'
import { ar } from '../utils.js'

export default function Messages() {
  const [q, setQ] = useState('')
  const list = chats.filter((c) => !q.trim() || c.name.includes(q.trim()))
  return (
    <main className="screen">
      <header className="head head-col">
        <h1 className="h-big">الرسائل الخاصة</h1>
        <SearchBox value={q} onChange={setQ} placeholder="ابحث عن عضو" />
      </header>

      <div className="kemet-bg list list-tight">
        {list.map((c) => (
          <Link key={c.id} to={`/dm/${c.id}`} className="card row-card">
            <div className="avatar-wrap">
              <Avatar text={c.name.charAt(0)} c={chats.indexOf(c)} size={54} round />
              {c.online && <span className="online-dot" aria-label="متصل" />}
            </div>
            <div className="row-body">
              <div className="row-line">
                <span className="row-title">{c.name}</span>
                <span className="row-time">{c.time}</span>
              </div>
              <div className="row-line">
                <span className={`row-sub ${c.unread ? 'row-sub-strong' : ''}`}>{c.last}</span>
                {c.unread > 0 && <span className="badge badge-sm">{ar(c.unread)}</span>}
              </div>
            </div>
          </Link>
        ))}
        {list.length === 0 && <p className="empty">مفيش حد بالاسم ده</p>}
      </div>

      <BottomNav />
    </main>
  )
}
