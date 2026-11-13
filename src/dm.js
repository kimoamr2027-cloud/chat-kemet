// الرسائل الخاصة الحقيقية من Firestore
import { useEffect, useState } from 'react'
import {
  collection, doc, query, where, orderBy, limit, onSnapshot, writeBatch, updateDoc,
  addDoc, serverTimestamp, increment, deleteField,
} from 'firebase/firestore'
import { db } from './firebase.js'

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
  useEffect(() => {
    if (!enabled) { setMsgs([]); return }
    return onSnapshot(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(200)),
      (snap) => setMsgs(snap.docs.map((d) => {
        const data = d.data({ serverTimestamps: 'estimate' })
        return { id: d.id, ...data, at: data.createdAt?.toDate?.() || new Date(), pending: d.metadata.hasPendingWrites }
      }).reverse()),
      () => setMsgs([]),
    )
  }, [chatId, enabled])
  return msgs
}

// بعت رسالة: الرسالة + تحديث المحادثة في نفس اللحظة (القواعد بتشترط كده)
export async function sendDM({ me, other, exists, kind, text, sticker, media, w, h, dur, replyTo }) {
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
  if (kind === 'image') Object.assign(msg, { media, w, h })
  if (kind === 'voice') Object.assign(msg, { media, dur })
  if (replyTo) msg.replyTo = { name: replyTo.who.slice(0, 30), text: replyTo.text.slice(0, 200) }
  const ref = doc(collection(db, 'chats', chatId, 'messages'))
  b.set(ref, msg)
  await b.commit()
  return ref.id
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
