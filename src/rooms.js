// الغرف والرسايل الحقيقية من Firestore
import { useEffect, useState } from 'react'
import {
  collection, doc, query, where, orderBy, limit, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, deleteField,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { PAGE } from './roomsShared.js'
export { DEFAULT_ROOMS, preview, fmtTime, fmtWhen, fmtDay, colorIndex, EDIT_WINDOW_MS, canEditMsg, PAGE } from './roomsShared.js'

export function useRooms() {
  const [rooms, setRooms] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => onSnapshot(
    query(collection(db, 'rooms'), orderBy('order')),
    (snap) => {
      setRooms(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
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

export function useLastMessage(roomId) {
  const [msg, setMsg] = useState(undefined)
  useEffect(() => onSnapshot(
    query(collection(db, 'rooms', roomId, 'messages'), orderBy('createdAt', 'desc'), limit(1)),
    (snap) => setMsg(snap.empty ? null : toMsg(snap.docs[0])),
    () => setMsg(null),
  ), [roomId])
  return msg
}

// رسايل الغرفة لحظيًا (آخر ٥٠ رسالة، وزرار "رسايل أقدم" بيجيب أكتر)
export function useMessages(roomId, enabled = true) {
  const [msgs, setMsgs] = useState(null)
  const [error, setError] = useState(null)
  const [lim, setLim] = useState(PAGE)
  const [more, setMore] = useState(false)
  useEffect(() => { setLim(PAGE) }, [roomId])
  useEffect(() => {
    if (!enabled) return
    setError(null)
    return onSnapshot(
      query(collection(db, 'rooms', roomId, 'messages'), orderBy('createdAt', 'desc'), limit(lim)),
      (snap) => { setMsgs(snap.docs.map(toMsg).reverse()); setMore(snap.size >= lim) },
      (e) => setError(e),
    )
  }, [roomId, enabled, lim])
  return { msgs, error, more, loadMore: () => setLim((l) => Math.min(l + PAGE, 400)) }
}

export function sendRoomMessage(roomId, profile, uid, { kind, text, sticker, media, w, h, dur, replyTo, table, thumb }) {
  const data = { uid, name: profile.name, gender: profile.gender, kind, createdAt: serverTimestamp() }
  if (kind === 'text') data.text = text.slice(0, 1000)
  if (kind === 'sticker') data.sticker = sticker
  if (kind === 'image') Object.assign(data, { media, w, h, ...(thumb ? { thumb } : {}) })
  if (kind === 'voice') Object.assign(data, { media, dur })
  if (kind === 'ludo' || kind === 'snakes' || kind === 'domino') Object.assign(data, { text: text.slice(0, 200), table })
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

// أعضاء الغرفة = كل اللي دخلوها (مسجّلة في users/{uid}.rooms)
// بيتحمّل بس لما قايمة الأعضاء تتفتح (كل عضو معاه صورته، فده تقيل لو الأعضاء كتير)
export function useRoomMembers(roomId, enabled = true) {
  const [list, setList] = useState(null)
  useEffect(() => !enabled ? undefined : onSnapshot(
    query(collection(db, 'users'), where('rooms', 'array-contains', roomId), limit(300)),
    (s) => setList(s.docs.map((d) => ({ uid: d.id, name: d.data().name, avatar: d.data().avatar }))),
    () => setList([]),
  ), [roomId, enabled])
  return list
}

// ===== الأدمن: غرف جديدة =====
export function createRoom(name, order, me) {
  return setDoc(doc(collection(db, 'rooms')), { name: name.trim().slice(0, 30), order, createdBy: me, createdAt: serverTimestamp() })
}
export const renameRoom = (id, name) => updateDoc(doc(db, 'rooms', id), { name: name.trim().slice(0, 30) })
export const removeRoom = (id) => deleteDoc(doc(db, 'rooms', id))
export const restoreRoom = () => Promise.reject(new Error('مش متاح'))
export const createMyRoom = () => Promise.reject(new Error('مش متاح'))
export const closeMyRoom = () => Promise.reject(new Error('مش متاح'))

// ===== تعديل ومسح رسايلي =====
export function editRoomMessage(roomId, msgId, text) {
  return updateDoc(doc(db, 'rooms', roomId, 'messages', msgId), { text: text.slice(0, 1000), edited: true, editedAt: serverTimestamp() })
}
export async function deleteOwnRoomMessage(roomId, m) {
  await deleteDoc(doc(db, 'rooms', roomId, 'messages', m.id))
  if (m.media) deleteDoc(doc(db, 'rooms', roomId, 'media', m.media)).catch(() => {})
}

// ===== الإعلان المثبّت (الأدمن أو مشرف الغرفة) =====
export function setPinned(roomId, text, me, myName) {
  return updateDoc(doc(db, 'rooms', roomId), { pinned: { text: text.trim().slice(0, 300), by: me, byName: myName, at: serverTimestamp() } })
}
export const clearPinned = (roomId) => updateDoc(doc(db, 'rooms', roomId), { pinned: null })

// ===== صورة الغرفة (الأدمن أو مشرف الغرفة) =====
export const setRoomPhoto = (roomId, dataUrl) => updateDoc(doc(db, 'rooms', roomId), { photo: dataUrl || '' })
