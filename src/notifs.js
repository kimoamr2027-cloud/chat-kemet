// الإشعارات الحقيقية (جوه التطبيق)
import { useEffect, useState } from 'react'
import {
  collection, doc, query, where, orderBy, limit, onSnapshot, setDoc, addDoc, updateDoc, writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'

const items = (uid) => collection(db, 'notifications', uid, 'items')

// إشعار لعضو تاني — لو اترفض (حاظرني أو قافل النوع ده) بنتجاهله
export function notify(to, me, myName, data, id) {
  if (!to || to === me) return Promise.resolve()
  const payload = { ...data, from: me, fromName: myName, text: (data.text || '').slice(0, 120), createdAt: serverTimestamp(), read: false }
  const p = id ? setDoc(doc(items(to), id), payload) : addDoc(items(to), payload)
  return p.catch(() => {})
}

export function useNotifications(uid) {
  const [list, setList] = useState(null)
  useEffect(() => onSnapshot(
    query(items(uid), orderBy('createdAt', 'desc'), limit(100)),
    (snap) => setList(snap.docs.map((d) => {
      const data = d.data({ serverTimestamps: 'estimate' })
      return { id: d.id, ...data, at: data.createdAt?.toDate?.() || new Date() }
    })),
    () => setList([]),
  ), [uid])
  return list
}

export function useUnreadNotifs(uid) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!uid) return
    return onSnapshot(query(items(uid), where('read', '==', false), limit(99)), (s) => setN(s.size), () => setN(0))
  }, [uid])
  return n
}

// آخر إشعار (للشريط اللي بيظهر فوق)
export function useLatestNotif(uid) {
  const [n, setN] = useState(null)
  useEffect(() => {
    if (!uid) return
    return onSnapshot(query(items(uid), orderBy('createdAt', 'desc'), limit(1)), (s) => {
      const d = s.docs[0]
      if (!d || d.metadata.hasPendingWrites) return
      const data = d.data({ serverTimestamps: 'estimate' })
      setN({ id: d.id, ...data, at: data.createdAt?.toDate?.() || new Date() })
    }, () => {})
  }, [uid])
  return n
}

export function markNotifRead(uid, id) {
  return updateDoc(doc(items(uid), id), { read: true }).catch(() => {})
}

export function markAllRead(uid, list) {
  const unread = list.filter((x) => !x.read)
  if (!unread.length) return Promise.resolve()
  const b = writeBatch(db)
  unread.forEach((x) => b.update(doc(items(uid), x.id), { read: true }))
  return b.commit()
}

export { notifTarget, notifAction, ago, beep } from './notifsShared.js'
