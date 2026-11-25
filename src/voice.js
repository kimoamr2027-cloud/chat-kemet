// الغرفة الصوتية (الملوك القدماء): الكراسي من سيرفر PocketBase، والصوت نفسه من LiveKit
import { useEffect, useState } from 'react'
import { pb, live } from './pb/client.js'

export const VOICE_ROOM = 'kings'
export const REACTS = ['👏', '🔥', '😂', '❤️', '👑']
// ترمي ورد أو طماطم على حد في الغرفة الصوتية (ببلاش، ٣٠ في اليوم)
export const THROWS = { '🌹': 'ورد', '🍅': 'طماطم' }
export const THROWS_DAY = 30

const toVoice = (r) => ({
  id: r.id, name: r.name, topic: r.topic || '', here: r.here || 0, owner: r.owner || '', ownerName: r.ownerName || '',
  seats: r.seats || { center: [null, null, null], ring: [], locked: [] },
  muted: r.muted || {}, hands: r.hands || {},
})

export function useVoiceRoom(id) {
  const [v, setV] = useState(undefined)
  useEffect(() => {
    if (!id) return
    pb.collection('voice').getOne(id).then((r) => setV(toVoice(r))).catch(() => setV(null))
    return live('voice', id, (ev) => setV(ev.action === 'delete' ? null : toVoice(ev.record)))
  }, [id])
  return v
}

export const joinVoice = (room) => pb.send('/api/kemet/voice/join', { method: 'POST', body: { room } })
export const voiceAct = (room, action, body = {}) => pb.send('/api/kemet/voice/act', { method: 'POST', body: { room, action, ...body } })

// الكرسي اللي العضو قاعد عليه
export function seatOf(v, uid) {
  if (!v) return null
  for (const side of ['center', 'ring']) {
    const i = (v.seats[side] || []).findIndex((s) => s && s.uid === uid)
    if (i >= 0) return { side, i }
  }
  return null
}
export const seatedCount = (v) => (v ? [...(v.seats.center || []), ...(v.seats.ring || [])].filter(Boolean).length : 0)
