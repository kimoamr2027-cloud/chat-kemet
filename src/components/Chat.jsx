import { Fragment, useEffect, useRef, useState } from 'react'
import { Shield, Play, Wave, Smile, Image, Send, Mic, Trash, Close } from './Icons.jsx'
import { useMediaData } from '../media.js'
import { UserName } from './ui.jsx'
import { Link } from 'react-router-dom'
import { STICKERS, REACTIONS, dur } from '../utils.js'
import { LudoInvite } from './LudoBits.jsx'

const KNOWN = ['text', 'sticker', 'image', 'voice', 'ludo']
const COLORS = ['#7A4E14', '#1F5A75', '#6A3A7E', '#2F6B3A', '#8A3B1E']

// صورة في المحادثة (بتتحمّل لما تظهر)
// الصورة بتظهر صغيرة في المحادثة، ولما تدوس عليها تتفتح كبيرة
const THUMB = 160
function ChatImage({ m, onOpen, wasLongPress }) {
  const media = useMediaData(m.mediaPath)
  const w0 = m.w || 4, h0 = m.h || 3
  const k = THUMB / Math.max(w0, h0)
  const width = Math.max(90, Math.round(w0 * k))
  const height = Math.max(70, Math.round(h0 * k))
  return (
    <span className="chat-img" style={{ width, height }}
      onClick={(e) => {
        e.stopPropagation()
        if (wasLongPress()) return
        if (media?.src) onOpen({ src: media.src, m })
      }}>
      {media?.src ? <img src={media.src} alt="صورة" /> : <span className="img-wait">{media?.error ? 'الصورة مش متاحة' : 'بتحمّل...'}</span>}
    </span>
  )
}

// تشغيل الفويس
function VoicePlayer({ m }) {
  const [want, setWant] = useState(false)
  const media = useMediaData(m.mediaPath, want)
  const audio = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [left, setLeft] = useState(m.dur || 0)
  const [progress, setProgress] = useState(0)

  useEffect(() => () => audio.current?.pause(), [])
  useEffect(() => {
    if (!want || !media?.src || audio.current) return
    const a = new Audio(media.src)
    audio.current = a
    a.ontimeupdate = () => {
      const d = a.duration && isFinite(a.duration) ? a.duration : m.dur
      setProgress(Math.min(1, a.currentTime / d))
      setLeft(Math.max(0, Math.ceil(d - a.currentTime)))
    }
    a.onended = () => { setPlaying(false); setProgress(0); setLeft(m.dur) }
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }, [want, media, m.dur])

  function toggle(e) {
    e.stopPropagation()
    if (!audio.current) { setWant(true); return }
    if (playing) { audio.current.pause(); setPlaying(false) }
    else audio.current.play().then(() => setPlaying(true)).catch(() => {})
  }

  const loading = want && !media
  return (
    <span className="voice">
      <span className="play" role="button" aria-label={playing ? 'إيقاف' : 'تشغيل'} onClick={toggle}>
        {loading ? <span className="spin" /> : playing ? <span className="pause-ic" /> : <Play />}
      </span>
      <span className="wave-wrap">
        <Wave />
        <span className="wave-fill" style={{ width: `${progress * 100}%` }}><Wave /></span>
      </span>
      <span className="voice-dur">{media?.error ? 'مش متاح' : dur(left)}</span>
    </span>
  )
}

function Sticker({ i, size }) {
  return <span className={`stk s${i}`} style={{ width: size, height: size }} />
}

export function MessageList({ chat, people = [], typingLabel, empty }) {
  const endRef = useRef(null)
  const last = chat.msgs[chat.msgs.length - 1]
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [chat.msgs.length, last?.id, chat.typing])
  const person = (n) => people.find((p) => p.name === n) || { c: 0 }
  const hasDays = chat.msgs.some((m) => m.dayLabel)
  const [viewer, setViewer] = useState(null)
  const [viewerDel, setViewerDel] = useState(false)
  // ضغطة طويلة على أي رسالة = تظهر الاختيارات (تفاعل، رد، تعديل، مسح...)
  const press = useRef({ t: null, long: false })
  const startPress = (id) => {
    press.current.long = false
    clearTimeout(press.current.t)
    press.current.t = setTimeout(() => { press.current.long = true; chat.pick(id); navigator.vibrate?.(15) }, 450)
  }
  const endPress = () => clearTimeout(press.current.t)
  const wasLongPress = () => { const l = press.current.long; press.current.long = false; return l }
  const [confirmDel, setConfirmDel] = useState(null)

  return (
    <div className="kemet-bg messages">
      {!hasDays && <div className="day-chip">النهارده</div>}
      {chat.msgs.length === 0 && empty && <p className="chat-empty">{empty}</p>}
      {chat.msgs.map((m, i) => {
        const selected = chat.sel === m.id
        let reactLabel = m.reactLabel
        if (reactLabel === undefined) {
          const reacts = [m.other, m.mine].filter(Boolean)
          reactLabel = reacts.length === 2 && reacts[0] === reacts[1] ? reacts[0] + ' ٢' : reacts.join(' ')
        }
        const p = person(m.who)
        const color = COLORS[m.c ?? p.c]
        const isMod = m.mod ?? p.mod
        const showDay = m.dayLabel && m.dayLabel !== chat.msgs[i - 1]?.dayLabel
        const bubbleCls = m.kind === 'ludo' ? 'bubble bubble-ludo' : m.kind === 'sticker' ? 'bubble bubble-sticker' : m.kind === 'image' ? `bubble bubble-image ${m.me ? 'bubble-me' : 'bubble-other'}` : m.me ? 'bubble bubble-me' : 'bubble bubble-other'
        return (
          <Fragment key={m.id}>
            {showDay && <div className="day-chip">{m.dayLabel}</div>}
            {m.kind === 'join' ? <div className="join-chip"><span aria-hidden="true">👋</span> <Link to={`/u/${m.uid}`}>{m.text}</Link></div> : (
            <div className={`msg-row ${m.me ? 'row-me' : 'row-other'}`}>
              {!m.me && !chat.dm && (
                <span className="msg-who">
                  {(m.dmUid || p.dm)
                    ? <Link to={`/u/${m.dmUid || p.dm}`} title="البروفايل"><UserName name={m.who} role={m.role || (isMod ? 'mod' : null)} color={color} /></Link>
                    : <UserName name={m.who} role={m.role || (isMod ? 'mod' : null)} color={color} />}
                </span>
              )}
              {selected && (
                <div className="react-bar">
                  {REACTIONS.map(([e, label]) => (
                    <button key={e} type="button" aria-label={label} className={m.mine === e ? 'on' : ''} onClick={() => chat.react(m.id, e)}>{e}</button>
                  ))}
                  <button type="button" className="react-reply" onClick={() => chat.reply(m)}>رد</button>
                  {chat.canEdit?.(m) && <button type="button" className="react-reply" onClick={() => chat.startEdit(m)}>تعديل</button>}
                  {chat.canPin?.(m) && <button type="button" className="react-reply" onClick={() => chat.pin(m)}>📌 تثبيت</button>}
                  {chat.canDelete?.(m) && (
                    <button type="button" className="react-delete" onClick={() => {
                      if (confirmDel !== m.id) { setConfirmDel(m.id); return }
                      setConfirmDel(null); chat.remove(m)
                    }}>{confirmDel === m.id ? 'متأكد؟' : 'مسح'}</button>
                  )}
                </div>
              )}
              <button type="button" aria-label="اختيارات الرسالة" className={`${bubbleCls} ${selected ? 'bubble-sel' : ''}`}
                onPointerDown={() => startPress(m.id)} onPointerUp={endPress} onPointerLeave={endPress} onPointerCancel={endPress}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => { if (wasLongPress()) return; chat.pick(m.id) }}>
                {m.replyTo && (
                  <span className="quote"><b>{m.replyTo.who}</b>{m.replyTo.text}</span>
                )}
                {m.kind === 'text' && <span className="msg-text">{m.text}</span>}
                {m.kind === 'ludo' && <LudoInvite table={m.table} />}
                {m.kind === 'voice' && <VoicePlayer m={m} />}
                {m.kind === 'image' && <ChatImage m={m} onOpen={(v) => { setViewerDel(false); setViewer(v) }} wasLongPress={wasLongPress} />}
                {!KNOWN.includes(m.kind) && <span className="msg-unknown">حدّث التطبيق علشان تشوف الرسالة دي</span>}
                {m.kind === 'sticker' && (
                  <span className="sticker-msg">
                    <Sticker i={m.sticker} size={120} />
                    <span className="sticker-cap">{STICKERS[m.sticker]}</span>
                  </span>
                )}
              </button>
              {reactLabel && <span className="react-chip">{reactLabel}</span>}
              <span className="msg-meta">
                <span>{m.pending ? 'بيتبعت...' : m.time}</span>
                {m.edited && <span className="edited">· اتعدّلت</span>}
                {chat.dm && m.me && (
                  <svg role="img" aria-label={m.status === 'read' ? 'اتقرت' : 'وصلت'} width="18" height="14" viewBox="0 0 22 16" fill="none"
                    stroke={m.status === 'read' ? '#B07A1A' : '#8A8178'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1.5 8.5l4 4 8-9" /><path d="M9.5 12.5l8-9" />
                  </svg>
                )}
              </span>
            </div>
            )}
          </Fragment>
        )
      })}
      {chat.typing && (
        <div className="msg-row row-other">
          {typingLabel && <span className="msg-meta">{typingLabel}</span>}
          <div className="typing" aria-label="بيكتب"><span /><span /><span /></div>
        </div>
      )}
      <div ref={endRef} />
      {viewer && (
        <div className="viewer" role="dialog" aria-label="الصورة" onClick={() => setViewer(null)}>
          <img src={viewer.src} alt="صورة" />
          <button type="button" className="viewer-close" aria-label="إغلاق"><Close size={22} /></button>
          {chat.canDelete?.(viewer.m) && (
            <button type="button" className="viewer-delete" onClick={(e) => {
              e.stopPropagation()
              if (!viewerDel) { setViewerDel(true); return }
              setViewer(null); chat.remove(viewer.m)
            }}>{viewerDel ? 'متأكد؟ دوس تاني للمسح' : '🗑 مسح الصورة'}</button>
          )}
        </div>
      )}
    </div>
  )
}

export function Composer({ chat, onImage, onMic, mentionables = [], busy = '' }) {
  const fileRef = useRef(null)
  const hasDraft = chat.draft.trim().length > 0
  // لما تكتب @ تظهر قايمة بالأعضاء علشان تذكر حد
  const at = /(^|\s)@([^\s@]*)$/.exec(chat.draft)
  const suggestions = at ? mentionables.filter((m) => m.name.startsWith(at[2])).slice(0, 6) : []
  const pickMention = (name) => {
    const next = chat.draft.slice(0, chat.draft.length - at[2].length) + name + ' '
    chat.setDraft(next)
    requestAnimationFrame(() => {
      const el = document.getElementById('msg')
      if (el) { el.focus(); el.setSelectionRange(next.length, next.length) }
    })
  }
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

      {busy && <div className="busy-bar"><span className="spin dark" />{busy}</div>}

      {chat.editing && (
        <div className="reply-bar">
          <div className="reply-box">
            <b>بتعدّل رسالتك</b>
            <span>{chat.editing.text}</span>
          </div>
          <button type="button" className="icon-btn" aria-label="إلغاء التعديل" onClick={chat.cancelEdit}><Close /></button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mention-bar">
          {suggestions.map((m) => (
            <button key={m.uid} type="button" className="mention-chip"
              onPointerDown={(e) => e.preventDefault()} onClick={() => pickMention(m.name)}>@{m.name}</button>
          ))}
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
          <div className="rec-pill"><span className="rec-dot" />جاري التسجيل <span className="rec-time">{dur(chat.recSec)}</span></div>
          <button type="button" className="round-btn" aria-label="إرسال الرسالة الصوتية" onClick={chat.sendRec}><Send /></button>
        </div>
      ) : (
        <form className="composer-row" onSubmit={(e) => { e.preventDefault(); chat.sendText() }}>
          <button type="button" className={`icon-btn ${chat.stickersOpen ? 'accent' : ''}`} aria-label="ستيكرات"
            aria-pressed={chat.stickersOpen} onClick={chat.toggleStickers}><Smile /></button>
          <button type="button" className="icon-btn narrow" aria-label="إرسال صورة" disabled={!!busy}
            onClick={() => (chat.sendImage ? fileRef.current?.click() : onImage?.())}><Image /></button>
          <input ref={fileRef} type="file" accept="image/*" className="file-hidden" aria-hidden="true" tabIndex={-1}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) chat.sendImage(f) }} />
          <label className="sr-only" htmlFor="msg">رسالة</label>
          <input id="msg" className="msg-input" type="text" placeholder="اكتب رسالة..." autoComplete="off"
            value={chat.draft} onChange={(e) => chat.setDraft(e.target.value)} />
          {hasDraft || chat.editing
            ? <button type="submit" className="round-btn" aria-label={chat.editing ? 'حفظ التعديل' : 'إرسال'}><Send /></button>
            : <button type="button" className="round-btn" aria-label="تسجيل رسالة صوتية" onClick={onMic || chat.startRec}><Mic /></button>}
        </form>
      )}
    </div>
  )
}
