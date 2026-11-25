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

// تحدي لايف للايف ده (هو اللي بدأ أو اللي اتحدى)
export function useLivePk(liveId) {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!IS_PB || !liveId) return
    let map = new Map()
    const f = `liveA=${q(liveId)} || liveB=${q(liveId)}`
    const emit = () => setList([...map.values()].sort((a, b) => (b.created > a.created ? 1 : -1)))
    pb.collection('pks').getList(1, 5, { filter: f, sort: '-created', skipTotal: true }).then((r) => { map = new Map(r.items.map((x) => [x.id, x])); emit() }).catch(() => {})
    return live('pks', '*', (ev) => { if (ev.record.liveA !== liveId && ev.record.liveB !== liveId) return; map.set(ev.record.id, ev.record); emit() }, { filter: f })
  }, [liveId])
  const now = Date.now()
  return { cur: list.find((p) => p.status === 'live' || (p.status === 'invite' && p.endAt > now)) || null, last: list.find((p) => p.status === 'done') || null }
}
export const livePkAct = (body) => pb.send('/api/kemet/live/pk', { method: 'POST', body })

// 🎭 وقت العقاب: عقاب خفيف للخسران (بيتختار من رقم التحدي، فالكل بيشوف نفس العقاب)
export const DARES = [
  'يغنّي حتة من أغنية بيحبها 🎤', 'يقول نكتة تضحّك 😂', 'يقلّد صوت حيوان 🐐', 'يتكلم بلهجة صعيدي دقيقة 🌾',
  'يمدح الكسبان قدام الكل 👑', 'يقول حكمة فرعونية 📜', 'يعمل صوت معلّق كورة في جول ⚽', 'يحكي موقف محرج حصله 🙈',
  'يقول بيت شعر أو أغنية قديمة 🎭', 'يقول ٣ حاجات حلوة عن الكسبان 💐',
]
export function dareFor(pk) { let h = 0; for (const c of String(pk?.id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return DARES[h % DARES.length] }
export const PUNISH_MS = 60000
export const DOUBLE_MS = 60000

// 🔥 سلسلة انتصارات التحدي (٢ وفوق) — للشارة جنب الاسم
let streaksMap = {}
let streaksOn = false
const streakSubs = new Set()
function startStreaks() {
  if (streaksOn || !IS_PB) return
  streaksOn = true
  const load = () => { if (pb.authStore.isValid) pb.send('/api/kemet/pk/streaks', { method: 'GET' }).then((r) => { streaksMap = r || {}; streakSubs.forEach((f) => f()) }).catch(() => {}) }
  load()
  setInterval(() => { if (document.visibilityState === 'visible') load() }, 5 * 60000)
}
export function useStreak(uid) {
  return useSyncExternalStore((f) => { startStreaks(); streakSubs.add(f); return () => streakSubs.delete(f) }, () => (uid && streaksMap[uid]) || 0, () => 0)
}
export const pkBoard = () => pb.send('/api/kemet/pk/board', { method: 'GET' })
// العضو في أنهي ناحية في التحدي (اتنين أو فرق)
export function pkSideOf(pk, uid) {
  if (!pk || !uid) return ''
  if (pk.a === uid || (pk.teamA || []).includes(uid)) return 'A'
  if (pk.b === uid || (pk.teamB || []).includes(uid)) return 'B'
  return ''
}
