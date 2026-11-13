import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Back, Dots, Lock, Block, Flag } from '../components/Icons.jsx'
import { Avatar, Radio, Sheet, UserName, useToast } from '../components/ui.jsx'
import { MessageList, Composer } from '../components/Chat.jsx'
import { useAuth, blockUser, unblockUser } from '../auth.jsx'
import { isAdminUid } from '../roles.js'
import {
  chatIdFor, useUser, useChatDoc, useChatMessages, sendDM, markRead, setDMReaction,
  reportUser, REPORT_REASONS, sendTyping,
} from '../dm.js'
import { useUserOnline, useNow } from '../presence.js'
import { fmtTime, fmtDay, colorIndex, preview } from '../rooms.js'
import { ar, REACTIONS } from '../utils.js'
import { notify, markNotifRead } from '../notifs.js'
import { compressImage, uploadMedia, useVoiceRecorder, usePhotos } from '../media.js'

const summary = (m) => preview(m)

function ProfileCard({ person, uid, admin }) {
  const photos = usePhotos(uid) || []
  const [view, setView] = useState(null)
  const details = [person.city, person.age ? `${ar(person.age)} سنة` : '', person.gender === 'female' ? 'أنثى' : 'ذكر'].filter(Boolean).join(' · ')
  return (
    <div className="profile-card">
      <Avatar text={person.name.charAt(0)} c={colorIndex(uid)} size={96} round src={person.avatar} />
      <h2 className="sheet-title"><UserName name={person.name} role={admin ? 'admin' : null} /></h2>
      <span className="row-time">{details}</span>
      {person.bio && <p className="profile-bio">{person.bio}</p>}
      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((ph) => (
            <button key={ph.id} type="button" className="photo" onClick={() => setView(ph.src)}><img src={ph.src} alt="صورة" /></button>
          ))}
        </div>
      )}
      {view && (
        <div className="viewer" role="dialog" onClick={() => setView(null)}><img src={view} alt="صورة" /></div>
      )}
    </div>
  )
}

export default function DM() {
  const { id: other } = useParams()
  const { user, profile, privacy, roles, myBan } = useAuth()
  const me = user.uid
  const chatId = chatIdFor(me, other)
  const person = useUser(other)
  const chat = useChatDoc(chatId)
  const raw = useChatMessages(chatId, !!chat)
  const [draft, setDraftRaw] = useState('')
  const [sel, setSel] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [stickersOpen, setStickersOpen] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [reason, setReason] = useState(null)
  const [toast, showToast] = useToast()
  // صور وفويس
  const [busy, setBusy] = useState('')
  const voice = useVoiceRecorder({
    onError: showToast,
    onDone: async ({ data, mime, dur }) => {
      setBusy('بيترفع الفويس...')
      try {
        const media = await uploadMedia(`chats/${chatId}/media`, me, 'voice', mime, data)
        send({ kind: 'voice', media, dur })
      } catch {
        showToast('الفويس ماتبعتش، جرب تاني')
      }
      setBusy('')
    },
  })

  const blocked = !!privacy.blocked?.[other]
  const isOnline = useUserOnline(other)
  // جاري الكتابة: التاني كتب في آخر ٦ ثواني
  const now = useNow(1000)
  const otherTypingAt = chat?.typing?.[other]?.toMillis?.() || 0
  const otherTyping = !blocked && now - otherTypingAt < 6000
  const setDraft = (v) => {
    setDraftRaw(v)
    if (chat && v.trim() && !myBan) sendTyping(chatId, me)
  }
  const receipts = privacy.receipts !== false
  const name = person?.name || ''

  // أول ما أفتح المحادثة: أصفّر غير المقروء وأسجّل إني قريت
  const unreadMine = chat?.unread?.[me] || 0
  const lastAt = chat?.last?.at?.toMillis?.() || 0
  const myReadAt = chat?.readAt?.[me]?.toMillis?.() || 0
  const needsRead = chat && chat.last?.uid !== me && (unreadMine > 0 || (receipts && myReadAt < lastAt))
  useEffect(() => {
    if (needsRead) {
      markRead(chatId, me, receipts).catch(() => {})
      markNotifRead(me, `dm_${other}`)
    }
  }, [needsRead, chatId, me, receipts, other])

  const otherReadAt = receipts ? (chat?.readAt?.[other]?.toMillis?.() || 0) : 0

  const msgs = useMemo(() => (raw || []).map((m) => {
    const reactions = m.reactions || {}
    const counts = {}
    for (const e of Object.values(reactions)) counts[e] = (counts[e] || 0) + 1
    const order = REACTIONS.map(([e]) => e)
    const reactLabel = Object.entries(counts)
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([e, n]) => (n > 1 ? `${e} ${ar(n)}` : e)).join(' ')
    return {
      id: m.id,
      me: m.uid === me,
      who: m.uid === me ? profile.name : name,
      kind: m.kind,
      text: m.text,
      sticker: m.sticker,
      w: m.w, h: m.h, dur: m.dur,
      mediaPath: m.media ? `chats/${chatId}/media/${m.media}` : null,
      replyTo: m.replyTo ? { who: m.replyTo.name, text: m.replyTo.text } : null,
      mine: reactions[me] || null,
      reactLabel,
      time: fmtTime(m.at),
      dayLabel: fmtDay(m.at),
      pending: m.pending,
      status: otherReadAt && m.at.getTime() <= otherReadAt ? 'read' : 'delivered',
    }
  }), [raw, me, profile.name, name, otherReadAt])

  if (other === me) return <Navigate to="/messages" replace />
  if (person === null) {
    return (
      <main className="screen">
        <header className="head head-row">
          <Link to="/messages" aria-label="رجوع" className="icon-btn"><Back /></Link>
          <h1 className="h-small">رسالة خاصة</h1>
        </header>
        <p className="empty">العضو ده مش موجود.</p>
      </main>
    )
  }

  function send(extra) {
    const reply = replyTo
    setDraftRaw(''); setReplyTo(null); setStickersOpen(false); setSel(null)
    sendDM({ me, other, exists: !!chat, ...extra, replyTo: reply }).then((msgId) => {
      notify(other, me, profile.name, { type: 'dm', msgId, text: preview(extra) }, `dm_${me}`)
    }).catch((e) => {
      if (extra.kind === 'text') setDraftRaw(extra.text)
      showToast(e?.code === 'permission-denied'
        ? `${name || "العضو ده"} مش بيستقبل رسايل خاصة منك دلوقتي`
        : 'الرسالة ماتبعتتش، جرب تاني')
    })
  }



  async function sendImage(file) {
    setBusy('بتجهّز الصورة...')
    try {
      const img = await compressImage(file)
      setBusy('بتترفع الصورة...')
      const media = await uploadMedia(`chats/${chatId}/media`, me, 'image', 'image/jpeg', img.base64)
      send({ kind: 'image', media, w: img.w, h: img.h })
    } catch {
      showToast('الصورة ماتبعتتش، جرب تاني')
    }
    setBusy('')
  }
  const chatApi = {
    msgs, sel, draft, setDraft, replyTo, stickersOpen, typing: otherTyping, dm: true, ...voice, sendImage,
    pick: (mid) => { setSel((s) => (s === mid ? null : mid)); setStickersOpen(false) },
    clearSel: () => setSel(null),
    react: (mid, e) => {
      setSel(null)
      const m = msgs.find((x) => x.id === mid)
      setDMReaction(chatId, mid, me, m?.mine === e ? null : e).catch(() => showToast('مقدرناش نحفظ التفاعل'))
    },
    reply: (m) => { setSel(null); setReplyTo({ who: m.me ? profile.name : name, text: summary(m) }) },
    cancelReply: () => setReplyTo(null),
    toggleStickers: () => { setStickersOpen((o) => !o); setSel(null) },
    sendText: () => { const t = draft.trim(); if (t) send({ kind: 'text', text: t }) },
    sendSticker: (i) => send({ kind: 'sticker', sticker: i }),
  }

  const details = [person?.city, person?.age ? `${ar(person.age)} سنة` : '', person?.gender === 'female' ? 'أنثى' : person ? 'ذكر' : '']
    .filter(Boolean).join(' · ')

  return (
    <main className="screen chat-screen">
      <header className="head head-row chat-head">
        <Link to="/messages" aria-label="رجوع" className="icon-btn"><Back /></Link>
        <button type="button" className="head-person" aria-label={`بيانات ${name}`} onClick={() => { setSheet('profile'); setSel(null) }}>
          <Avatar text={name.charAt(0) || '؟'} c={colorIndex(other)} size={44} round src={person?.avatar} />
        <div className="head-titles">
          <span className="head-name"><UserName name={name || '...'} role={isAdminUid(roles, other) ? 'admin' : null} /></span>
          {blocked ? <span className="head-status muted">محظور</span>
            : otherTyping ? <span className="head-status">جاري الكتابة...</span>
            : isOnline ? <span className="head-status">● متصل الآن</span>
            : <span className="head-status muted">{details}</span>}
        </div>
        </button>
        <button type="button" className="icon-btn" aria-label="خيارات" onClick={() => { setSheet('menu'); setSel(null) }}><Dots /></button>
      </header>

      <div className="private-note"><Lock />محادثة خاصة بينك وبين {name || 'العضو ده'} بس</div>

      {chat === undefined || (chat && raw === null) ? (
        <div className="kemet-bg messages"><p className="chat-empty">بيحمّل...</p></div>
      ) : (
        <MessageList chat={chatApi} empty={person?.bio ? `«${person.bio}»\nابدأ الكلام مع ${name} 👋` : `ابدأ الكلام مع ${name} 👋`} />
      )}

      {myBan ? (
        <div className="restricted-bar"><b>حسابك اتحظر من الأدمن</b>مش هتقدر تبعت رسايل.</div>
      ) : blocked ? (
        <div className="blocked-bar">
          <span>انت حظرت {name}. مش هيقدر يبعتلك رسائل خاصة.</span>
          <button type="button" className="pill-btn pill-lg" onClick={() => unblockUser(me, other).then(() => showToast('اتلغى الحظر')).catch(() => showToast('حصلت مشكلة، جرب تاني'))}>إلغاء الحظر</button>
        </div>
      ) : (
        <Composer chat={chatApi} busy={busy} />
      )}

      {sheet === 'profile' && person && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="grabber" aria-hidden="true" />
          <ProfileCard person={person} uid={other} admin={isAdminUid(roles, other)} />
        </Sheet>
      )}

      {sheet === 'menu' && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="grabber" aria-hidden="true" />
          {blocked
            ? <button type="button" className="menu-item" onClick={() => { setSheet(null); unblockUser(me, other).then(() => showToast('اتلغى الحظر')) }}><Block />إلغاء حظر {name}</button>
            : <button type="button" className="menu-item danger" onClick={() => setSheet('block')}><Block />حظر {name}</button>}
          <button type="button" className="menu-item danger" onClick={() => { setReason(null); setSheet('report') }}><Flag />إبلاغ عن {name}</button>
        </Sheet>
      )}

      {sheet === 'block' && (
        <Sheet onClose={() => setSheet(null)} className="sheet-center">
          <h2 className="sheet-title">حظر {name}؟</h2>
          <p className="sheet-text">مش هيقدر يبعتلك رسائل خاصة. {name} مش هيعرف إنك حظرته.</p>
          <button type="button" className="btn-danger" onClick={() => {
            setSheet(null)
            blockUser(me, other, name).then(() => showToast(`اتحظر ${name}`)).catch(() => showToast('حصلت مشكلة، جرب تاني'))
          }}>حظر</button>
          <button type="button" className="btn-outline" onClick={() => setSheet(null)}>إلغاء</button>
        </Sheet>
      )}

      {sheet === 'report' && (
        <Sheet onClose={() => setSheet(null)}>
          <h2 className="sheet-title">إبلاغ عن {name}</h2>
          <p className="sheet-sub">إيه المشكلة؟ البلاغ سري ومحدش هيعرف إنك اللي بلّغت.</p>
          <div role="radiogroup" aria-label="سبب البلاغ" className="radio-list">
            {REPORT_REASONS.map((label, i) => (
              <button key={i} type="button" role="radio" aria-checked={reason === i}
                className={`choice choice-start ${reason === i ? 'choice-on' : ''}`} onClick={() => setReason(i)}>
                <Radio on={reason === i} />{label}
              </button>
            ))}
          </div>
          <button type="button" className={`btn-danger ${reason === null ? 'disabled' : ''}`} onClick={() => {
            if (reason === null) return
            setSheet(null)
            reportUser({ me, other, otherName: name, reason: REPORT_REASONS[reason], chatId })
              .then(() => showToast('وصلنا بلاغك، وفريق كيمت هيراجعه'))
              .catch(() => showToast('البلاغ ماتبعتش، جرب تاني'))
          }}>إرسال البلاغ</button>
        </Sheet>
      )}
      {toast}
    </main>
  )
}
