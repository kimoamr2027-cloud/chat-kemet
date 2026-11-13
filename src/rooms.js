// الغرف والرسايل الحقيقية من Firestore
import { useEffect, useState } from 'react'
import {
  collection, doc, query, orderBy, limit, onSnapshot, addDoc, setDoc, updateDoc,
  serverTimestamp, deleteField,
} from 'firebase/firestore'
import { db } from './firebase.js'

// الغرف الأساسية — لازم تطابق اللي في firestore.rules بالظبط
export const DEFAULT_ROOMS = {
  pyramids: { name: 'غرفة الأهرامات', order: 1 },
  nile: { name: 'نهر النيل', order: 2 },
  luxor: { name: 'الأقصر وأسوان', order: 3 },
  alex: { name: 'إسكندرية', order: 4 },
  youth: { name: 'شباب كيمت', order: 5 },
  history: { name: 'تاريخ مصر القديمة', order: 6 },
}

let seeded = false
// لو غرفة أساسية مش موجودة، أول عضو يدخل بيعملها
async function seedMissing(existingIds) {
  if (seeded) return
  seeded = true
  const missing = Object.keys(DEFAULT_ROOMS).filter((id) => !existingIds.includes(id))
  await Promise.all(missing.map((id) => setDoc(doc(db, 'rooms', id), DEFAULT_ROOMS[id]).catch(() => {})))
}

export function useRooms() {
  const [rooms, setRooms] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => onSnapshot(
    query(collection(db, 'rooms'), orderBy('order')),
    (snap) => {
      setRooms(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      if (!snap.metadata.fromCache) seedMissing(snap.docs.map((d) => d.id))
    },
    (e) => setError(e),
  ), [])
  return { rooms, error }
}

export function useRoom(id) {
  const [room, setRoom] = useState(undefined)
  useEffect(() => onSnapshot(doc(db, 'rooms', id),
    (s) => setRoom(s.exists() ? { id: s.id, ...s.data() } : (s.metadata.fromCache ? undefined : null)),
    () => setRoom(null)), [id])
  return room
}

const toMsg = (d) => {
  const data = d.data({ serverTimestamps: 'estimate' })
  return { id: d.id, ...data, at: data.createdAt?.toDate?.() || new Date(), pending: d.metadata.hasPendingWrites }
}

// آخر رسالة في الغرفة (لقايمة الغرف)
export const preview = (m) => (m.kind === 'sticker' ? 'ستيكر' : m.kind === 'image' ? '📷 صورة' : m.kind === 'voice' ? '🎤 رسالة صوتية' : m.text)

export function useLastMessage(roomId) {
  const [msg, setMsg] = useState(undefined)
  useEffect(() => onSnapshot(
    query(collection(db, 'rooms', roomId, 'messages'), orderBy('createdAt', 'desc'), limit(1)),
    (snap) => setMsg(snap.empty ? null : toMsg(snap.docs[0])),
    () => setMsg(null),
  ), [roomId])
  return msg
}

// رسايل الغرفة لحظيًا (آخر ٢٠٠ رسالة)
export function useMessages(roomId) {
  const [msgs, setMsgs] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => onSnapshot(
    query(collection(db, 'rooms', roomId, 'messages'), orderBy('createdAt', 'desc'), limit(200)),
    (snap) => setMsgs(snap.docs.map(toMsg).reverse()),
    (e) => setError(e),
  ), [roomId])
  return { msgs, error }
}

export function sendRoomMessage(roomId, profile, uid, { kind, text, sticker, media, w, h, dur, replyTo }) {
  const data = { uid, name: profile.name, gender: profile.gender, kind, createdAt: serverTimestamp() }
  if (kind === 'text') data.text = text.slice(0, 1000)
  if (kind === 'sticker') data.sticker = sticker
  if (kind === 'image') Object.assign(data, { media, w, h })
  if (kind === 'voice') Object.assign(data, { media, dur })
  if (replyTo) {
    data.replyTo = { name: replyTo.who.slice(0, 30), text: replyTo.text.slice(0, 200) }
    if (replyTo.uid) data.replyTo.uid = replyTo.uid
  }
  return addDoc(collection(db, 'rooms', roomId, 'messages'), data)
}

// كل عضو يقدر يغيّر تفاعله هو بس
export function setReaction(roomId, msgId, uid, emoji) {
  return updateDoc(doc(db, 'rooms', roomId, 'messages', msgId), {
    [`reactions.${uid}`]: emoji || deleteField(),
  })
}

// شكل الوقت: ٩:١٥ م / أمس / الإثنين / ١٢‏/١١
export function fmtTime(d) {
  if (!d) return ''
  return d.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })
}
export function fmtWhen(d) {
  if (!d) return ''
  const now = new Date()
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86400000)
  if (diff <= 0) return fmtTime(d)
  if (diff === 1) return 'أمس'
  if (diff < 7) return d.toLocaleDateString('ar-EG', { weekday: 'long' })
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })
}
export function fmtDay(d) {
  const now = new Date()
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86400000)
  if (diff <= 0) return 'النهارده'
  if (diff === 1) return 'أمس'
  return d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })
}

// لون ثابت لكل عضو حسب الـ uid
export function colorIndex(uid = '') {
  let h = 0
  for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 5
}
