// مين زار بروفايلك + الأصحاب (سيرفر PocketBase)
import { useEffect, useState } from 'react'
import { pb, q, live, toDate } from './pb/client.js'

const IS_PB = import.meta.env.VITE_BACKEND === 'pb'

// ===== الزيارات =====
export const recordVisit = (uid) => (IS_PB ? pb.send('/api/kemet/visit', { method: 'POST', body: { uid } }).catch(() => {}) : Promise.resolve())
export function useVisitors(me) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!me || !IS_PB) return
    pb.collection('visits').getList(1, 100, { filter: `owner=${q(me)}`, sort: '-at', skipTotal: true })
      .then((r) => setList(r.items.map((x) => ({ uid: x.visitor, name: x.visitorName, n: x.n, at: toDate(x.at) })))).catch(() => setList([]))
  }, [me])
  return list
}
// عدد الزيارات الجديدة من آخر مرة فتحت القايمة
const SEEN = 'kemet-visits-seen'
export const markVisitsSeen = () => { try { localStorage.setItem(SEEN, String(Date.now())) } catch {} }
export function useNewVisits(me) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!me || !IS_PB) return
    let since = 0
    try { since = Number(localStorage.getItem(SEEN)) || 0 } catch {}
    pb.collection('visits').getList(1, 1, { filter: `owner=${q(me)} && at>${q(new Date(since).toISOString().replace('T', ' '))}`, fields: 'id' })
      .then((r) => setN(r.totalItems)).catch(() => {})
  }, [me])
  return n
}

// ===== الأصحاب =====
const toF = (r, me) => ({ id: r.id, other: r.a === me ? r.b : r.a, status: r.status, mine: r.from === me })
export function useFriends(me) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!me || !IS_PB) return
    const filter = `a=${q(me)} || b=${q(me)}`
    let map = new Map()
    const emit = () => setList([...map.values()])
    pb.collection('friends').getFullList({ filter }).then((r) => { map = new Map(r.map((x) => [x.id, toF(x, me)])); emit() }).catch(() => setList([]))
    return live('friends', '*', (ev) => { if (ev.action === 'delete') map.delete(ev.record.id); else map.set(ev.record.id, toF(ev.record, me)); emit() }, { filter })
  }, [me])
  return list
}
// حالة الصداقة مع عضو معيّن: '' / 'sent' / 'got' / 'ok'
export function friendState(list, uid) {
  const f = (list || []).find((x) => x.other === uid)
  if (!f) return ''
  return f.status === 'ok' ? 'ok' : f.mine ? 'sent' : 'got'
}
export const friendAct = (uid, action) => pb.send('/api/kemet/friend', { method: 'POST', body: { uid, action } })
