// "متصل الآن": كل عضو بيحدّث وجوده كل ٤٠ ثانية.
// لو خرج من الغرفة أو قفل التطبيق بيفضل ظاهر متصل ٥ دقايق وبعدين يختفي
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  collection, doc, query, where, onSnapshot, setDoc, deleteDoc, serverTimestamp, orderBy, limit, getCountFromServer, Timestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'

export const ONLINE_MS = 5 * 60 * 1000
const BEAT_MS = 40 * 1000

// فرق ساعة الموبايل عن ساعة السيرفر (علشان لو ساعة الموبايل مش مظبوطة)
let skew = 0
export const serverNow = () => Date.now() + skew

// بيشتغل مرة واحدة في التطبيق كله
export function usePresenceHeartbeat(uid, room, visible, name) {
  useEffect(() => {
    if (!uid) return
    const ref = doc(db, 'presence', uid)
    if (!visible) {
      deleteDoc(ref).catch(() => {})
      return
    }
    // جوه غرفة: بنحدّث الغرفة ووقتها. برّه: بنحدّث "فاتح التطبيق" بس، والغرفة القديمة تفضل ٥ دقايق
    const beat = () => {
      if (document.visibilityState === 'hidden') return
      const data = room ? { room, at: serverTimestamp(), roomAt: serverTimestamp(), ...(name ? { name } : {}) } : { at: serverTimestamp() }
      setDoc(ref, data, { merge: true }).catch(() => {})
    }
    beat()
    const t = setInterval(beat, BEAT_MS)
    // لما السيرفر يأكد آخر تحديث بنحسب فرق الساعة
    const unsub = onSnapshot(ref, (s) => {
      if (s.metadata.hasPendingWrites || !s.exists()) return
      const at = s.data().at?.toMillis?.()
      if (at && Math.abs(Date.now() - at) < 10 * 60 * 1000 + Math.abs(skew)) skew = at - Date.now()
    }, () => {})
    const onVis = () => { if (document.visibilityState === 'visible') beat() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); unsub(); document.removeEventListener('visibilitychange', onVis) }
  }, [uid, room, visible, name])
}

// بنحدّث الشاشة كل شوية علشان اللي خرج يختفي لوحده
export function useNow(ms = 10000) {
  const [now, setNow] = useState(serverNow())
  useEffect(() => { const t = setInterval(() => setNow(serverNow()), ms); return () => clearInterval(t) }, [ms])
  return now
}

const atOf = (d) => d.data({ serverTimestamps: 'estimate' }).at?.toMillis?.() || 0
// آخر مرة كان جوه الغرفة (النسخ القديمة مكانش فيها roomAt)
const roomAtOf = (d) => {
  const x = d.data({ serverTimestamps: 'estimate' })
  return (x.roomAt || x.at)?.toMillis?.() || 0
}

// مين موجود في الغرفة دلوقتي
// ===== "متصل الآن" في الغرفة (معمول يستحمل آلاف الأعضاء) =====
// مابنسمعش نبضات كل الأعضاء (ده كان بيتقّل جامد): العدد بنعدّه من السيرفر كل دقيقة،
// والقايمة بنجيبها بس لما حد يفتح "الأعضاء"، ودخول الأعضاء بيوصل كحدث صغير لوحده
const roomCutoff = () => Timestamp.fromMillis(serverNow() - ONLINE_MS)
export function useRoomOnlineCount(roomId) {
  const [n, setN] = useState(null)
  useEffect(() => {
    let alive = true
    const load = () => getCountFromServer(query(collection(db, 'presence'), where('room', '==', roomId), where('roomAt', '>=', roomCutoff())))
      .then((r) => alive && setN(r.data().count)).catch(() => {})
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 60000)
    return () => { alive = false; clearInterval(t) }
  }, [roomId])
  return n
}
// قايمة الموجودين (آخر ١٥٠ دخلوا) — بس وقت ما قايمة الأعضاء مفتوحة
export function useRoomPeople(roomId, enabled) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) { setList(null); return }
    return onSnapshot(query(collection(db, 'presence'), where('room', '==', roomId), where('roomAt', '>=', roomCutoff()), orderBy('roomAt', 'desc'), limit(150)),
      (s) => setList(s.docs.map((d) => ({ uid: d.id, name: d.data().name || '' }))), () => setList([]))
  }, [roomId, enabled])
  return list
}
// "فلان دخل الغرفة": كل عضو بيكتب حدث صغير لما يدخل، والباقيين بيسمعوا الأحداث الجديدة بس
export function announceJoin(roomId, uid, name) {
  return setDoc(doc(db, 'rooms', roomId, 'joins', uid), { name, at: serverTimestamp() })
}
export function useRoomJoins(roomId, me) {
  const [list, setList] = useState([])
  useEffect(() => {
    setList([])
    const since = Timestamp.fromMillis(serverNow())
    return onSnapshot(query(collection(db, 'rooms', roomId, 'joins'), where('at', '>', since), orderBy('at', 'desc'), limit(20)),
      (s) => setList(s.docs.filter((d) => d.id !== me && !d.metadata.hasPendingWrites)
        .map((d) => ({ uid: d.id, name: d.data().name, at: d.data().at?.toDate?.() || new Date() }))),
      () => setList([]))
  }, [roomId, me])
  return list
}

// عضو معيّن متصل ولا لأ (في أي حتة في التطبيق)
export function useUserOnline(uid) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!uid) return
    let at = 0
    const check = () => setOn(serverNow() - at < ONLINE_MS)
    const unsub = onSnapshot(doc(db, 'presence', uid), (s) => { at = s.exists() ? atOf(s) : 0; check() }, () => { at = 0; check() })
    const t = setInterval(check, 15000)
    return () => { unsub(); clearInterval(t) }
  }, [uid])
  return on
}
