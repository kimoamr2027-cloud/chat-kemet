import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Back, Members } from '../components/Icons.jsx'
import { Avatar, Sheet, UserName, useToast } from '../components/ui.jsx'
import { MessageList, Composer } from '../components/Chat.jsx'
import { useUser } from '../dm.js'
import { roomInitial } from '../data.js'
import { useAuth, joinRoom } from '../auth.jsx'
import {
  useRoom, useMessages, sendRoomMessage, setReaction, canEditMsg, editRoomMessage, deleteOwnRoomMessage, setPinned, clearPinned,
  fmtTime, fmtDay, colorIndex, preview, useRoomMembers,
} from '../rooms.js'
import { ar, REACTIONS } from '../utils.js'
import { notify } from '../notifs.js'
import { compressImage, uploadMedia, useVoiceRecorder } from '../media.js'
import { useRoomOnline } from '../presence.js'
import RoomPhotoButton from '../components/RoomPhotoButton.jsx'
import { GameCard, StartGameSheet, LeaderboardSheet } from '../components/Game.jsx'
import { useGame, tryAnswer } from '../games.js'
import { playJoin, soundOn } from '../sound.js'
import { useFilter, hasBadWord } from '../filter.js'
import {
  useRestrictions, restrictUser, liftRestriction, deleteRoomMessage, setMod,
  roleOf, canModerate, isAdminUid, isModUid, timeLeft,
} from '../roles.js'

const summary = (m) => preview(m)

function MemberAvatar({ uid, name, c, size = 42 }) {
  const u = useUser(uid)
  return <Avatar text={name.charAt(0)} c={c} size={size} round src={u?.avatar} />
}

export default function Room() {
  const { id } = useParams()
  const { user, profile, roles, myBan } = useAuth()
  const room = useRoom(id)
  const restrictions = useRestrictions(id)
  const mine = restrictions[user.uid]
  const kicked = mine?.type === 'ban'
  const { msgs: raw, error, more, loadMore } = useMessages(id, !kicked)
  const joinedMembers = useRoomMembers(id)
  const online = useRoomOnline(id)
  const iAdmin = isAdminUid(roles, user.uid)
  const iMod = canModerate(roles, id, user.uid)
  const [draft, setDraft] = useState('')
  const [sel, setSel] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [stickersOpen, setStickersOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [pinOpen, setPinOpen] = useState(false)
  const [photoView, setPhotoView] = useState(false)
  const [pinText, setPinText] = useState('')
  const badWords = useFilter()
  const [membersOpen, setMembersOpen] = useState(false)
  const game = useGame(id)
  const [gameOpen, setGameOpen] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const [toast, showToast] = useToast()
  // صور وفويس
  const [busy, setBusy] = useState('')
  const voice = useVoiceRecorder({
    onError: showToast,
    onDone: async ({ data, mime, dur }) => {
      setBusy('بيترفع الفويس...')
      try {
        const media = await uploadMedia(`rooms/${id}/media`, user.uid, 'voice', mime, data)
        send({ kind: 'voice', media, dur })
      } catch {
        showToast('الفويس ماتبعتش، جرب تاني')
      }
      setBusy('')
    },
  })
  const navigate = useNavigate()

  // أول مرة تدخل الغرفة بتتسجل في "غرفي" (وبتفرق في إعداد مين يقدر يبعتلك خاص)
  const joined = (profile?.rooms || []).includes(id)
  useEffect(() => {
    if (!joined && room) joinRoom(user.uid, id).catch(() => {})
  }, [joined, id, user.uid, !!room])

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
      dmUid: m.uid === user.uid ? null : m.uid,
      who: m.name,
      role: roleOf(roles, id, m.uid),
      c: colorIndex(m.uid),
      kind: m.kind,
      text: m.text,
      sticker: m.sticker, table: m.table, thumb: m.thumb,
      w: m.w, h: m.h, dur: m.dur, media: m.media, at: m.at, edited: !!m.edited,
      mediaPath: m.media ? `rooms/${id}/media/${m.media}` : null,
      replyTo: m.replyTo ? { who: m.replyTo.name, text: m.replyTo.text } : null,
      mine: reactions[user.uid] || null,
      reactLabel,
      time: fmtTime(m.at),
      dayLabel: fmtDay(m.at),
      pending: m.pending,
    }
  }), [raw, user.uid, roles, id])

  // الأعضاء اللي اتكلموا في الغرفة
  // أسامي كل اللي دخلوا الغرفة أو كتبوا فيها
  const names = useMemo(() => {
    const map = new Map()
    for (const u of joinedMembers || []) map.set(u.uid, u.name)
    for (const m of raw || []) if (!map.has(m.uid)) map.set(m.uid, m.name)
    for (const [uid, r] of Object.entries(restrictions)) if (!map.has(uid)) map.set(uid, r.name || 'عضو')
    if (profile) map.set(user.uid, profile.name)
    return map
  }, [raw, joinedMembers, profile, user.uid, restrictions])

  // الأعضاء = الموجودين في الغرفة دلوقتي بس (اللي خرج من دقيقة بيختفي)
  // + للمشرف والأدمن: المكتومين والمطرودين علشان يقدروا يلغوا عنهم
  const onlineKey = [...online].sort().join(',')
  const members = useMemo(() => {
    const ids = new Set([...online, user.uid])
    if (canModerate(roles, id, user.uid)) Object.keys(restrictions).forEach((u) => ids.add(u))
    return [...ids].filter((uid) => names.has(uid)).map((uid) => ({ uid, name: names.get(uid), c: colorIndex(uid) }))
  }, [onlineKey, names, restrictions, roles, id, user.uid]) // eslint-disable-line react-hooks/exhaustive-deps
  const onlineCount = new Set([...online, user.uid]).size

  // حد دخل الغرفة: اسمه يظهر في الشات + صوت
  const [joins, setJoins] = useState([])
  const seen = useRef(null)
  const openedAt = useRef(Date.now())
  useEffect(() => {
    const prev = seen.current
    seen.current = new Set(online)
    // أول تحميل للغرفة: دول كانوا موجودين قبلنا
    if (!prev || Date.now() - openedAt.current < 4000) return
    const fresh = [...online].filter((u) => !prev.has(u) && u !== user.uid)
    if (!fresh.length) return
    const at = new Date()
    setJoins((j) => [...j.filter((x) => !fresh.includes(x.uid)), ...fresh.map((uid) => ({ uid, at }))].slice(-30))
    if (soundOn('joins')) playJoin()
  }, [onlineKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // المذكورين بـ @ : أي حد في الغرفة (حتى لو مش متصل)
  const mentionables = useMemo(() => [...names].filter(([uid]) => uid !== user.uid).map(([uid, name]) => ({ uid, name })), [names, user.uid])

  const rank = (uid) => (isAdminUid(roles, uid) ? 0 : isModUid(roles, id, uid) ? 1 : uid === user.uid ? 2 : 3)
  const sortedMembers = [...members].sort((a, b) => rank(a.uid) - rank(b.uid) || a.name.localeCompare(b.name, 'ar'))

  const shown = useMemo(() => {
    if (!joins.length) return msgs
    const items = joins.filter((j) => names.has(j.uid)).map((j) => ({
      id: `join-${j.uid}-${j.at.getTime()}`, kind: 'join', uid: j.uid, text: `${names.get(j.uid)} دخل الغرفة`, at: j.at, dayLabel: fmtDay(j.at),
    }))
    const t = (m) => (m.at?.getTime ? m.at.getTime() : Infinity)
    return [...msgs, ...items].sort((a, b) => t(a) - t(b))
  }, [msgs, joins, names])

  if (room === null) return <Navigate to="/rooms" replace />
  const name = room?.name || ''
  const order = (room?.order || 1) - 1

  function send(extra) {
    const reply = replyTo
    setDraft(''); setReplyTo(null); setStickersOpen(false); setSel(null)
    sendRoomMessage(id, profile, user.uid, { ...extra, replyTo: reply })
      .then((ref) => {
        // إشعارات: اللي ردّيت عليه + أي حد ذكرت اسمه بـ @
        const base = { roomId: id, roomName: name, msgId: ref.id, text: preview(extra) }
        const told = new Set([user.uid])
        if (reply?.uid && !told.has(reply.uid)) {
          told.add(reply.uid)
          notify(reply.uid, user.uid, profile.name, { ...base, type: 'reply' })
        }
        if (extra.kind === 'text' && extra.text.includes('@')) {
          for (const mb of mentionables) {
            if (!told.has(mb.uid) && extra.text.includes('@' + mb.name)) {
              told.add(mb.uid)
              notify(mb.uid, user.uid, profile.name, { ...base, type: 'mention' })
            }
          }
        }
      })
      .catch(() => showToast('الرسالة ماتبعتتش، جرب تاني'))
  }



  async function sendImage(file) {
    setBusy('بتجهّز الصورة...')
    try {
      const img = await compressImage(file, 1080, 450000)
      const small = await compressImage(file, 320, 28000).catch(() => null)
      setBusy('بتترفع الصورة...')
      const media = await uploadMedia(`rooms/${id}/media`, user.uid, 'image', 'image/jpeg', img.base64)
      send({ kind: 'image', media, w: img.w, h: img.h, thumb: small?.dataUrl })
    } catch {
      showToast('الصورة ماتبعتتش، جرب تاني')
    }
    setBusy('')
  }
  const chat = {
    msgs: shown, more, loadMore, sel, draft, setDraft, replyTo, stickersOpen, typing: false, dm: false, ...voice, sendImage,
    pick: (mid) => { setSel((s) => (s === mid ? null : mid)); setStickersOpen(false) },
    clearSel: () => setSel(null),
    react: (mid, e) => {
      setSel(null)
      const m = msgs.find((x) => x.id === mid)
      const adding = m?.mine !== e
      setReaction(id, mid, user.uid, adding ? e : null)
        .then(() => {
          const author = (raw || []).find((x) => x.id === mid)?.uid
          if (adding && author && author !== user.uid) {
            notify(author, user.uid, profile.name,
              { type: 'react', roomId: id, roomName: name, msgId: mid, emoji: e, text: summary(m) },
              `react_${mid}_${user.uid}`)
          }
        })
        .catch(() => showToast('مقدرناش نحفظ التفاعل'))
    },
    reply: (m) => { setSel(null); setReplyTo({ who: m.me ? profile.name : m.who, text: summary(m), uid: m.me ? user.uid : m.dmUid }) },
    cancelReply: () => setReplyTo(null),
    toggleStickers: () => { setStickersOpen((o) => !o); setSel(null) },
    sendText: () => {
      const t = draft.trim()
      if (t && hasBadWord(t, badWords)) { showToast('رسالتك فيها كلمة ممنوعة 🚫 عدّلها وابعت تاني'); return }
      if (editing) {
        const e = editing
        setEditing(null); setDraft('')
        if (t && t !== e.text) editRoomMessage(id, e.id, t).catch(() => showToast('مقدرناش نعدّل الرسالة (التعديل خلال ١٥ دقيقة بس)'))
        return
      }
      if (t) {
        send({ kind: 'text', text: t })
        // مسابقة شغالة؟ نشوف الرسالة دي الإجابة الصح ولا لأ
        if (game?.status === 'open' && !myBan && !mine) {
          tryAnswer(id, game, t, user.uid, profile.name).then((ok) => ok && showToast('🎉 إجابة صح! كسبت نقطة'))
        }
      }
    },
    editing,
    canEdit: canEditMsg,
    startEdit: (m) => { setSel(null); setReplyTo(null); setEditing({ id: m.id, text: m.text }); setDraft(m.text) },
    cancelEdit: () => { setEditing(null); setDraft('') },
    sendSticker: (i) => send({ kind: 'sticker', sticker: i }),
    canDelete: (m) => !m.pending && (m.me || iMod),
    canPin: (m) => iMod && m.kind === 'text' && !m.pending,
    pin: (m) => { setSel(null); doPin(m.text) },
    remove: (m) => {
      setSel(null)
      ;(m.me ? deleteOwnRoomMessage(id, m) : deleteRoomMessage(id, m.id))
        .then(() => showToast('الرسالة اتمسحت')).catch(() => showToast('مقدرناش نمسح الرسالة'))
    },
  }

  // الإعلان المثبّت
  function doPin(text) {
    const t = (text || '').trim()
    if (!t) return showToast('اكتب الإعلان')
    if (hasBadWord(t, badWords)) return showToast('الإعلان فيه كلمة ممنوعة 🚫')
    setPinOpen(false)
    setPinned(id, t, user.uid, profile.name).then(() => showToast('📌 الإعلان اتثبّت')).catch(() => showToast('مقدرناش نثبّت الإعلان'))
  }
  function unpin() {
    clearPinned(id).then(() => showToast('الإعلان اتشال')).catch(() => showToast('حصلت مشكلة'))
  }

  // صلاحياتي على عضو معيّن
  const canAct = (uid) => uid !== user.uid && iMod && !isAdminUid(roles, uid) && (iAdmin || !isModUid(roles, id, uid))
  function act(p, type, hours) {
    restrictUser({ roomId: id, uid: p.uid, name: p.name, type, hours, me: user.uid, myName: profile.name })
      .then(() => showToast(type === 'mute' ? `${p.name} اتكتم ومش هيقدر يكتب` : `اتطرد ${p.name} من الغرفة`))
      .catch(() => showToast('حصلت مشكلة، جرب تاني'))
  }
  function lift(p) {
    liftRestriction(id, p.uid).then(() => showToast(`${p.name} رجع عادي`)).catch(() => showToast('حصلت مشكلة، جرب تاني'))
  }
  function toggleMod(p, on) {
    setMod(id, p.uid, on, user.uid, profile.name, name)
      .then(() => showToast(on ? `${p.name} بقى مشرف في ${name}` : `${p.name} مبقاش مشرف`))
      .catch(() => showToast('حصلت مشكلة، جرب تاني'))
  }

  const subtitle = `● ${ar(onlineCount)} متصل الآن`

  return (
    <main className="screen chat-screen">
      <header className="head head-row chat-head">
        <Link to="/rooms" aria-label="رجوع" className="icon-btn"><Back /></Link>
        <span className={room?.photo ? 'room-photo-btn' : undefined} onClick={() => room?.photo && setPhotoView(true)}>
          <Avatar text={roomInitial(name)} c={order} size={44} src={room?.photo || undefined} />
        </span>
        <button type="button" className="head-titles head-titles-btn" onClick={() => { setMembersOpen(true); setSel(null) }}>
          <span className="head-name">{name}</span>
          <span className="head-status">{subtitle} ‹</span>
        </button>
        <button type="button" className="members-btn" onClick={() => { setMembersOpen(true); setSel(null) }}><Members />الأعضاء</button>
      </header>


      {room?.pinned?.text && !kicked && (
        <div className="pinned">
          <span className="pinned-ic" aria-hidden="true">📌</span>
          <div className="pinned-body">
            <span className="pinned-text">{room.pinned.text}</span>
            <span className="pinned-by">إعلان من {room.pinned.byName}</span>
          </div>
          {iMod && (
            <div className="pinned-tools">
              <button type="button" className="pinned-btn" aria-label="تعديل الإعلان" onClick={() => { setPinText(room.pinned.text); setPinOpen(true) }}>✏️</button>
              <button type="button" className="pinned-btn" aria-label="شيل الإعلان" onClick={unpin}>✕</button>
            </div>
          )}
        </div>
      )}

      {game && !kicked && (
        <GameCard roomId={id} game={game} iMod={iMod} me={user.uid} myName={profile?.name || ''}
          showToast={showToast} openBoard={() => setBoardOpen(true)} />
      )}

      {kicked ? (
        <div className="kemet-bg messages"><p className="chat-empty">🚫 انت مطرود من الغرفة دي.{'\n'}تقدر ترجع بعد {timeLeft(mine.until)}.</p></div>
      ) : error ? (
        <div className="kemet-bg messages"><p className="chat-empty">مقدرناش نجيب الرسايل. اتأكد من النت وجرب تاني.</p></div>
      ) : raw === null ? (
        <div className="kemet-bg messages"><p className="chat-empty">بيحمّل الرسايل...</p></div>
      ) : (
        <MessageList chat={chat} empty="مفيش رسايل لسه — ابدأ انت الكلام 👋" />
      )}
      {myBan ? (
        <div className="restricted-bar"><b>حسابك اتحظر من الأدمن</b>تقدر تقرا بس، مش هتقدر تبعت رسايل.</div>
      ) : kicked ? null : mine?.type === 'mute' ? (
        <div className="restricted-bar"><b>انت مكتوم في الغرفة دي</b>تقدر تكتب تاني بعد {timeLeft(mine.until)}.</div>
      ) : (
        <Composer chat={chat}
          mentionables={mentionables} busy={busy} />
      )}

      {membersOpen && (
        <Sheet onClose={() => setMembersOpen(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">أعضاء الغرفة</h2>
          <p className="sheet-sub">
            {iAdmin ? 'انت الأدمن: تقدر تعيّن مشرفين وتكتم وتطرد أي حد.'
              : iMod ? 'انت مشرف في الغرفة دي، تقدر تكتم أو تطرد أي عضو بيضايق الناس.'
              : 'الموجودين في الغرفة دلوقتي. دوس «خاص» علشان تكلم أي حد.'}
          </p>
          {iMod && room && (
            <div className="mod-tools room-photo-tools">
              <RoomPhotoButton room={room} showToast={showToast} className="pill-btn pill-gold" />
            </div>
          )}
          <div className="mod-tools game-sheet-tools">
            {iMod && <button type="button" className="pill-btn pill-gold" onClick={() => { setMembersOpen(false); setGameOpen(true) }}>🎮 ابدأ مسابقة</button>}
            <button type="button" className="pill-btn" onClick={() => { setMembersOpen(false); setBoardOpen(true) }}>🏆 ترتيب المسابقة</button>
          </div>
          {iMod && (
            <button type="button" className="pill-btn pill-gold pin-open" onClick={() => { setMembersOpen(false); setPinText(room?.pinned?.text || ''); setPinOpen(true) }}>
              📌 {room?.pinned ? 'تعديل الإعلان المثبّت' : 'تثبيت إعلان'}
            </button>
          )}
          {sortedMembers.map((p) => {
            const role = roleOf(roles, id, p.uid)
            const r = restrictions[p.uid]
            return (
              <div key={p.uid} className="member">
                <span role="link" onClick={() => navigate(`/u/${p.uid}`)}><MemberAvatar uid={p.uid} name={p.name} c={p.c} /></span>
                <div className="member-body">
                  <span className="member-name member-link" role="link" onClick={() => navigate(`/u/${p.uid}`)}>
                    <UserName name={p.name} role={role} />
                    {p.uid === user.uid && <span className="mod-chip">انت</span>}
                  </span>
                  {r
                    ? <span className="status-muted">{r.type === 'mute' ? 'مكتوم' : 'مطرود'} — باقي {timeLeft(r.until)}</span>
                    : (online.has(p.uid) || p.uid === user.uid) && <span className="status-on"><span className="green-dot" /> متصل</span>}
                </div>
                {p.uid !== user.uid && (
                  <button type="button" className="pill-btn" onClick={() => navigate(`/dm/${p.uid}`)}>خاص</button>
                )}
                {(canAct(p.uid) || (iAdmin && p.uid !== user.uid && !isAdminUid(roles, p.uid))) && (
                  <div className="member-tools">
                    {canAct(p.uid) && (r ? (
                      <button type="button" className="pill-btn" onClick={() => lift(p)}>{r.type === 'mute' ? 'إلغاء الكتم' : 'إلغاء الطرد'}</button>
                    ) : (
                      <>
                        <button type="button" className="pill-btn" onClick={() => act(p, 'mute', 1)}>كتم ساعة</button>
                        <button type="button" className="pill-btn" onClick={() => act(p, 'mute', 24)}>كتم يوم</button>
                        <button type="button" className="pill-btn pill-danger" onClick={() => act(p, 'ban', 24)}>طرد يوم</button>
                        <button type="button" className="pill-btn pill-danger" onClick={() => act(p, 'ban', 24 * 7)}>طرد أسبوع</button>
                      </>
                    ))}
                    {iAdmin && !isAdminUid(roles, p.uid) && (
                      role === 'mod'
                        ? <button type="button" className="pill-btn" onClick={() => toggleMod(p, false)}>شيل الإشراف</button>
                        : <button type="button" className="pill-btn pill-gold" onClick={() => toggleMod(p, true)}>خليه مشرف</button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </Sheet>
      )}
      {photoView && room?.photo && (
        <div className="viewer" role="dialog" aria-label={`صورة ${name}`} onClick={() => setPhotoView(false)}>
          <img src={room.photo} alt={name} />
        </div>
      )}

      {pinOpen && (
        <Sheet onClose={() => setPinOpen(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">📌 الإعلان المثبّت</h2>
          <p className="sheet-sub">هيظهر فوق في الغرفة لكل الأعضاء.</p>
          <form className="new-room" onSubmit={(e) => { e.preventDefault(); doPin(pinText) }}>
            <textarea className="input textarea" rows="4" maxLength={300} placeholder="اكتب الإعلان..." value={pinText} onChange={(e) => setPinText(e.target.value)} autoFocus />
            <button type="submit" className="btn-primary">ثبّت الإعلان</button>
            {room?.pinned && <button type="button" className="btn-outline" onClick={() => { setPinOpen(false); unpin() }}>شيل الإعلان</button>}
          </form>
        </Sheet>
      )}
      {gameOpen && (
        <StartGameSheet roomId={id} me={user.uid} myName={profile?.name || ''} running={game && game.status !== 'ended'}
          onClose={() => setGameOpen(false)} showToast={showToast} />
      )}
      {boardOpen && <LeaderboardSheet me={user.uid} onClose={() => setBoardOpen(false)} />}
      {toast}
    </main>
  )
}
