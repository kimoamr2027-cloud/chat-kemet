import { useState } from 'react'
import { Link } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { Avatar, SearchBox } from '../components/ui.jsx'
import { useAuth } from '../auth.jsx'
import { useChats, useUser, otherOf } from '../dm.js'
import { fmtWhen, colorIndex } from '../rooms.js'
import { ar } from '../utils.js'

function ChatRow({ chat, me, q }) {
  const other = otherOf(chat, me)
  const u = useUser(other)
  const name = u?.name || '...'
  if (q && !name.includes(q)) return null
  const unread = chat.unread?.[me] || 0
  const mine = chat.last?.uid === me
  return (
    <Link to={`/dm/${other}`} className="card row-card">
      <Avatar text={name.charAt(0)} c={colorIndex(other)} size={54} round />
      <div className="row-body">
        <div className="row-line">
          <span className="row-title">{name}</span>
          <span className="row-time">{fmtWhen(chat.at)}</span>
        </div>
        <div className="row-line">
          <span className={`row-sub ${unread ? 'row-sub-strong' : ''}`}>{mine ? 'أنت: ' : ''}{chat.last?.text}</span>
          {unread > 0 && <span className="badge badge-sm">{ar(unread)}</span>}
        </div>
      </div>
    </Link>
  )
}

export default function Messages() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const { chats, error } = useChats(user.uid)

  return (
    <main className="screen">
      <header className="head head-col">
        <h1 className="h-big">الرسائل الخاصة</h1>
        <SearchBox value={q} onChange={setQ} placeholder="ابحث عن عضو" />
      </header>

      <div className="kemet-bg list list-tight">
        {error && <p className="empty">مقدرناش نجيب رسايلك. اتأكد من النت وجرب تاني.</p>}
        {!error && chats === null && <p className="empty">بيحمّل...</p>}
        {chats?.map((c) => <ChatRow key={c.id} chat={c} me={user.uid} q={q.trim()} />)}
        {chats?.length === 0 && (
          <p className="empty">مفيش محادثات لسه.<br />ادخل أي غرفة ودوس على اسم أي حد علشان تكلمه خاص.</p>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
