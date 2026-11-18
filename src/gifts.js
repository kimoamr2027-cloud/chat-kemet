// هدايا الغرفة الصوتية (الأسعار الحقيقية على السيرفر)
import { useEffect, useRef, useState } from 'react'
import { pb, live } from './pb/client.js'

// الهدايا مقفولة لحد ما الأدمن يوافق على التصميم
export const GIFTS_ON = false

// الهدايا اللي اختارها الأدمن بس. img: صورة حقيقية، fx: شكل العرض، ms: مدة العرض
const BASE = import.meta.env.BASE_URL
export const GIFTS = [
  { id: 'heart', img: `${BASE}gifts/rose.webp`, e: '💝', name: 'قلب الورد', price: 1000, big: true, fx: 'heart', ms: 5400 },
  { id: 'chariot', img: `${BASE}gifts/chariot.webp`, e: '🏇', name: 'عربة الفرعون', price: 3000, big: true, fx: 'chariot', ms: 10400,
    video: [`${BASE}gifts/chariot.mp4`, `${BASE}gifts/chariot.webm`] },
]
export const giftOf = (id) => GIFTS.find((g) => g.id === id)
const giftMs = (id) => { const g = giftOf(id); return g?.ms || (g?.big ? 4600 : 3000) }

export const sendGift = (room, to, gift) => pb.send('/api/kemet/voice/gift', { method: 'POST', body: { room, to, gift } })

// الهدايا اللي بتتبعت دلوقتي في الغرفة (من بعد ما دخلت)
export function useGiftFeed(room, onGift) {
  const cb = useRef(onGift)
  cb.current = onGift
  useEffect(() => {
    if (!room) return
    return live('gifts', '*', (ev) => { if (ev.action === 'create') cb.current?.(ev.record) }, { filter: `room='${room.replace(/'/g, '')}'` })
  }, [room])
}

// طابور العرض: هدية ورا التانية، ونفس الهدية من نفس الشخص ورا بعض = عدّاد x2 x3
export function useGiftQueue() {
  const [cur, setCur] = useState(null)
  const q = useRef([])
  const timer = useRef(null)
  const next = () => {
    const g = q.current.shift()
    setCur(g || null)
    if (g) timer.current = setTimeout(next, giftMs(g.gift))
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  // نحمّل فيديوهات الهدايا من بدري عشان تشتغل على طول
  useEffect(() => {
    if (!GIFTS_ON) return
    const probe = document.createElement('video')
    for (const g of GIFTS) {
      const src = g.video?.find((u) => probe.canPlayType(u.endsWith('.webm') ? 'video/webm' : 'video/mp4'))
      if (src) fetch(src).catch(() => {})
    }
  }, [])
  const push = (r) => {
    const key = `${r.from}|${r.gift}|${r.to}`
    setCur((c) => {
      // نفس الهدية شغالة دلوقتي: نزوّد العدّاد ونطوّل وقتها شوية
      if (c && c.key === key) {
        clearTimeout(timer.current)
        timer.current = setTimeout(next, 2200)
        return { ...c, combo: c.combo + 1, bump: Date.now() }
      }
      const item = { ...r, key, combo: 1, bump: Date.now() }
      if (!c) { timer.current = setTimeout(next, giftMs(r.gift)); return item }
      const last = q.current[q.current.length - 1]
      if (last && last.key === key) last.combo += 1
      else q.current.push(item)
      return c
    })
  }
  return { cur, push }
}
