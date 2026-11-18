// هدايا الغرفة الصوتية (الأسعار الحقيقية على السيرفر)
import { useEffect, useRef, useState } from 'react'
import { pb, live } from './pb/client.js'

// big: بتاخد الشاشة كلها
export const GIFTS = [
  { id: 'rose', e: '🌹', name: 'وردة النيل', price: 10 },
  { id: 'heart', e: '💝', name: 'قلب الورد', price: 50 },
  { id: 'lotus', e: '🪷', name: 'زهرة اللوتس', price: 100 },
  { id: 'falcon', e: '🦅', name: 'صقر حورس', price: 250 },
  { id: 'gem', e: '💎', name: 'جوهرة كليوباترا', price: 500, big: true },
  { id: 'camel', e: '🐫', name: 'قافلة الصحرا', price: 1000, big: true },
  { id: 'horse', e: '🐎', name: 'خيل الفرعون', price: 2500, big: true },
  { id: 'crown', e: '👑', name: 'تاج الفرعون', price: 5000, big: true },
]
export const giftOf = (id) => GIFTS.find((g) => g.id === id)

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
    if (g) timer.current = setTimeout(next, giftOf(g.gift)?.big ? 4600 : 3000)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
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
      if (!c) { timer.current = setTimeout(next, giftOf(r.gift)?.big ? 4600 : 3000); return item }
      const last = q.current[q.current.length - 1]
      if (last && last.key === key) last.combo += 1
      else q.current.push(item)
      return c
    })
  }
  return { cur, push }
}
