import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Back, Members } from '../components/Icons.jsx'
import { Avatar, Crown, Sheet, UserName, useToast } from '../components/ui.jsx'
import { MessageList, Composer } from '../components/Chat.jsx'
import { useUser } from '../dm.js'
import { roomInitial } from '../data.js'
import { useAuth, joinRoom } from '../auth.jsx'
import {
  DEFAULT_ROOMS, useRoom, useMessages, sendRoomMessage, setReaction,
  fmtTime, fmtDay, colorIndex, preview, useRoomMembers,
} from '../rooms.js'
import { ar, REACTIONS } from '../utils.js'
import { notify } from '../notifs.js'
import { compressImage, uploadMedia, useVoiceRecorder } from '../media.js'
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
  const { msgs: raw, error } = useMessages(id, !kicked)
  const joinedMembers = useRoomMembers(id)
  const iAdmin = isAdminUid(roles, user.uid)
  const iMod = canModerate(roles, id, user.uid)
  const [draft, setDraft] = useState('')
  const [sel, setSel] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [stickersOpen, setStickersOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
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
    if (!joined && DEFAULT_ROOMS[id]) joinRoom(user.uid, id).catch(() => {})
  }, [joined, id, user.uid])

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
      sticker: m.sticker,
      w: m.w, h: m.h, dur: m.dur,
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
  const members = useMemo(() => {
    const map = new Map()
    for (const u of joinedMembers || []) map.set(u.uid, { uid: u.uid, name: u.name, c: colorIndex(u.uid) })
    for (const m of raw || []) if (!map.has(m.uid)) map.set(m.uid, { uid: m.uid, name: m.name, c: colorIndex(m.uid) })
    if (profile) map.set(user.uid, { uid: user.uid, name: profile.name, c: colorIndex(user.uid) })
    // المكتومين والمطرودين يظهروا في القايمة حتى لو رسايلهم مش ظاهرة
    for (const [uid, r] of Object.entries(restrictions)) if (!map.has(uid)) map.set(uid, { uid, name: r.name || 'عضو', c: colorIndex(uid) })
    return [...map.values()]
  }, [raw, joinedMembers, profile, user.uid, restrictions])

  const rank = (uid) => (isAdminUid(roles, uid) ? 0 : isModUid(roles, id, uid) ? 1 : uid === user.uid ? 2 : 3)
  const sortedMembers = [...members].sort((a, b) => rank(a.uid) - rank(b.uid) || a.name.localeCompare(b.name, 'ar'))

  if (room === null && !DEFAULT_ROOMS[id]) return <Navigate to="/rooms" replace />
  const name = room?.name || DEFAULT_ROOMS[id]?.name || ''
  const order = (room?.order || DEFAULT_ROOMS[id]?.order || 1) - 1

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
          for (const mb of members) {
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
      const img = await compressImage(file)
      setBusy('بتترفع الصورة...')
      const media = await uploadMedia(`rooms/${id}/media`, user.uid, 'image', 'image/jpeg', img.base64)
      send({ kind: 'image', media, w: img.w, h: img.h })
    } catch {
      showToast('الصورة ماتبعتتش، جرب تاني')
    }
    setBusy('')
  }
  const chat = {
    msgs, sel, draft, setDraft, replyTo, stickersOpen, typing: false, dm: false, ...voice, sendImage,
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
    sendText: () => { const t = draft.trim(); if (t) send({ kind: 'text', text: t }) },
    sendSticker: (i) => send({ kind: 'sticker', sticker: i }),
    canDelete: (m) => !m.pending && (m.me || iMod),
    remove: (m) => {
      setSel(null)
      deleteRoomMessage(id, m.id).then(() => showToast('الرسالة اتمسحت')).catch(() => showToast('مقدرناش نمسح الرسالة'))
    },
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
    setMod(id, p.uid, on, user.uid, profile.name)
      .then(() => showToast(on ? `${p.name} بقى مشرف في ${name}` : `${p.name} مبقاش مشرف`))
      .catch(() => showToast('حصلت مشكلة، جرب تاني'))
  }

  const subtitle = raw === null ? 'بيحمّل...' : `${ar(members.length)} ${members.length === 1 || members.length > 10 ? 'عضو' : 'أعضاء'} في الغرفة`

  return (
    <main className="screen chat-screen">
      <header className="head head-row chat-head">
        <Link to="/rooms" aria-label="رجوع" className="icon-btn"><Back /></Link>
        <Avatar text={roomInitial(name)} c={order} size={44} />
        <button type="button" className="head-titles head-titles-btn" onClick={() => { setMembersOpen(true); setSel(null) }}>
          <span className="head-name">{name}</span>
          <span className="head-status">{subtitle} ‹</span>
        </button>
        <button type="button" className="members-btn" onClick={() => { setMembersOpen(true); setSel(null) }}><Members />الأعضاء</button>
      </header>

      {/* شريط الأعضاء: الأدمن الأول، بعده المشرفين، بعده الباقي */}
      {!kicked && sortedMembers.length > 0 && (
        <div className="members-box">
        <button type="button" className="members-box-head" onClick={() => { setMembersOpen(true); setSel(null) }}>
          <span className="members-box-title"><Members />قائمة الأعضاء <span className="members-count">{ar(sortedMembers.length)}</span></span>
          <span className="members-box-all">عرض الكل ‹</span>
        </button>
        <div className="members-strip" role="list" aria-label="قائمة الأعضاء">
          {sortedMembers.map((p) => {
            const role = roleOf(roles, id, p.uid)
            return (
              <button key={p.uid} type="button" role="listitem" className="strip-member"
                onClick={() => { setMembersOpen(true); setSel(null) }}>
                <span className={`strip-avatar ${role ? 'strip-' + role : ''}`}>
                  <MemberAvatar uid={p.uid} name={p.name} c={p.c} size={52} />
                  {role === 'admin' && <span className="strip-crown"><Crown size={18} /></span>}
                  {restrictions[p.uid] && <span className="strip-muted" aria-label="مكتوم">🔇</span>}
                </span>
                <span className={`strip-name ${role === 'admin' ? 'name-admin' : ''}`}>{p.uid === user.uid ? 'انت' : p.name}</span>
              </button>
            )
          })}
        </div>
        </div>
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
          mentionables={members.filter((mb) => mb.uid !== user.uid)} busy={busy} />
      )}

      {membersOpen && (
        <Sheet onClose={() => setMembersOpen(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">أعضاء الغرفة</h2>
          <p className="sheet-sub">
            {iAdmin ? 'انت الأدمن: تقدر تعيّن مشرفين وتكتم وتطرد أي حد.'
              : iMod ? 'انت مشرف في الغرفة دي، تقدر تكتم أو تطرد أي عضو بيضايق الناس.'
              : 'كل اللي دخلوا الغرفة دي. دوس «خاص» علشان تكلم أي حد.'}
          </p>
          {sortedMembers.map((p) => {
            const role = roleOf(roles, id, p.uid)
            const r = restrictions[p.uid]
            return (
              <div key={p.uid} className="member">
                <MemberAvatar uid={p.uid} name={p.name} c={p.c} />
                <div className="member-body">
                  <span className="member-name">
                    <UserName name={p.name} role={role} />
                    {p.uid === user.uid && <span className="mod-chip">انت</span>}
                  </span>
                  {r && <span className="status-muted">{r.type === 'mute' ? 'مكتوم' : 'مطرود'} — باقي {timeLeft(r.until)}</span>}
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
      {toast}
    </main>
  )
}
