import { useEffect, useRef, useState } from 'react'
import { Shield, Play, Wave, Smile, Image, Send, Mic, Trash, Close } from './Icons.jsx'
import { Link } from 'react-router-dom'
import { STICKERS, REACTIONS, dur } from '../utils.js'

const COLORS = ['#7A4E14', '#1F5A75', '#6A3A7E', '#2F6B3A', '#8A3B1E']
const summary = (m) => (m.kind === 'voice' ? 'رسالة صوتية' : m.kind === 'sticker' ? 'ستيكر' : m.text)

// كل منطق المحادثة (تجريبي — على الجهاز بس)
// replier: اسم اللي بيرد أوتوماتيك، replies: الردود التجريبية
export function useChat({ initial, replier, replies, dm = false, blocked = false }) {
  const [msgs, setMsgs] = useState(initial)
  const [draft, setDraft] = useState('')
  const [sel, setSel] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [stickersOpen, setStickersOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recSec, setRecSec] = useState(0)
  const [typing, setTyping] = useState(false)
  const timers = useRef([])
  const nextId = useRef(100)
  const blockedRef = useRef(blocked)
  blockedRef.current = blocked

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setRecSec((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [recording])
  useEffect(() => { if (blocked) { setTyping(false); setRecording(false) } }, [blocked])

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))

  function send(extra) {
    const msg = { id: nextId.current++, me: true, time: 'الآن', replyTo, ...(dm ? { status: 'delivered' } : {}), ...extra }
    setMsgs((m) => [...m, msg])
    setDraft(''); setReplyTo(null); setStickersOpen(false); setSel(null)
    if (blockedRef.current) return
    later(() => !blockedRef.current && setTyping(true), 1200)
    later(() => {
      setTyping(false)
      if (blockedRef.current) return
      const id = nextId.current++
      setMsgs((m) => [
        ...(dm ? m.map((x) => (x.me ? { ...x, status: 'read' } : x)) : m),
        { id, who: replier, kind: 'text', text: replies[id % replies.length], time: 'الآن' },
      ])
    }, 3400)
  }

  return {
    msgs, draft, setDraft, sel, replyTo, stickersOpen, recording, recSec, typing, dm,
    pick: (id) => { setSel((s) => (s === id ? null : id)); setStickersOpen(false) },
    clearSel: () => setSel(null),
    react: (id, e) => { setSel(null); setMsgs((m) => m.map((x) => (x.id === id ? { ...x, mine: x.mine === e ? null : e } : x))) },
    reply: (m) => { setSel(null); setReplyTo({ who: m.me ? 'نفسك' : m.who || replier, text: summary(m) }) },
    cancelReply: () => setReplyTo(null),
    toggleStickers: () => { setStickersOpen((o) => !o); setSel(null) },
    sendText: () => { const t = draft.trim(); if (t) send({ kind: 'text', text: t }) },
    sendSticker: (i) => send({ kind: 'sticker', sticker: i }),
    startRec: () => { setRecSec(0); setRecording(true); setStickersOpen(false) },
    cancelRec: () => setRecording(false),
    sendRec: () => { setRecording(false); send({ kind: 'voice', dur: dur(Math.max(1, recSec)) }) },
  }
}

function Sticker({ i, size }) {
  return <span className={`stk s${i}`} style={{ width: size, height: size }} />
}

export function MessageList({ chat, people = [], typingLabel }) {
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [chat.msgs.length, chat.typing])
  const person = (n) => people.find((p) => p.name === n) || { c: 0 }

  return (
    <div className="kemet-bg messages">
      <div className="day-chip">النهارده</div>
      {chat.msgs.map((m) => {
        const selected = chat.sel === m.id
        const reacts = [m.other, m.mine].filter(Boolean)
        const reactLabel = reacts.length === 2 && reacts[0] === reacts[1] ? reacts[0] + ' ٢' : reacts.join(' ')
        const p = person(m.who)
        const bubbleCls = m.kind === 'sticker' ? 'bubble bubble-sticker' : m.me ? 'bubble bubble-me' : 'bubble bubble-other'
        return (
          <div key={m.id} className={`msg-row ${m.me ? 'row-me' : 'row-other'}`}>
            {!m.me && !chat.dm && (
              <span className="msg-who">
                {p.dm
                  ? <Link to={`/dm/${p.dm}`} style={{ color: COLORS[p.c] }} title="رسالة خاصة">{m.who}</Link>
                  : <span style={{ color: COLORS[p.c] }}>{m.who}</span>}
                {p.mod && <span className="mod-chip"><Shield />مشرف</span>}
              </span>
            )}
            {selected && (
              <div className="react-bar">
                {REACTIONS.map(([e, label]) => (
                  <button key={e} type="button" aria-label={label} className={m.mine === e ? 'on' : ''} onClick={() => chat.react(m.id, e)}>{e}</button>
                ))}
                <button type="button" className="react-reply" onClick={() => chat.reply(m)}>رد</button>
              </div>
            )}
            <button type="button" aria-label="اختيارات الرسالة" className={`${bubbleCls} ${selected ? 'bubble-sel' : ''}`} onClick={() => chat.pick(m.id)}>
              {m.replyTo && (
                <span className="quote"><b>{m.replyTo.who}</b>{m.replyTo.text}</span>
              )}
              {m.kind === 'text' && <span>{m.text}</span>}
              {m.kind === 'voice' && (
                <span className="voice">
                  <span className="play"><Play /></span>
                  <Wave />
                  <span className="voice-dur">{m.dur}</span>
                </span>
              )}
              {m.kind === 'sticker' && (
                <span className="sticker-msg">
                  <Sticker i={m.sticker} size={120} />
                  <span className="sticker-cap">{STICKERS[m.sticker]}</span>
                </span>
              )}
            </button>
            {reacts.length > 0 && <span className="react-chip">{reactLabel}</span>}
            <span className="msg-meta">
              <span>{m.time}</span>
              {chat.dm && m.me && (
                <svg role="img" aria-label={m.status === 'read' ? 'اتقرت' : 'وصلت'} width="18" height="14" viewBox="0 0 22 16" fill="none"
                  stroke={m.status === 'read' ? '#B07A1A' : '#8A8178'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1.5 8.5l4 4 8-9" /><path d="M9.5 12.5l8-9" />
                </svg>
              )}
            </span>
          </div>
        )
      })}
      {chat.typing && (
        <div className="msg-row row-other">
          {typingLabel && <span className="msg-meta">{typingLabel}</span>}
          <div className="typing" aria-label="بيكتب"><span /><span /><span /></div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}

export function Composer({ chat, onImage }) {
  const hasDraft = chat.draft.trim().length > 0
  return (
    <div className="composer">
      {chat.replyTo && (
        <div className="reply-bar">
          <div className="reply-box">
            <b>رد على {chat.replyTo.who}</b>
            <span>{chat.replyTo.text}</span>
          </div>
          <button type="button" className="icon-btn" aria-label="إلغاء الرد" onClick={chat.cancelReply}><Close /></button>
        </div>
      )}

      {chat.stickersOpen && (
        <div className="sticker-panel">
          <span className="sticker-title">ستيكرات كيمت</span>
          <div className="sticker-grid">
            {STICKERS.map((cap, i) => (
              <button key={i} type="button" onClick={() => chat.sendSticker(i)}>
                <Sticker i={i} size={72} />
                <span>{cap}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {chat.recording ? (
        <div className="composer-row rec-row">
          <button type="button" className="icon-btn danger" aria-label="إلغاء التسجيل" onClick={chat.cancelRec}><Trash /></button>
          <div className="rec-pill"><span className="rec-dot" />جاري التسجيل {dur(chat.recSec)}</div>
          <button type="button" className="round-btn" aria-label="إرسال الرسالة الصوتية" onClick={chat.sendRec}><Send /></button>
        </div>
      ) : (
        <form className="composer-row" onSubmit={(e) => { e.preventDefault(); chat.sendText() }}>
          <button type="button" className={`icon-btn ${chat.stickersOpen ? 'accent' : ''}`} aria-label="ستيكرات"
            aria-pressed={chat.stickersOpen} onClick={chat.toggleStickers}><Smile /></button>
          <button type="button" className="icon-btn narrow" aria-label="إرسال صورة" onClick={onImage}><Image /></button>
          <label className="sr-only" htmlFor="msg">رسالة</label>
          <input id="msg" className="msg-input" type="text" placeholder="اكتب رسالة..." autoComplete="off"
            value={chat.draft} onChange={(e) => chat.setDraft(e.target.value)} />
          {hasDraft
            ? <button type="submit" className="round-btn" aria-label="إرسال"><Send /></button>
            : <button type="button" className="round-btn" aria-label="تسجيل رسالة صوتية" onClick={chat.startRec}><Mic /></button>}
        </form>
      )}
    </div>
  )
}
