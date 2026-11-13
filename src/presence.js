// "متصل الآن": كل عضو بيحدّث وجوده كل ٢٠ ثانية.
// لو خرج من الغرفة أو قفل التطبيق بيفضل ظاهر متصل ٥ دقايق وبعدين يختفي
import { useEffect, useState } from 'react'
import { collection, doc, query, where, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'

export const ONLINE_MS = 5 * 60 * 1000
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
    // جوه غرفة: بنحدّث الغرفة ووقتها. برّه: بنحدّث "فاتح التطبيق" بس، والغرفة القديمة تفضل ٥ دقايق
    const beat = () => {
      if (document.visibilityState === 'hidden') return
      const data = room ? { room, at: serverTimestamp(), roomAt: serverTimestamp() } : { at: serverTimestamp() }
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
  }, [uid, room, visible])
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
export function useRoomOnline(roomId) {
  const [map, setMap] = useState({})
  const now = useNow(10000)
  useEffect(() => onSnapshot(query(collection(db, 'presence'), where('room', '==', roomId)),
    (s) => setMap(Object.fromEntries(s.docs.map((d) => [d.id, roomAtOf(d)]))),
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
