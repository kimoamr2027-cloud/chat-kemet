// 🔴 اللايف بالفيديو (سيرفر PocketBase + LiveKit)
import { useEffect, useState } from 'react'
import { pb, live } from './pb/client.js'

const IS_PB = import.meta.env.VITE_BACKEND === 'pb'
// اللايفات الشغالة دلوقتي
export function useLives() {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!IS_PB) { setList([]); return }
    let map = new Map()
    const emit = () => setList([...map.values()].filter((x) => x.status === 'live').sort((a, b) => b.viewers - a.viewers))
    pb.collection('lives').getList(1, 20, { filter: "status='live'", sort: '-created', skipTotal: true })
      .then((r) => { map = new Map(r.items.map((x) => [x.id, x])); emit() }).catch(() => setList([]))
    return live('lives', '*', (ev) => { map.set(ev.record.id, ev.record); emit() })
  }, [])
  return list
}
export function useLive(id) {
  const [rec, setRec] = useState(undefined)
  useEffect(() => {
    if (!IS_PB || !id) return
    pb.collection('lives').getOne(id).then(setRec).catch(() => setRec(null))
    return live('lives', id, (ev) => setRec(ev.record))
  }, [id])
  return rec
}
export const LIVE_CATS = { chat: '💬 دردشة', music: '🎤 غُنا ومزيكا', games: '🎮 ألعاب', talent: '✨ مواهب', other: '🌟 تاني' }
export const startLive = (title, cat, pledge) => pb.send('/api/kemet/live/start', { method: 'POST', body: { title, cat, pledge: !!pledge } })
export const joinLive = (id) => pb.send('/api/kemet/live/join', { method: 'POST', body: { id } })
export const endLive = (id) => pb.send('/api/kemet/live/end', { method: 'POST', body: { id } })
export const setLiveBan = (uid, on) => pb.send('/api/kemet/live/ban', { method: 'POST', body: { uid, on } })
export const liveBanned = () => pb.send('/api/kemet/live/banned', { method: 'GET' })
export const reportLive = (id) => pb.send('/api/kemet/live/report', { method: 'POST', body: { id } })
export const LIVE_RULES = ['🚫 ممنوع العُري أو أي حاجة خادشة', '🚫 ممنوع الشتيمة والتحرش والتنمّر', '🚫 ممنوع أرقام التليفونات واللينكات وطلب فلوس برّه الشات', '🚫 ممنوع اللايف لحد تحت ١٨ سنة', '🚩 لو ٣ أعضاء بلّغوا عن اللايف بيتقفل لوحده وتتمنع من اللايف يوم، والأدمن ممكن يمنعك على طول']
