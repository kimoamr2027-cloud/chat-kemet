// الإشعارات الحقيقية (جوه التطبيق)
import { useEffect, useState } from 'react'
import {
  collection, doc, query, where, orderBy, limit, onSnapshot, setDoc, addDoc, updateDoc, writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { ar } from './utils.js'

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

export function notifTarget(n) {
  return n.type === 'dm' ? `/dm/${n.from}` : `/rooms/${n.roomId}`
}

export function notifAction(n) {
  if (n.type === 'dm') return 'بعتلك رسالة خاصة'
  if (n.type === 'reply') return `رد على رسالتك في ${n.roomName}`
  if (n.type === 'mention') return `ذكر اسمك في ${n.roomName}`
  if (n.type === 'react') return `تفاعل بـ ${n.emoji} على رسالتك في ${n.roomName}`
  if (n.type === 'mod') return `خلّاك مشرف في ${n.roomName} 🛡`
  return ''
}

// "من ٥ دقايق"
export function ago(d) {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'دلوقتي'
  const m = Math.floor(s / 60)
  if (m < 60) return m === 1 ? 'من دقيقة' : m === 2 ? 'من دقيقتين' : `من ${ar(m)} دقايق`
  const h = Math.floor(m / 60)
  if (h < 24) return h === 1 ? 'من ساعة' : h === 2 ? 'من ساعتين' : `من ${ar(h)} ساعات`
  const days = Math.floor(h / 24)
  if (days === 1) return 'أمس'
  if (days < 7) return `من ${ar(days)} أيام`
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })
}

// صوت تنبيه صغير
let audioCtx
export function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    const o = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(880, audioCtx.currentTime)
    o.frequency.setValueAtTime(660, audioCtx.currentTime + 0.12)
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3)
    o.connect(g).connect(audioCtx.destination)
    o.start()
    o.stop(audioCtx.currentTime + 0.32)
  } catch {}
}
