import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { rooms, demoMessages } from '../demoData.js'

export default function RoomScreen() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const room = rooms.find((r) => r.id === roomId)
  const [messages, setMessages] = useState(demoMessages[roomId] || demoMessages.default)
  const [text, setText] = useState('')
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  if (!room) {
    return (
      <main className="screen">
        <p>الغرفة دي مش موجودة.</p>
        <button className="btn-ghost" onClick={() => navigate('/rooms')}>رجوع</button>
      </main>
    )
  }

  function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    // تجريبي: الرسالة بتتضاف على الجهاز بس
    setMessages((m) => [...m, { id: Date.now(), from: 'me', text: text.trim(), time: 'دلوقتي' }])
    setText('')
  }

  return (
    <main className="chat">
      <header className="topbar chat-top">
        <button className="btn-back" onClick={() => navigate('/rooms')} aria-label="رجوع">→</button>
        <span className="room-icon small">{room.icon}</span>
        <div>
          <h1 className="topbar-title">{room.name}</h1>
          <p className="topbar-sub">{room.online} متصل دلوقتي</p>
        </div>
      </header>

      <div className="messages">
        {messages.map((m) => {
          const mine = m.from === 'me'
          return (
            <div key={m.id} className={`msg ${mine ? 'msg-me' : ''}`}>
              {!mine && <span className={`msg-from ${m.gender}`}>{m.from}</span>}
              <p className="msg-text">{m.text}</p>
              <span className="msg-time">{m.time}</span>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={send}>
        <input
          className="input"
          placeholder="اكتب رسالة…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-send" type="submit" aria-label="إرسال">➤</button>
      </form>
    </main>
  )
}
