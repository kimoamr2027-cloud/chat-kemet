// الرسائل الخاصة الحقيقية من Firestore
import { useEffect, useState } from 'react'
import {
  collection, doc, query, where, orderBy, limit, onSnapshot, writeBatch, updateDoc, deleteDoc,
  addDoc, serverTimestamp, increment, deleteField,
} from 'firebase/firestore'
import { db, auth } from './firebase.js'

// رقم المحادثة = رقمين العضوين مترتبين
export const chatIdFor = (a, b) => [a, b].sort().join('_')
export const otherOf = (chat, me) => chat.members.find((m) => m !== me)

// بيانات أي عضو (مع كاش بسيط)
const userCache = new Map()
export function useUser(uid) {
  const [u, setU] = useState(() => (uid ? userCache.get(uid) : null))
  useEffect(() => {
    if (!uid) return
    return onSnapshot(doc(db, 'users', uid), (s) => {
      const v = s.exists() ? { id: s.id, ...s.data() } : null
      userCache.set(uid, v)
      setU(v)
    }, () => setU(null))
  }, [uid])
  return u
}

// محادثاتي (مترتبة بآخر رسالة)
export function useChats(me) {
  const [chats, setChats] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => onSnapshot(
    query(collection(db, 'chats'), where('members', 'array-contains', me)),
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data({ serverTimestamps: 'estimate' })
        return { id: d.id, ...data, at: data.updatedAt?.toDate?.() || new Date() }
      })
      list.sort((a, b) => b.at - a.at)
      setChats(list)
    },
    (e) => setError(e),
  ), [me])
  return { chats, error }
}

export function useChatDoc(chatId) {
  // undefined = بيحمّل، null = لسه مفيش محادثة
  const [chat, setChat] = useState(undefined)
  useEffect(() => onSnapshot(doc(db, 'chats', chatId),
    (s) => setChat(s.exists() ? { id: s.id, ...s.data({ serverTimestamps: 'estimate' }) } : null),
    () => setChat(null)), [chatId])
  return chat
}

export function useChatMessages(chatId, enabled) {
  const [msgs, setMsgs] = useState(null)
  const [lim, setLim] = useState(50)
  const [more, setMore] = useState(false)
  useEffect(() => {
    if (!enabled) { setMsgs([]); return }
    return onSnapshot(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(lim)),
      (snap) => {
        setMore(snap.size >= lim)
        setMsgs(snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: 'estimate' })
          return { id: d.id, ...data, at: data.createdAt?.toDate?.() || new Date(), pending: d.metadata.hasPendingWrites }
        }).reverse())
      },
      () => setMsgs([]),
    )
  }, [chatId, enabled, lim])
  if (msgs) { msgs.more = more; msgs.loadMore = () => setLim((l) => Math.min(l + 50, 400)) }
  return msgs
}

// بعت رسالة: الرسالة + تحديث المحادثة في نفس اللحظة (القواعد بتشترط كده)
export async function sendDM({ me, other, exists, kind, text, sticker, media, w, h, dur, replyTo, table, thumb }) {
  const chatId = chatIdFor(me, other)
  const preview = kind === 'sticker' ? 'ستيكر' : kind === 'image' ? '📷 صورة' : kind === 'voice' ? '🎤 رسالة صوتية' : text.slice(0, 100)
  const b = writeBatch(db)
  const chatRef = doc(db, 'chats', chatId)
  const last = { uid: me, text: preview, at: serverTimestamp() }
  if (exists) {
    b.update(chatRef, { last, updatedAt: serverTimestamp(), [`unread.${other}`]: increment(1), [`active.${me}`]: true })
  } else {
    b.set(chatRef, {
      members: [me, other].sort(), last, updatedAt: serverTimestamp(), createdAt: serverTimestamp(),
      unread: { [other]: 1 }, active: { [me]: true },
    })
  }
  const msg = { uid: me, kind, createdAt: serverTimestamp() }
  if (kind === 'text') msg.text = text.slice(0, 1000)
  if (kind === 'sticker') msg.sticker = sticker
  if (kind === 'image') Object.assign(msg, { media, w, h, ...(thumb ? { thumb } : {}) })
  if (kind === 'voice') Object.assign(msg, { media, dur })
  if (kind === 'ludo') Object.assign(msg, { text: text.slice(0, 200), table })
  if (replyTo) msg.replyTo = { name: replyTo.who.slice(0, 30), text: replyTo.text.slice(0, 200) }
  const ref = doc(collection(db, 'chats', chatId, 'messages'))
  b.set(ref, msg)
  await b.commit()
  return ref.id
}

// بكتب دلوقتي (بيتبعت كل ٣ ثواني بالكتير)
const lastTyping = new Map()
export function sendTyping(chatId, me) {
  const t = Date.now()
  if (t - (lastTyping.get(chatId) || 0) < 3000) return
  lastTyping.set(chatId, t)
  updateDoc(doc(db, 'chats', chatId), { [`typing.${me}`]: serverTimestamp() }).catch(() => {})
}

// قريت المحادثة
export function markRead(chatId, me, withReceipt) {
  const patch = { [`unread.${me}`]: 0 }
  if (withReceipt) patch[`readAt.${me}`] = serverTimestamp()
  return updateDoc(doc(db, 'chats', chatId), patch)
}

export function setDMReaction(chatId, msgId, me, emoji) {
  return updateDoc(doc(db, 'chats', chatId, 'messages', msgId), {
    [`reactions.${me}`]: emoji || deleteField(),
  })
}

export const REPORT_REASONS = ['إزعاج أو رسائل كتير', 'كلام أو صور مش لائقة', 'تحرش أو تهديد', 'حساب مزيف أو نصب', 'حاجة تانية']

export function reportUser({ me, other, otherName, reason, chatId }) {
  return addDoc(collection(db, 'reports'), {
    reporter: me, reported: other, reportedName: (otherName || '').slice(0, 30),
    reason, chatId, createdAt: serverTimestamp(),
  })
}

// ===== تعديل ومسح رسايلي في الخاص =====
export async function editDM(chatId, msgId, text, isLast, lastAt) {
  await updateDoc(doc(db, 'chats', chatId, 'messages', msgId), { text: text.slice(0, 1000), edited: true, editedAt: serverTimestamp() })
  if (isLast) fixLast(chatId, text, lastAt)
}
export async function deleteDM(chatId, m, isLast, lastAt) {
  await deleteDoc(doc(db, 'chats', chatId, 'messages', m.id))
  if (m.media) deleteDoc(doc(db, 'chats', chatId, 'media', m.media)).catch(() => {})
  if (isLast) fixLast(chatId, '🚫 رسالة اتمسحت', lastAt)
}
// معاينة آخر رسالة في قايمة الرسائل
function fixLast(chatId, text, at) {
  return updateDoc(doc(db, 'chats', chatId), { last: { uid: auth.currentUser.uid, text: text.slice(0, 100), at } }).catch(() => {})
}
