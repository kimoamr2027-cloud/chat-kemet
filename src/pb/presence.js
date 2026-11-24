// "متصل الآن" من سيرفر PocketBase (نفس شكل src/presence.js)
import { useEffect, useState } from 'react'
import { pb, q, live, toDate, pbTime } from './client.js'

export const ONLINE_MS = 5 * 60 * 1000
const BEAT_MS = 40 * 1000

// فرق ساعة الموبايل عن ساعة السيرفر
let skew = 0
export const serverNow = () => Date.now() + skew

// بيشتغل مرة واحدة في التطبيق كله
export function usePresenceHeartbeat(uid, room, visible) {
  useEffect(() => {
    if (!uid) return
    const col = pb.collection('presence')
    if (!visible) { col.delete(uid).catch(() => {}); return }
    const beat = () => {
      if (document.visibilityState === 'hidden' || !pb.authStore.isValid) return
      const body = room ? { room } : {}
      col.update(uid, body)
        .catch((e) => (e?.status === 404 ? col.create({ id: uid, ...body }) : Promise.reject(e)))
        .then((r) => { const at = toDate(r?.at)?.getTime(); if (at) skew = at - Date.now() })
        .catch(() => {})
    }
    beat()
    const t = setInterval(beat, BEAT_MS)
    const onVis = () => { if (document.visibilityState === 'visible') beat() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [uid, room, visible])
}

export function useNow(ms = 10000) {
  const [now, setNow] = useState(serverNow())
  useEffect(() => { const t = setInterval(() => setNow(serverNow()), ms); return () => clearInterval(t) }, [ms])
  return now
}

const cutoff = () => pbTime(new Date(serverNow() - ONLINE_MS))

// عدد المتصلين في الغرفة (من السيرفر كل دقيقة)
export function useRoomOnlineCount(roomId) {
  const [n, setN] = useState(null)
  useEffect(() => {
    let alive = true
    const load = () => pb.collection('presence').getList(1, 1, { filter: `room=${q(roomId)} && roomAt>=${q(cutoff())}`, fields: 'id' })
      .then((r) => alive && setN(r.totalItems)).catch(() => {})
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 60000)
    // حد دخل الغرفة: نعدّ تاني (مرة كل ٣ ثواني بالكتير)
    let soon = null
    const off = live('joins', '*', () => { if (!soon) soon = setTimeout(() => { soon = null; load() }, 3000) }, { filter: `room=${q(roomId)}` })
    return () => { alive = false; clearInterval(t); clearTimeout(soon); off() }
  }, [roomId])
  return n
}

// ===== خانة «المتصلين» =====
// كل المتصلين دلوقتي (آخر ٢٠٠)، وبتتحدّث كل ٣٠ ثانية وانت فاتح الخانة
export function useOnlineList(enabled = true) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const load = () => pb.collection('presence').getList(1, 200, { filter: `at>=${q(cutoff())}`, sort: '-at', fields: 'id,name,room,roomAt', skipTotal: true })
      .then((r) => alive && setList(r.items.map((x) => ({ uid: x.id, name: x.name || '', room: x.room || '', roomAt: toDate(x.roomAt)?.getTime() || 0 }))))
      .catch(() => alive && setList((l) => l || []))
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [enabled])
  return list
}
// عدد المتصلين (للشريط اللي تحت) — كل دقيقة
export function useOnlineCount() {
  const [n, setN] = useState(null)
  useEffect(() => {
    let alive = true
    const load = () => pb.collection('presence').getList(1, 1, { filter: `at>=${q(cutoff())}`, fields: 'id' }).then((r) => alive && setN(r.totalItems)).catch(() => {})
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return n
}

// قايمة الموجودين (آخر ١٥٠) — بس وقت ما قايمة الأعضاء مفتوحة، وبتتحدّث كل ٢٠ ثانية
export function useRoomPeople(roomId, enabled) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) { setList(null); return }
    let alive = true
    const load = () => pb.collection('presence').getList(1, 150, { filter: `room=${q(roomId)} && roomAt>=${q(cutoff())}`, sort: '-roomAt', fields: 'id,name', skipTotal: true })
      .then((r) => alive && setList(r.items.map((x) => ({ uid: x.id, name: x.name || '' })))).catch(() => alive && setList([]))
    load()
    const t = setInterval(load, 20000)
    return () => { alive = false; clearInterval(t) }
  }, [roomId, enabled])
  return list
}

// "فلان دخل الغرفة"
export function announceJoin(roomId, uid) {
  const id = `${roomId}_${uid}`
  const col = pb.collection('joins')
  return col.update(id, { room: roomId }).catch((e) => (e?.status === 404 ? col.create({ id, room: roomId }) : Promise.reject(e)))
}
export function useRoomJoins(roomId, me) {
  const [list, setList] = useState([])
  useEffect(() => {
    setList([])
    const since = Date.now() + skew
    return live('joins', '*', (ev) => {
      const r = ev.record
      const at = toDate(r.at)
      if (r.uid === me || !at || at.getTime() < since - 5000) return
      setList((l) => [{ uid: r.uid, name: r.name, at }, ...l.filter((x) => x.uid !== r.uid)].slice(0, 20))
    }, { filter: `room=${q(roomId)}` })
  }, [roomId, me])
  return list
}

// عضو معيّن: متصل ولا لأ، وآخر ظهور، وهو في أنهي غرفة
// (اللي قافل «يظهر إني متصل» مالوش سجل، فمش بيبان عنه حاجة)
export function useUserPresence(uid) {
  const [p, setP] = useState({ at: 0, room: '', roomAt: 0 })
  const [, tick] = useState(0)
  useEffect(() => {
    if (!uid) return
    const set = (r) => setP(r ? { at: toDate(r.at)?.getTime() || 0, room: r.room || '', roomAt: toDate(r.roomAt)?.getTime() || 0 } : { at: 0, room: '', roomAt: 0 })
    pb.collection('presence').getOne(uid, { fields: 'at,room,roomAt' }).then(set).catch(() => set(null))
    const off = live('presence', uid, (ev) => set(ev.action === 'delete' ? null : ev.record))
    const t = setInterval(() => tick((x) => x + 1), 15000)
    return () => { off(); clearInterval(t) }
  }, [uid])
  const now = serverNow()
  const online = !!p.at && now - p.at < ONLINE_MS
  return { online, at: p.at, room: online && p.room && now - p.roomAt < ONLINE_MS ? p.room : '' }
}
export const useUserOnline = (uid) => useUserPresence(uid).online
