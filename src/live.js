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
export const startLive = (title) => pb.send('/api/kemet/live/start', { method: 'POST', body: { title } })
export const joinLive = (id) => pb.send('/api/kemet/live/join', { method: 'POST', body: { id } })
export const endLive = (id) => pb.send('/api/kemet/live/end', { method: 'POST', body: { id } })
export const setLiveHost = (uid, on) => pb.send('/api/kemet/live/host', { method: 'POST', body: { uid, on } })
export const liveHosts = () => pb.send('/api/kemet/live/hosts', { method: 'GET' })
