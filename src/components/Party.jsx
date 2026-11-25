// 🎉 البانرات المتحركة + صور الموجودين + كارت الحفلة
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Sheet } from './ui.jsx'
import { useAvatar } from '../dm.js'
import { colorIndex } from '../rooms.js'
import { ar } from '../utils.js'
import { useBanners, openParty } from '../party.js'
import { useAuth } from '../auth.jsx'

function Face({ uid, name, size }) {
  const src = useAvatar(uid)
  return <Avatar text={(name || '؟').charAt(0)} c={colorIndex(uid)} size={size} round src={src || undefined} />
}

// صور فوق بعض + العدد
export function Faces({ list, n, size = 26 }) {
  if (!n) return null
  const more = n - list.length
  return (
    <span className="faces">
      {list.slice(0, 4).map((f) => <span key={f.uid} className="faces-i"><Face uid={f.uid} name={f.name} size={size} /></span>)}
      {more > 0 && <span className="faces-more" style={{ width: size, height: size }}>+{ar(more)}</span>}
    </span>
  )
}

// البانرات: بتاعة الأدمن + الثابتة (لوحة الشرف وتحدي الميدان)
const FIXED = [
  { id: 'honor', title: '🏆 لوحة الشرف', sub: 'مين الأغنى ومين النجم النهارده؟ شوف ترتيبك', e: '👑', color: 'gold', link: '/honor' },
  { id: 'square', title: '🏛 تحدي الأسبوع في الميدان', sub: 'نزّل صورتك واكسب لحد ٥٠٠ كوين', e: '📷', color: 'purple', link: '/square' },
]
export function BannerCarousel() {
  const { list } = useBanners(false)
  const navigate = useNavigate()
  const items = [...(list || []), ...FIXED]
  const [i, setI] = useState(0)
  const ref = useRef(null)
  const touch = useRef(0)
  useEffect(() => {
    if (items.length < 2) return
    ref.current = setInterval(() => setI((x) => (x + 1) % items.length), 5000)
    return () => clearInterval(ref.current)
  }, [items.length])
  const go = (d) => { clearInterval(ref.current); setI((x) => (x + d + items.length) % items.length) }
  const b = items[i % items.length]
  if (!b) return null
  return (
    <div className="bnr-wrap" onTouchStart={(e) => { touch.current = e.touches[0].clientX }} onTouchEnd={(e) => { const d = e.changedTouches[0].clientX - touch.current; if (Math.abs(d) > 40) go(d > 0 ? 1 : -1) }}>
      <button type="button" key={b.id} className={`bnr bnr-${b.color || 'gold'}`} onClick={() => b.link && navigate(b.link)}>
        <span className="bnr-e">{b.e || '🎉'}</span>
        <span className="bnr-t"><b>{b.title}</b>{b.sub && <small>{b.sub}</small>}</span>
        {b.link && <span className="bnr-go">›</span>}
      </button>
      {items.length > 1 && <span className="bnr-dots">{items.map((x, k) => <i key={x.id} className={k === i % items.length ? 'on' : ''} />)}</span>}
    </div>
  )
}

export function PartyCard({ p }) {
  const src = useAvatar(p.owner)
  const live = p.seated.length > 0 || p.here > 0
  const n = Math.max(p.here, p.seated.length)
  // اللي قاعدين على الكراسي ومش مكتومين (المايك مفتوحلهم)
  const mic = p.seated.filter((s) => !p.muted?.[s.uid]).map((s) => s.name)
  return (
    <Link to={`/voice/${p.id}`} className="card party">
      <span className="party-cover">
        {src ? <img src={src} alt="" /> : <span className="party-ph">{(p.ownerName || '؟').charAt(0)}</span>}
        {live && <i className="party-live"><b /><b /><b /></i>}
      </span>
      <span className="party-b">
        <b className="party-name">{p.name}</b>
        <span className="party-tag">🎙 حفلة {p.ownerName}</span>
        {mic.length > 0 && <span className="party-mic">🎤 على المايك: <b>{mic.slice(0, 3).join('، ')}</b>{mic.length > 3 ? ` و${ar(mic.length - 3)} كمان` : ''}</span>}
        <span className="party-row">
          <Faces list={p.seated} n={p.seated.length} size={28} />
          {!p.seated.length && <small className="party-empty">فاضية — ادخل وافتح الكلام</small>}
          {n > 0 && <span className="party-n">👥 {ar(n)}</span>}
        </span>
      </span>
    </Link>
  )
}

export function OpenPartySheet({ onClose, showToast }) {
  const { profile } = useAuth()
  const first = (profile?.name || '').split(' ')[0]
  const ideas = [first && `سهرة ${first} 🎶`, 'قعدة الصحاب ☕', 'حكايات بالليل 🌙', 'أغاني وطرب 🎤', 'دردشة وضحك 😂', 'نتعرف على بعض 🤝'].filter(Boolean)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const go = () => {
    const n = name.trim()
    if (n.length < 2) return showToast('اكتب اسم الحفلة')
    setBusy(true)
    openParty(n).then((r) => navigate(`/voice/${r.id}`)).catch((e) => showToast(e?.response?.message || 'مقدرناش نفتح الحفلة')).finally(() => setBusy(false))
  }
  return (
    <Sheet onClose={onClose}>
      <span className="grabber" aria-hidden="true" />
      <h2 className="sheet-title">🎙 افتح حفلتك</h2>
      <p className="sheet-sub">غرفة صوتية باسمك، وانت صاحبها: بتقعد على العرش، وبتقعّد الناس على الكراسي وتكتم وتنزّل اللي يضايق، والهدايا اللي تجيلك فيها ليك. لو فضيت ٣ أيام بتتقفل لوحدها.</p>
      <form className="new-room" onSubmit={(e) => { e.preventDefault(); go() }}>
        <input className="input" placeholder="اسم الحفلة" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="party-ideas">{ideas.map((x) => <button key={x} type="button" className={`pill-btn ${name === x ? 'pill-gold' : ''}`} onClick={() => setName(x.slice(0, 30))}>{x}</button>)}</div>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'لحظة...' : '🎉 افتح الحفلة'}</button>
      </form>
    </Sheet>
  )
}
