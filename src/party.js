// 🎙 الحفلات + 🎉 الغرف الحية + 🏆 لوحة الشرف + البانرات + 📺 الأعلى في اللايفات
import { useCallback, useEffect, useState } from 'react'
import { pb, live } from './pb/client.js'

// مين موجود في كل غرفة كتابة دلوقتي (بيتحدّث كل ٣٠ ثانية)
export function useRoomsLive() {
  const [m, setM] = useState({})
  useEffect(() => {
    let alive = true
    const load = () => pb.send('/api/kemet/rooms/live', { requestKey: null }).then((r) => alive && setM(r || {})).catch(() => {})
    load()
    const iv = setInterval(() => { if (!document.hidden) load() }, 30000)
    return () => { alive = false; clearInterval(iv) }
  }, [])
  return m
}

const toParty = (r) => ({
  id: r.id, name: r.name, owner: r.owner || '', ownerName: r.ownerName || '', here: r.here || 0, topic: r.topic || '',
  seated: [...(r.seats?.center || []), ...(r.seats?.ring || [])].filter(Boolean),
  muted: r.muted || {},
})

// الحفلات المفتوحة (لحظيًا)
export function useParties() {
  const [list, setList] = useState(null)
  useEffect(() => {
    let alive = true
    pb.collection('voice').getFullList({ filter: "owner != ''", requestKey: null }).then((r) => alive && setList(r.map(toParty))).catch(() => alive && setList([]))
    const off = live('voice', '*', (ev) => {
      if (!ev.record?.owner) return
      setList((l) => {
        const rest = (l || []).filter((x) => x.id !== ev.record.id)
        return ev.action === 'delete' ? rest : [...rest, toParty(ev.record)]
      })
    })
    return () => { alive = false; off?.() }
  }, [])
  return list
}

export const openParty = (name) => pb.send('/api/kemet/party/open', { method: 'POST', body: { name } })
export const closeParty = (id) => pb.send('/api/kemet/party/close', { method: 'POST', body: { id } })

export function useHonor(p) {
  const [d, setD] = useState(null)
  useEffect(() => {
    setD(null)
    pb.send(`/api/kemet/honor?p=${p}`, { requestKey: null }).then(setD).catch(() => setD({ givers: [], takers: [], rooms: [], voice: [] }))
  }, [p])
  return d
}

export const BANNER_COLORS = { gold: '🟡 دهبي', purple: '🟣 بنفسجي', blue: '🔵 أزرق', green: '🟢 أخضر', red: '🔴 أحمر', night: '⚫ ليلي' }
export function useBanners(all) {
  const [list, setList] = useState(null)
  const load = useCallback(() => pb.send(`/api/kemet/banners${all ? '?all=1' : ''}`, { requestKey: null }).then(setList).catch(() => setList([])), [all])
  useEffect(() => { load() }, [load])
  return { list, setList, reload: load }
}
export const saveBanners = (list) => pb.send('/api/kemet/banners', { method: 'POST', body: { list } })

export function useLiveTop() {
  const [m, setM] = useState({})
  useEffect(() => { pb.send('/api/kemet/live/top', { requestKey: null }).then(setM).catch(() => {}) }, [])
  return m
}
