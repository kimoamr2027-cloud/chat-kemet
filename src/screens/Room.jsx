import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Back, Members } from '../components/Icons.jsx'
import { Avatar, Sheet, useToast } from '../components/ui.jsx'
import { useChat, MessageList, Composer } from '../components/Chat.jsx'
import { rooms, roomInitial, roomPeople, roomMessages } from '../data.js'
import { ar } from '../utils.js'

export default function Room() {
  const { id } = useParams()
  const room = rooms.find((r) => r.id === id)
  const [people, setPeople] = useState(roomPeople)
  const [muted, setMuted] = useState({})
  const [membersOpen, setMembersOpen] = useState(false)
  const [toast, showToast] = useToast()
  const chat = useChat({ initial: roomMessages, replier: 'سارة', replies: ['تمام كده', 'هههه حلو', 'اتفقنا', 'ماشي يا جماعة'] })

  if (!room) return <Navigate to="/rooms" replace />

  return (
    <main className="screen chat-screen">
      <header className="head head-row chat-head">
        <Link to="/rooms" aria-label="رجوع" className="icon-btn"><Back /></Link>
        <Avatar text={roomInitial(room.name)} c={rooms.indexOf(room)} size={44} />
        <div className="head-titles">
          <span className="head-name">{room.name}</span>
          <span className="head-status">{chat.typing ? 'سارة بتكتب...' : `${ar(people.length + 19)} متصل الآن`}</span>
        </div>
        <button type="button" className="icon-btn" aria-label="الأعضاء والمشرفين" onClick={() => { setMembersOpen(true); chat.clearSel() }}><Members /></button>
      </header>

      <MessageList chat={chat} people={people} typingLabel="سارة بتكتب..." />
      <Composer chat={chat} onImage={() => showToast('إرسال الصور هيشتغل مع Firebase')} />

      {membersOpen && (
        <Sheet onClose={() => setMembersOpen(false)} className="members-sheet">
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">أعضاء الغرفة</h2>
          <p className="sheet-sub">انت مشرف في الغرفة دي، تقدر تكتم أو تطرد أي عضو بيضايق الناس.</p>
          {people.map((p) => {
            const isMuted = !!muted[p.name]
            return (
              <div key={p.name} className="member">
                <Avatar text={p.name.charAt(0)} c={p.c} size={42} round />
                <div className="member-body">
                  <span className="member-name">{p.name}{p.mod && <span className="mod-chip">مشرف</span>}</span>
                  <span className={isMuted ? 'status-muted' : 'status-on'}>{isMuted ? 'مكتوم' : p.mod ? 'مشرف الغرفة' : 'متصل الآن'}</span>
                </div>
                {!p.mod && (
                  <div className="member-actions">
                    <button type="button" className="pill-btn" onClick={() => {
                      setMuted((m) => ({ ...m, [p.name]: !isMuted }))
                      showToast(isMuted ? 'اتلغى كتم ' + p.name : p.name + ' اتكتم ومش هيقدر يكتب')
                    }}>{isMuted ? 'إلغاء الكتم' : 'كتم'}</button>
                    <button type="button" className="pill-btn pill-danger" onClick={() => {
                      setPeople((list) => list.filter((x) => x.name !== p.name))
                      showToast('اتطرد ' + p.name + ' من الغرفة')
                    }}>طرد</button>
                  </div>
                )}
              </div>
            )
          })}
        </Sheet>
      )}
      {toast}
    </main>
  )
}
