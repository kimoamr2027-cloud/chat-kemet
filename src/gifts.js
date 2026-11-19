// هدايا الغرفة الصوتية (الأسعار الحقيقية على السيرفر)
import { useEffect, useRef, useState } from 'react'
import { pb, live } from './pb/client.js'

// الأدمن وافق على الهدايا
export const GIFTS_ON = true

// الهدايا اللي اختارها الأدمن، من الأرخص للأغلى. img: صورة صغيرة، video: الفيديو (بالطول لو tall)، ms: مدة العرض
const BASE = import.meta.env.BASE_URL
const V = (id, name, price) => ({ id, name, price, big: true, fx: 'video', tall: true, ms: 6200, img: `${BASE}gifts/${id}.jpg`, video: `${BASE}gifts/${id}.mp4` })
export const GIFTS = [
  { id: 'heart', img: `${BASE}gifts/rose.webp`, e: '💝', name: 'قلب الورد', price: 50, big: true, fx: 'heart', ms: 5400 },
  V('ankh', 'مفتاح الحياة', 80),
  V('scarab', 'جعران الشمس', 100),
  V('scale', 'ميزان ماعت', 150),
  V('falcon', 'صقر حورس', 200),
  V('cobra', 'كوبرا التاج', 300),
  V('chest', 'كنز الفرعون', 400),
  V('isis', 'إيزيس', 500),
  V('anubis', 'أنوبيس', 700),
  V('mask', 'قناع الفرعون', 900),
  V('queen', 'عرش الملكة', 1200),
  { id: 'chariot', img: `${BASE}gifts/chariot.webp`, e: '🏇', name: 'عربة الفرعون', price: 2000, big: true, fx: 'video', ms: 6200,
    video: `${BASE}gifts/chariot.mp4` },
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
// هدايا الفيديو وقتها بيبدأ لما الفيديو يشتغل فعلًا (started)، عشان النت البطيء مايقطعهاش
export function useGiftQueue() {
  const [cur, setCur] = useState(null)
  const q = useRef([])
  const timer = useRef(null)
  const endAt = useRef(0)
  const curRef = useRef(null)
  const arm = (ms) => { clearTimeout(timer.current); endAt.current = Date.now() + ms; timer.current = setTimeout(next, ms) }
  const show = (g) => {
    curRef.current = g
    setCur(g)
    if (!g) return
    // فيديو لسه بيحمّل: نستنى لحد 8 ثواني بالكتير
    arm(giftOf(g.gift)?.video ? 8000 : giftMs(g.gift))
  }
  function next() { show(q.current.shift() || null) }
  const started = (id) => { if (curRef.current?.id === id) arm(giftMs(curRef.current.gift)) }
  useEffect(() => () => clearTimeout(timer.current), [])
  const push = (r) => {
    const key = `${r.from}|${r.gift}|${r.to}`
    const c = curRef.current
    // نفس الهدية شغالة دلوقتي: نزوّد العدّاد، ولو قربت تخلص نطوّلها شوية
    if (c && c.key === key) {
      const g = { ...c, combo: c.combo + 1, bump: Date.now() }
      curRef.current = g
      setCur(g)
      if (endAt.current - Date.now() < 2200) arm(2200)
      return
    }
    const item = { ...r, key, combo: 1, bump: Date.now() }
    if (!c) return show(item)
    const last = q.current[q.current.length - 1]
    if (last && last.key === key) last.combo += 1
    else q.current.push(item)
  }
  return { cur, push, started }
}
