// القبايل: قايمة القبايل وقبيلة كل عضو (علشان الشارة جنب الاسم) — التطبيق كله بيقرا نسخة واحدة
import { useSyncExternalStore } from 'react'
import { pb } from './pb/client.js'

const IS_PB = import.meta.env.VITE_BACKEND === 'pb'
const EMPTY = { tribes: {}, of: {} }
let state = EMPTY
let started = false
const subs = new Set()
const emit = (s) => { state = s; subs.forEach((f) => f()) }
export async function reloadTribes() {
  if (!IS_PB || !pb.authStore.isValid) return
  try {
    const [tr, us] = await Promise.all([
      pb.collection('tribes').getFullList({ sort: 'order', fields: 'id,name,icon' }),
      pb.collection('users').getFullList({ filter: "tribe!=''", fields: 'id,tribe', batch: 1000 }),
    ])
    emit({ tribes: Object.fromEntries(tr.map((t) => [t.id, t])), of: Object.fromEntries(us.map((u) => [u.id, u.tribe])) })
  } catch { started = false }
}
function start() {
  if (started || !IS_PB) return
  started = true
  reloadTribes()
  setInterval(() => { if (document.visibilityState === 'visible') reloadTribes() }, 10 * 60000)
}
function subscribe(f) { start(); subs.add(f); return () => subs.delete(f) }
const useTribesState = () => useSyncExternalStore(subscribe, () => state, () => EMPTY)
// قبيلة العضو (أو null)
export function useTribeOf(uid) {
  const s = useTribesState()
  const id = uid ? s.of[uid] : ''
  return id ? s.tribes[id] || null : null
}
export const joinTribe = (tribe) => pb.send('/api/kemet/tribe/join', { method: 'POST', body: { tribe } }).then(reloadTribes)
export const loadTribes = () => pb.send('/api/kemet/tribes', { method: 'GET' })
