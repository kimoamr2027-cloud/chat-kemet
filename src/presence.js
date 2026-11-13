// "متصل الآن": كل عضو بيحدّث وجوده كل ٢٠ ثانية، ولو عدّت دقيقة من غير تحديث يبقى مش متصل
import { useEffect, useState } from 'react'
import { collection, doc, query, where, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'

export const ONLINE_MS = 60 * 1000
const BEAT_MS = 20 * 1000

// فرق ساعة الموبايل عن ساعة السيرفر (علشان لو ساعة الموبايل مش مظبوطة)
let skew = 0
export const serverNow = () => Date.now() + skew

// بيشتغل مرة واحدة في التطبيق كله
export function usePresenceHeartbeat(uid, room, visible) {
  useEffect(() => {
    if (!uid) return
    const ref = doc(db, 'presence', uid)
    if (!visible) {
      deleteDoc(ref).catch(() => {})
      return
    }
    const beat = () => {
      if (document.visibilityState === 'hidden') return
      setDoc(ref, { room: room || '', at: serverTimestamp() }).catch(() => {})
    }
    beat()
    const t = setInterval(beat, BEAT_MS)
    // لما السيرفر يأكد آخر تحديث بنحسب فرق الساعة
    const unsub = onSnapshot(ref, (s) => {
      if (s.metadata.hasPendingWrites || !s.exists()) return
      const at = s.data().at?.toMillis?.()
      if (at && Math.abs(Date.now() - at) < 10 * 60 * 1000 + Math.abs(skew)) skew = at - Date.now()
    }, () => {})
    const onVis = () => {
      if (document.visibilityState === 'visible') beat()
      // لما التطبيق يتقفل أو يروح في الخلفية: نعلّم إنه خرج من الغرفة
      else setDoc(ref, { room: '', at: serverTimestamp() }).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); unsub(); document.removeEventListener('visibilitychange', onVis) }
  }, [uid, room, visible])
}

// بنحدّث الشاشة كل شوية علشان اللي خرج يختفي لوحده
export function useNow(ms = 10000) {
  const [now, setNow] = useState(serverNow())
  useEffect(() => { const t = setInterval(() => setNow(serverNow()), ms); return () => clearInterval(t) }, [ms])
  return now
}

const atOf = (d) => d.data({ serverTimestamps: 'estimate' }).at?.toMillis?.() || 0

// مين موجود في الغرفة دلوقتي
export function useRoomOnline(roomId) {
  const [map, setMap] = useState({})
  const now = useNow(10000)
  useEffect(() => onSnapshot(query(collection(db, 'presence'), where('room', '==', roomId)),
    (s) => setMap(Object.fromEntries(s.docs.map((d) => [d.id, atOf(d)]))),
    () => setMap({})), [roomId])
  return new Set(Object.entries(map).filter(([, at]) => now - at < ONLINE_MS).map(([uid]) => uid))
}

// عضو معيّن متصل ولا لأ (في أي حتة في التطبيق)
export function useUserOnline(uid) {
  const [at, setAt] = useState(0)
  const now = useNow(10000)
  useEffect(() => {
    if (!uid) return
    return onSnapshot(doc(db, 'presence', uid), (s) => setAt(s.exists() ? atOf(s) : 0), () => setAt(0))
  }, [uid])
  return now - at < ONLINE_MS
}
