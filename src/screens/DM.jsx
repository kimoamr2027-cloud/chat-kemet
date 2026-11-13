import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Back, Dots, Lock, Block, Flag } from '../components/Icons.jsx'
import { Avatar, Radio, Sheet, useToast } from '../components/ui.jsx'
import { MessageList, Composer } from '../components/Chat.jsx'
import { useAuth, blockUser, unblockUser } from '../auth.jsx'
import {
  chatIdFor, useUser, useChatDoc, useChatMessages, sendDM, markRead, setDMReaction,
  reportUser, REPORT_REASONS,
} from '../dm.js'
import { fmtTime, fmtDay, colorIndex } from '../rooms.js'
import { ar, REACTIONS } from '../utils.js'

const summary = (m) => (m.kind === 'sticker' ? 'ستيكر' : m.text)

export default function DM() {
  const { id: other } = useParams()
  const { user, profile, privacy } = useAuth()
  const me = user.uid
  const chatId = chatIdFor(me, other)
  const person = useUser(other)
  const chat = useChatDoc(chatId)
  const raw = useChatMessages(chatId, !!chat)
  const [draft, setDraft] = useState('')
  const [sel, setSel] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [stickersOpen, setStickersOpen] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [reason, setReason] = useState(null)
  const [toast, showToast] = useToast()

  const blocked = !!privacy.blocked?.[other]
  const receipts = privacy.receipts !== false
  const name = person?.name || ''

  // أول ما أفتح المحادثة: أصفّر غير المقروء وأسجّل إني قريت
  const unreadMine = chat?.unread?.[me] || 0
  const lastAt = chat?.last?.at?.toMillis?.() || 0
  const myReadAt = chat?.readAt?.[me]?.toMillis?.() || 0
  const needsRead = chat && chat.last?.uid !== me && (unreadMine > 0 || (receipts && myReadAt < lastAt))
  useEffect(() => {
    if (needsRead) markRead(chatId, me, receipts).catch(() => {})
  }, [needsRead, chatId, me, receipts])

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
    setDraft(''); setReplyTo(null); setStickersOpen(false); setSel(null)
    sendDM({ me, other, exists: !!chat, ...extra, replyTo: reply }).catch((e) => {
      if (extra.kind === 'text') setDraft(extra.text)
      showToast(e?.code === 'permission-denied'
        ? `${name || "العضو ده"} مش بيستقبل رسايل خاصة منك دلوقتي`
        : 'الرسالة ماتبعتتش، جرب تاني')
    })
  }

  const chatApi = {
    msgs, sel, draft, setDraft, replyTo, stickersOpen, recording: false, typing: false, dm: true,
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
        <Avatar text={name.charAt(0) || '؟'} c={colorIndex(other)} size={44} round />
        <div className="head-titles">
          <span className="head-name">{name || '...'}</span>
          <span className="head-status muted">{blocked ? 'محظور' : details}</span>
        </div>
        <button type="button" className="icon-btn" aria-label="خيارات" onClick={() => { setSheet('menu'); setSel(null) }}><Dots /></button>
      </header>

      <div className="private-note"><Lock />محادثة خاصة بينك وبين {name || 'العضو ده'} بس</div>

      {chat === undefined || (chat && raw === null) ? (
        <div className="kemet-bg messages"><p className="chat-empty">بيحمّل...</p></div>
      ) : (
        <MessageList chat={chatApi} empty={person?.bio ? `«${person.bio}»\nابدأ الكلام مع ${name} 👋` : `ابدأ الكلام مع ${name} 👋`} />
      )}

      {blocked ? (
        <div className="blocked-bar">
          <span>انت حظرت {name}. مش هيقدر يبعتلك رسائل خاصة.</span>
          <button type="button" className="pill-btn pill-lg" onClick={() => unblockUser(me, other).then(() => showToast('اتلغى الحظر')).catch(() => showToast('حصلت مشكلة، جرب تاني'))}>إلغاء الحظر</button>
        </div>
      ) : (
        <Composer chat={chatApi}
          onImage={() => showToast('إرسال الصور جاي في المرحلة الجاية')}
          onMic={() => showToast('الرسايل الصوتية جاية في المرحلة الجاية')} />
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
