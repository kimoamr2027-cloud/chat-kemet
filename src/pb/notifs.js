// الإشعارات من سيرفر PocketBase (نفس شكل src/notifs.js)
// السيرفر هو اللي بيكتب الإشعار بعد ما يتأكد إن وراه رسالة/رد/تفاعل حقيقي
import { useEffect, useState } from 'react'
import { pb, q, live, toDate } from './client.js'
export { notifTarget, notifAction, ago, beep } from '../notifsShared.js'

const toNotif = (r) => ({ ...r, at: toDate(r.at) || new Date() })
const mine = (uid) => `owner=${q(uid)}`

// إشعار لعضو تاني — لو اترفض (حاظرني أو قافل النوع ده) بنتجاهله
export function notify(to, me, myName, data) {
  if (!to || to === me) return Promise.resolve()
  const { type, msgId, roomId, emoji, text } = data
  return pb.send('/api/kemet/notify', { method: 'POST', body: { to, type, msgId, roomId, emoji, text: (text || '').slice(0, 120) } }).catch(() => {})
}

export function useNotifications(uid) {
  const [list, setList] = useState(null)
  useEffect(() => {
    let map = null
    const early = []
    const put = (ev) => { if (ev.action === 'delete') map.delete(ev.record.id); else map.set(ev.record.id, toNotif(ev.record)) }
    const emit = () => setList([...map.values()].sort((a, b) => b.at - a.at).slice(0, 100))
    const off = live('notifications', '*', (ev) => { if (!map) return early.push(ev); put(ev); emit() }, { filter: mine(uid) })
    pb.collection('notifications').getList(1, 100, { filter: mine(uid), sort: '-at', skipTotal: true })
      .then((r) => { map = new Map(r.items.map((x) => [x.id, toNotif(x)])); early.forEach(put); emit() })
      .catch(() => setList([]))
    return off
  }, [uid])
  return list
}

export function useUnreadNotifs(uid) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!uid) return
    let alive = true
    let soon = null
    const load = () => pb.collection('notifications').getList(1, 1, { filter: `${mine(uid)} && read=false`, fields: 'id' })
      .then((r) => alive && setN(Math.min(r.totalItems, 99))).catch(() => {})
    load()
    const off = live('notifications', '*', () => { clearTimeout(soon); soon = setTimeout(load, 300) }, { filter: mine(uid) })
    return () => { alive = false; clearTimeout(soon); off() }
  }, [uid])
  return n
}

// آخر إشعار (للشريط اللي بيظهر فوق)
export function useLatestNotif(uid) {
  const [n, setN] = useState(null)
  useEffect(() => {
    if (!uid) return
    pb.collection('notifications').getList(1, 1, { filter: mine(uid), sort: '-at', skipTotal: true })
      .then((r) => r.items[0] && setN(toNotif(r.items[0]))).catch(() => {})
    // جديد أو اتحدّث (إشعار الخاص بيتحدّث مع كل رسالة) ولسه مش مقري
    return live('notifications', '*', (ev) => {
      if (ev.action !== 'delete' && !ev.record.read) setN(toNotif(ev.record))
    }, { filter: mine(uid) })
  }, [uid])
  return n
}

export function markNotifRead(uid, id) {
  return pb.collection('notifications').update(id, { read: true }).catch(() => {})
}

export function markAllRead(uid, list) {
  if (!list.some((x) => !x.read)) return Promise.resolve()
  return pb.send('/api/kemet/notifs/read-all', { method: 'POST' })
}
