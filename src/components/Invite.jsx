// لينك الدعوة: كل عضو مسجّل ليه لينك، ولما صاحبه يسجّل بيه الاتنين بياخدوا ٢٠٠ كوين (السيرفر بيتأكد)
import { useEffect, useState } from 'react'
import { useAuth, isGuest } from '../auth.jsx'
import { pb } from '../pb/client.js'
import { ar } from '../utils.js'

const KEY = 'kemet-ref'
export const INVITE_COINS = 200

// أول ما حد يفتح لينك دعوة (?ref=...) بنفتكره لحد ما يسجّل
export function rememberInvite() {
  try {
    const u = new URL(window.location.href)
    const ref = u.searchParams.get('ref')
    if (!ref) return
    if (/^[A-Za-z0-9_-]{6,64}$/.test(ref)) localStorage.setItem(KEY, ref)
    u.searchParams.delete('ref')
    window.history.replaceState(null, '', u.pathname + u.search + u.hash)
  } catch {}
}

// أول ما يبقى عضو مسجّل: نطلب هدية الدعوة (مرة واحدة)
export function InviteKeeper() {
  const { user, profile } = useAuth()
  const guest = isGuest(user, profile)
  useEffect(() => {
    if (!user || !profile || guest) return
    let ref = null
    try { ref = localStorage.getItem(KEY) } catch {}
    if (!ref) return
    const drop = () => { try { localStorage.removeItem(KEY) } catch {} }
    if (ref === user.uid) return drop()
    // 400 = مش هينفع خالص (حساب قديم، خد الهدية قبل كده...)؛ غير كده نجرب تاني بعدين
    pb.send('/api/kemet/invite', { method: 'POST', body: { ref } }).then(drop).catch((e) => { if (e?.status === 400) drop() })
  }, [user?.uid, profile?.id, guest]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// كارت «ادعي صحابك» (للمسجّلين بس)
export function InviteCard({ showToast }) {
  const { user, profile } = useAuth()
  const guest = isGuest(user, profile)
  const [count, setCount] = useState(null)
  useEffect(() => {
    if (!user || guest) return
    pb.send('/api/kemet/invite', { method: 'GET' }).then((r) => setCount(r.count)).catch(() => {})
  }, [user?.uid, guest]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!user || guest) return null
  const link = `${window.location.origin}${import.meta.env.BASE_URL}?ref=${user.uid}`
  const text = `تعالى دردش معايا على شات كيمت 👑 شات مصري ببلاش — سجّل من اللينك ده وخد ${ar(INVITE_COINS)} كوين هدية:\n${link}`
  const copy = () => navigator.clipboard?.writeText(link).then(() => showToast?.('✓ اتنسخ اللينك')).catch(() => showToast?.(link))
  const share = () => {
    if (navigator.share) navigator.share({ title: 'شات كيمت', text }).catch(() => {})
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }
  return (
    <div className="invite-card">
      <b>🤝 ادعي صحابك وخد {ar(INVITE_COINS)} كوين</b>
      <small>ابعت اللينك بتاعك لصحابك، ولما حد يسجّل بيه ويكتب ١٠ رسايل، انت وهو تاخدوا {ar(INVITE_COINS)} كوين.{count ? ` دعيت ${ar(count)} لحد دلوقتي 🎉` : ''}</small>
      <div className="invite-link" dir="ltr">{link}</div>
      <div className="invite-btns">
        <button type="button" className="btn-primary" onClick={share}>ابعت لصحابك</button>
        <button type="button" className="btn-outline" onClick={copy}>انسخ اللينك</button>
      </div>
    </div>
  )
}
