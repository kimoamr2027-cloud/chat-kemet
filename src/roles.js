// الأدمن والمشرفين: الكتم والطرد والحظر والبلاغات
import { useEffect, useState } from 'react'
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, orderBy, limit,
  arrayUnion, arrayRemove, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { DEFAULT_ROOMS } from './rooms.js'
import { notify } from './notifs.js'

export const EMPTY_ROLES = { admins: [], mods: {} }

export function useRolesDoc(enabled) {
  const [roles, setRoles] = useState(EMPTY_ROLES)
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(doc(db, 'config', 'roles'),
      (s) => setRoles(s.exists() ? { ...EMPTY_ROLES, ...s.data() } : EMPTY_ROLES),
      () => setRoles(EMPTY_ROLES))
  }, [enabled])
  return roles
}

export const isAdminUid = (roles, uid) => roles.admins.includes(uid)
export const isModUid = (roles, roomId, uid) => (roles.mods?.[roomId] || []).includes(uid)
export const canModerate = (roles, roomId, uid) => isAdminUid(roles, uid) || isModUid(roles, roomId, uid)
export function roleOf(roles, roomId, uid) {
  if (isAdminUid(roles, uid)) return 'admin'
  if (roomId && isModUid(roles, roomId, uid)) return 'mod'
  return null
}

// ===== المشرفين (الأدمن بس) =====
export async function setMod(roomId, uid, on, me, myName) {
  await updateDoc(doc(db, 'config', 'roles'), { [`mods.${roomId}`]: on ? arrayUnion(uid) : arrayRemove(uid) })
  if (on) notify(uid, me, myName, { type: 'mod', roomId, roomName: DEFAULT_ROOMS[roomId].name, text: '' })
}

// ===== الكتم والطرد من الغرفة =====
export function useRestrictions(roomId) {
  const [map, setMap] = useState({})
  const [now, setNow] = useState(Date.now())
  useEffect(() => onSnapshot(collection(db, 'rooms', roomId, 'restrict'),
    (s) => setMap(Object.fromEntries(s.docs.map((d) => [d.id, { ...d.data(), until: d.data().until?.toDate?.() }]))),
    () => setMap({})), [roomId])
  // نحدّث كل دقيقة علشان الكتم يخلص لوحده
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])
  const active = {}
  for (const [uid, r] of Object.entries(map)) if (r.until && r.until.getTime() > now) active[uid] = r
  return active
}

export function restrictUser({ roomId, uid, name, type, hours, me, myName }) {
  return setDoc(doc(db, 'rooms', roomId, 'restrict', uid), {
    type, until: Timestamp.fromMillis(Date.now() + hours * 3600 * 1000),
    name: (name || '').slice(0, 30), by: me, byName: myName, at: serverTimestamp(),
  })
}
export const liftRestriction = (roomId, uid) => deleteDoc(doc(db, 'rooms', roomId, 'restrict', uid))

export const deleteRoomMessage = (roomId, msgId) => deleteDoc(doc(db, 'rooms', roomId, 'messages', msgId))

// ===== الحظر من التطبيق كله (الأدمن بس) =====
export function useMyBan(uid) {
  const [ban, setBan] = useState(null)
  useEffect(() => {
    if (!uid) return
    return onSnapshot(doc(db, 'bans', uid), (s) => setBan(s.exists() ? s.data() : null), () => setBan(null))
  }, [uid])
  return ban
}
export function appBan(uid, name, reason, me) {
  return setDoc(doc(db, 'bans', uid), { name: (name || '').slice(0, 30), reason: (reason || '').slice(0, 200), by: me, at: serverTimestamp() })
}
export const appUnban = (uid) => deleteDoc(doc(db, 'bans', uid))

export function useAdminList(name) {
  const [list, setList] = useState(null)
  useEffect(() => onSnapshot(
    query(collection(db, name), orderBy(name === 'reports' ? 'createdAt' : 'at', 'desc'), limit(200)),
    (s) => setList(s.docs.map((d) => {
      const x = d.data()
      return { id: d.id, ...x, when: (x.createdAt || x.at)?.toDate?.() || new Date() }
    })),
    () => setList([]),
  ), [name])
  return list
}
export const deleteReport = (id) => deleteDoc(doc(db, 'reports', id))

export function timeLeft(until) {
  const m = Math.max(1, Math.round((until.getTime() - Date.now()) / 60000))
  if (m < 60) return `${m} دقيقة`
  const h = Math.round(m / 60)
  if (h < 24) return h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : `${h} ساعات`
  const d = Math.round(h / 24)
  return d === 1 ? 'يوم' : d === 2 ? 'يومين' : `${d} أيام`
}
