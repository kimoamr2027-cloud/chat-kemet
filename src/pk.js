// ⚔️ التحدي (PK) و💪 الدعم — من سيرفر PocketBase
import { useEffect, useState, useSyncExternalStore } from 'react'
import { pb, q, live } from './pb/client.js'

const IS_PB = import.meta.env.VITE_BACKEND === 'pb'

// التحدي في الغرفة: cur = دعوة أو لايف، last = آخر واحد خلص (للتاج والطماطم)
export function usePk(room) {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!IS_PB || !room) return
    let map = new Map()
    const emit = () => setList([...map.values()].sort((a, b) => (b.created > a.created ? 1 : -1)))
    pb.collection('pks').getList(1, 5, { filter: `room=${q(room)}`, sort: '-created', skipTotal: true })
      .then((r) => { map = new Map(r.items.map((x) => [x.id, x])); emit() }).catch(() => {})
    return live('pks', '*', (ev) => { if (ev.record.room !== room) return; map.set(ev.record.id, ev.record); emit() }, { filter: `room=${q(room)}` })
  }, [room])
  const now = Date.now()
  const cur = list.find((p) => p.status === 'live' || (p.status === 'invite' && p.endAt > now)) || null
  const last = list.find((p) => p.status === 'done') || null
  return { cur, last }
}
export const pkAct = (room, body) => pb.send('/api/kemet/pk', { method: 'POST', body: { room, ...body } })
export const pkRose = (id, to) => pb.send('/api/kemet/pk/rose', { method: 'POST', body: { id, to } }).catch(() => ({ ok: false }))
// أكبر ٣ داعمين لكل ناحية
export const topSup = (sup) => Object.entries(sup || {}).map(([uid, s]) => ({ uid, ...s })).sort((a, b) => b.n - a.n).slice(0, 3)

// ===== مستويات الداعمين (الشهر ده) =====
export const SUPPORT_TIERS = [null,
  { icon: '🥉', name: 'داعم برونز', min: 1000 }, { icon: '🥈', name: 'داعم فضة', min: 5000 },
  { icon: '🥇', name: 'داعم دهب', min: 20000 }, { icon: '💎', name: 'داعم ماسي', min: 50000 }]
let tiers = {}
let started = false
const subs = new Set()
function start() {
  if (started || !IS_PB) return
  started = true
  const load = () => { if (pb.authStore.isValid) pb.send('/api/kemet/supporters', { method: 'GET' }).then((r) => { tiers = r || {}; subs.forEach((f) => f()) }).catch(() => {}) }
  load()
  setInterval(() => { if (document.visibilityState === 'visible') load() }, 10 * 60000)
}
export const tierOf = (uid) => (uid && tiers[uid]) || 0
export function useSupportTier(uid) {
  return useSyncExternalStore((f) => { start(); subs.add(f); return () => subs.delete(f) }, () => tierOf(uid), () => 0)
}
export const supportersOf = (uid) => pb.send(`/api/kemet/supporters/of?uid=${encodeURIComponent(uid)}`, { method: 'GET' })
export const supportBoard = () => pb.send('/api/kemet/support/board', { method: 'GET' })
