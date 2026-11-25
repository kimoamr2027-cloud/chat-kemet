// 🎯 أمنية الغرفة (هدف هدايا يومي، والموجودين بياخدوا كوينز لما يكمل)
// 📣 شريط الهدايا الكبيرة: أي هدية غالية في أي مكان بتظهر فوق للكل
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { pb, live } from '../pb/client.js'
import { useAuth } from '../auth.jsx'
import { giftOf } from '../gifts.js'
import { ar } from '../utils.js'

export const BIG_GIFT = 500 // من إيزيس وطالع

// حالة الأمنية + الهدايا اللي جات لكل واحد في الغرفة النهارده. tick() بعد أي هدية
export function useWish(room) {
  const [w, setW] = useState(null)
  const t = useRef(null)
  const load = useRef(() => {})
  load.current = () => pb.send(`/api/kemet/wish?room=${encodeURIComponent(room)}`, {}).then(setW).catch(() => {})
  useEffect(() => {
    if (!room) return
    load.current()
    const iv = setInterval(() => load.current(), 60000)
    return () => { clearInterval(iv); clearTimeout(t.current) }
  }, [room])
  const tick = () => { clearTimeout(t.current); t.current = setTimeout(() => load.current(), 700) }
  return { w, tick }
}

// لما مستوى يكمل وانت موجود: احتفال صغير
export function useWishDone(w, showToast) {
  const prev = useRef(null)
  useEffect(() => {
    if (!w) return
    if (prev.current !== null && w.level > prev.current && w.doneCoins) showToast(`🎯 أمنية الغرفة اتحققت! 🎉 كل الموجودين خدوا ${ar(w.doneCoins)} كوين 🪙`)
    prev.current = w.level
  }, [w?.level]) // eslint-disable-line react-hooks/exhaustive-deps
}

export function WishBar({ w, onGift, dark }) {
  if (!w) return null
  const all = w.level >= w.max
  const pct = all ? 100 : Math.min(100, Math.round((w.n / w.goal) * 100))
  return (
    <button type="button" className={`wish-bar ${dark ? 'wish-dark' : ''} ${all ? 'wish-all' : ''}`} onClick={onGift} disabled={all || !onGift}>
      <span className="wish-ic" aria-hidden="true">🎯</span>
      <span className="wish-body">
        <span className="wish-t">
          {all ? <b>خلّصتوا أماني النهارده كلها 👑</b> : <><b>أمنية الغرفة</b> <small>المستوى {ar(w.level + 1)}/{ar(w.max)}</small></>}
          {!all && <span className="wish-n">🪙 {ar(w.n)}/{ar(w.goal)}</span>}
        </span>
        <span className="wish-track"><i style={{ width: `${pct}%` }} /></span>
        {!all && <span className="wish-sub">لما تكمل: كل الموجودين ياخدوا {ar(w.reward)} كوين 🎁</span>}
      </span>
    </button>
  )
}

// عدد الكوينز اللي جات لكل واحد قاعد على كرسي
export function SeatGot({ n }) {
  if (!n) return null
  return <span className="vs-got">🎁 {n >= 1000 ? `${ar(Math.floor(n / 100) / 10)}k` : ar(n)}</span>
}

function where(g) {
  if (g.kind === 'live') return `/live/${g.room}`
  if (g.kind === 'voice') return `/voice/${g.room}`
  if (g.kind === 'room') return `/rooms/${g.room}`
  return ''
}

export function BigGiftBanner() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const [cur, setCur] = useState(null)
  const q = useRef([])
  const timer = useRef(null)
  const path = useRef(loc.pathname)
  path.current = loc.pathname
  useEffect(() => {
    if (!user) return
    const next = () => { const g = q.current.shift() || null; setCur(g); timer.current = g ? setTimeout(next, 6500) : null }
    const off = live('gifts', '*', (ev) => {
      const g = ev.record
      if (ev.action !== 'create' || !g || (g.price || 0) < BIG_GIFT || !g.kind) return
      // لو انت في نفس المكان، الهدية بتظهر عندك أصلًا بالأنيميشن
      if (where(g) === path.current) return
      if (q.current.length > 4) return
      q.current.push(g)
      if (!timer.current) next()
    }, { filter: `price>=${BIG_GIFT}` })
    return () => { off?.(); clearTimeout(timer.current); timer.current = null }
  }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!cur) return null
  const g = giftOf(cur.gift)
  const to = where(cur)
  return (
    <button type="button" key={cur.id} className="biggift" onClick={() => { if (to) navigate(to) }}>
      <span className="biggift-ic">{g?.img ? <img src={g.img} alt="" /> : g?.e || '🎁'}</span>
      <span className="biggift-t"><b>{cur.fromName}</b> بعت {g?.name || 'هدية'} لـ <b>{cur.toName}</b></span>
      {to && <span className="biggift-go">{cur.kind === 'live' ? '🔴 شوف' : 'ادخل'} ›</span>}
    </button>
  )
}
