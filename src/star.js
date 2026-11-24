// نجم الأسبوع (أنشط عضو في الغرف الأسبوع اللي فات) — السيرفر بيحسبه كل اتنين في config/star
// التطبيق كله بيقرا مستند واحد بس
import { useSyncExternalStore } from 'react'
import { pb, live } from './pb/client.js'

const IS_PB = import.meta.env.VITE_BACKEND === 'pb'
const EMPTY = null
let state = EMPTY
let started = false
const subs = new Set()
const emit = (s) => { state = s; subs.forEach((f) => f()) }
function start() {
  if (started || !IS_PB) return
  started = true
  const set = (r) => emit(r?.data?.uid ? r.data : null)
  pb.collection('config').getOne('star').then(set).catch(() => { started = false })
  live('config', 'star', (ev) => set(ev.record))
}
function subscribe(f) { start(); subs.add(f); return () => subs.delete(f) }
export const useStar = () => useSyncExternalStore(subscribe, () => state, () => EMPTY)
