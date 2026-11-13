import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Back, Members } from '../components/Icons.jsx'
import { Avatar, Sheet, useToast } from '../components/ui.jsx'
import { MessageList, Composer } from '../components/Chat.jsx'
import { roomInitial } from '../data.js'
import { useAuth } from '../auth.jsx'
import {
  DEFAULT_ROOMS, useRoom, useMessages, sendRoomMessage, setReaction,
  fmtTime, fmtDay, colorIndex,
} from '../rooms.js'
import { ar, REACTIONS } from '../utils.js'

const summary = (m) => (m.kind === 'sticker' ? 'ستيكر' : m.text)

export default function Room() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const room = useRoom(id)
  const { msgs: raw, error } = useMessages(id)
  const [draft, setDraft] = useState('')
  const [sel, setSel] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [stickersOpen, setStickersOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [toast, showToast] = useToast()

  // نحوّل رسايل Firestore للشكل اللي الشاشة بتعرضه
  const msgs = useMemo(() => (raw || []).map((m) => {
    const reactions = m.reactions || {}
    const counts = {}
    for (const [uid, e] of Object.entries(reactions)) counts[e] = (counts[e] || 0) + (uid ? 1 : 0)
    const order = REACTIONS.map(([e]) => e)
    const reactLabel = Object.entries(counts)
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([e, n]) => (n > 1 ? `${e} ${ar(n)}` : e)).join(' ')
    return {
      id: m.id,
      me: m.uid === user.uid,
      who: m.name,
      c: colorIndex(m.uid),
      kind: m.kind,
      text: m.text,
      sticker: m.sticker,
      replyTo: m.replyTo ? { who: m.replyTo.name, text: m.replyTo.text } : null,
      mine: reactions[user.uid] || null,
      reactLabel,
      time: fmtTime(m.at),
      dayLabel: fmtDay(m.at),
      pending: m.pending,
    }
  }), [raw, user.uid])

  // الأعضاء اللي اتكلموا في الغرفة
  const members = useMemo(() => {
    const map = new Map()
    for (const m of raw || []) map.set(m.uid, { uid: m.uid, name: m.name, c: colorIndex(m.uid) })
    if (profile) map.set(user.uid, { uid: user.uid, name: profile.name, c: colorIndex(user.uid) })
    return [...map.values()]
  }, [raw, profile, user.uid])

  if (room === null && !DEFAULT_ROOMS[id]) return <Navigate to="/rooms" replace />
  const name = room?.name || DEFAULT_ROOMS[id]?.name || ''
  const order = (room?.order || DEFAULT_ROOMS[id]?.order || 1) - 1

  function send(extra) {
    const reply = replyTo
    setDraft(''); setReplyTo(null); setStickersOpen(false); setSel(null)
    sendRoomMessage(id, profile, user.uid, { ...extra, replyTo: reply })
      .catch(() => showToast('الرسالة ماتبعتتش، جرب تاني'))
  }

  const chat = {
    msgs, sel, draft, setDraft, replyTo, stickersOpen, recording: false, typing: false, dm: false,
    pick: (mid) => { setSel((s) => (s === mid ? null : mid)); setStickersOpen(false) },
    clearSel: () => setSel(null),
    react: (mid, e) => {
      setSel(null)
      const m = msgs.find((x) => x.id === mid)
      setReaction(id, mid, user.uid, m?.mine === e ? null : e).catch(() => showToast('مقدرناش نحفظ التفاعل'))
    },
    reply: (m) => { setSel(null); setReplyTo({ who: m.me ? profile.name : m.who, text: summary(m) }) },
    cancelReply: () => setReplyTo(null),
    toggleStickers: () => { setStickersOpen((o) => !o); setSel(null) },
    sendText: () => { const t = draft.trim(); if (t) send({ kind: 'text', text: t }) },
    sendSticker: (i) => send({ kind: 'sticker', sticker: i }),
  }

  const subtitle = raw === null ? 'بيحمّل...' : `${ar(members.length)} ${members.length === 1 || members.length > 10 ? 'عضو' : 'أعضاء'} في المحادثة`

  return (
    <main className="screen chat-screen">
      <header className="head head-row chat-head">
        <Link to="/rooms" aria-label="رجوع" className="icon-btn"><Back /></Link>
        <Avatar text={roomInitial(name)} c={order} size={44} />
        <div className="head-titles">
          <span className="head-name">{name}</span>
          <span className="head-status">{subtitle}</span>
        </div>
        <button type="button" className="icon-btn" aria-label="الأعضاء" onClick={() => { setMembersOpen(true); setSel(null) }}><Members /></button>
      </header>

      {error ? (
        <div className="kemet-bg messages"><p className="chat-empty">مقدرناش نجيب الرسايل. اتأكد من النت وجرب تاني.</p></div>
      ) : raw === null ? (
        <div className="kemet-bg messages"><p className="chat-empty">بيحمّل الرسايل...</p></div>
      ) : (
        <MessageList chat={chat} empty="مفيش رسايل لسه — ابدأ انت الكلام 👋" />
      )}
      <Composer chat={chat}
        onImage={() => showToast('إرسال الصور جاي في المرحلة الجاية')}
        onMic={() => showToast('الرسايل الصوتية جاية في المرحلة الجاية')} />

      {membersOpen && (
        <Sheet onClose={() => setMembersOpen(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">أعضاء الغرفة</h2>
          <p className="sheet-sub">الأعضاء اللي اتكلموا في الغرفة دي.</p>
          {members.map((p) => (
            <div key={p.uid} className="member">
              <Avatar text={p.name.charAt(0)} c={p.c} size={42} round />
              <div className="member-body">
                <span className="member-name">{p.name}{p.uid === user.uid && <span className="mod-chip">انت</span>}</span>
              </div>
            </div>
          ))}
        </Sheet>
      )}
      {toast}
    </main>
  )
}
