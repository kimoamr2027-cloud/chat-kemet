// فقاعات الرسايل والارتباط (الأسعار الحقيقية على السيرفر: server/pb_hooks/perkslib.js)
// زي الـ VIP: التطبيق كله بيقرا قايمة واحدة بس (الفقاعات الشغالة والمرتبطين)
import { useEffect, useState, useSyncExternalStore } from 'react'
import { pb, live, toDate } from './pb/client.js'

export const BUBBLES = [
  { id: 'papyrus', name: 'بردي', price: 600 },
  { id: 'turq', name: 'فيروز', price: 900 },
  { id: 'lapis', name: 'ليل النيل', price: 1200 },
  { id: 'gold', name: 'دهب', price: 1800, shine: true },
  { id: 'fire', name: 'نار رع', price: 2500 },
  { id: 'royal', name: 'ملكي', price: 4000, shine: true },
]
export const RINGS = [
  { ring: 1, name: 'خاتم فضة', icon: '💍', price: 1500, perk: 'خاتم 💍 جنب اسمك واسمه' },
  { ring: 2, name: 'خاتم دهب', icon: '💛', price: 4000, perk: 'خاتم 💛 + إعلان «مبروك» لكل الشات' },
  { ring: 3, name: 'خاتم ألماظ', icon: '💎', price: 9000, perk: 'خاتم 💎 + إعلان + احتفال بالقلوب لكل الشات' },
]
export const ringInfo = (r) => RINGS[r - 1] || null

const IS_PB = import.meta.env.VITE_BACKEND === 'pb'
const EMPTY = {}
let state = EMPTY
let started = false
const subs = new Set()
const emit = (s) => { state = s; subs.forEach((f) => f()) }

function start() {
  if (started || !IS_PB) return
  started = true
  let soon = null
  const load = async () => {
    try {
      const list = await pb.collection('perks').getFullList({ filter: `bubbleUntil > ${Date.now()} || partner != ''`, fields: 'id,bubble,bubbleUntil,partner,partnerName,ring,since', batch: 500 })
      emit(Object.fromEntries(list.map((x) => [x.id, x])))
    } catch { started = false }
  }
  load()
  live('perks', '*', () => { clearTimeout(soon); soon = setTimeout(load, 800) })
}
function subscribe(f) {
  start()
  subs.add(f)
  return () => subs.delete(f)
}
export function usePerks() {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}
// شكل فقاعة العضو دلوقتي (أو null)
export const bubbleOf = (all, uid) => { const p = uid && all[uid]; return p && p.bubble && p.bubbleUntil > Date.now() ? p.bubble : null }
// الارتباط: { partner, partnerName, ring, since } أو null
export const coupleOf = (all, uid) => { const p = uid && all[uid]; return p && p.partner ? p : null }
export function useCouple(uid) { return coupleOf(usePerks(), uid) }
// لون الاسم ليوم واحد (٢٠٠ كوين)
export const NAME_COLORS = [
  { id: 'red', name: 'أحمر', c: '#D93025' }, { id: 'blue', name: 'أزرق', c: '#1E6FD9' }, { id: 'green', name: 'أخضر', c: '#1E8E3E' },
  { id: 'purple', name: 'بنفسجي', c: '#8E24AA' }, { id: 'orange', name: 'برتقالي', c: '#E8710A' }, { id: 'pink', name: 'وردي', c: '#D81B60' },
]
export const COLOR_PRICE = 200
export const colorOf = (all, uid) => { const p = uid && all[uid]; return p && p.color && p.colorUntil > Date.now() ? NAME_COLORS.find((x) => x.id === p.color)?.c || null : null }
export function useNameColor(uid) { return colorOf(usePerks(), uid) }
export const buyColor = (color) => pb.send('/api/kemet/color/buy', { method: 'POST', body: { color } })
export const myUid = () => pb.authStore.record?.id || null

export const buyBubble = (style) => pb.send('/api/kemet/bubble/buy', { method: 'POST', body: { style } })
export const propose = (to, ring) => pb.send('/api/kemet/ring/propose', { method: 'POST', body: { to, ring } })
export const answerProposal = (id, ok) => pb.send('/api/kemet/ring/answer', { method: 'POST', body: { id, ok } })
export const cancelProposal = (id) => pb.send('/api/kemet/ring/cancel', { method: 'POST', body: { id } })
export const breakUp = () => pb.send('/api/kemet/ring/break', { method: 'POST', body: {} })

// طلبات الارتباط المستنية اللي ليا أو مني (بتتحدّث لوحدها)
export function useProposals(uid) {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!uid || !IS_PB) return
    let dead = false
    const load = () => pb.collection('proposals').getList(1, 20, { filter: `status = 'pending' && (asker = '${uid}' || target = '${uid}')`, sort: '-created', skipTotal: true })
      .then((r) => { if (!dead) setList(r.items) }).catch(() => {})
    load()
    const off = live('proposals', '*', () => load())
    return () => { dead = true; off() }
  }, [uid])
  return list
}

// إعلانات «مبروك» الجديدة (اللي اتعملت وانت فاتح التطبيق)
export function useCoupleEvents(cb) {
  useEffect(() => {
    if (!IS_PB) return
    return live('events', '*', (ev) => {
      if (ev.action !== 'create') return
      const at = toDate(ev.record.created)
      if (at && Date.now() - at.getTime() > 60000) return
      cb(ev.record)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
