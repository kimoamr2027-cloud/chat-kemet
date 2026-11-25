// كارت العضوية الفرعوني: صورة على شكل بردية فيها اسمك بالهيروغليفي وقبيلتك وتاريخ دخولك، وتشاركها بلينك دعوتك
import { useEffect, useState } from 'react'
import { Sheet } from './ui.jsx'
import { useAuth, isGuest } from '../auth.jsx'
import { useTribeOf } from '../tribes.js'
import { useVip, vipInfo } from '../vip.js'
import { toHiero, loadHieroFont, HIERO_FONT } from '../hiero.js'

const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src })
const digits = (t) => String(t ?? '').replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])

export async function makeCard({ name, avatar, tribe, vip, joined, uid }) {
  const W = 1080, H = 1350
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const x = c.getContext('2d')
  await loadHieroFont()
  try { await Promise.all(['900 80px Cairo', '700 40px Cairo'].map((f) => document.fonts?.load(f))) } catch {}
  // البردية
  const bg = x.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#F3E2B8'); bg.addColorStop(0.5, '#E9D19A'); bg.addColorStop(1, '#D9B977')
  x.fillStyle = '#2A1A0A'; x.fillRect(0, 0, W, H)
  x.fillStyle = bg; x.beginPath(); x.roundRect(40, 40, W - 80, H - 80, 36); x.fill()
  for (let i = 0; i < 120; i++) { x.strokeStyle = `rgba(140,100,40,${0.05 + Math.random() * 0.07})`; x.lineWidth = 1 + Math.random() * 2; const y = 60 + Math.random() * (H - 120); x.beginPath(); x.moveTo(60, y); x.lineTo(W - 60, y + (Math.random() - 0.5) * 10); x.stroke() }
  x.strokeStyle = '#8A5A1C'; x.lineWidth = 6; x.beginPath(); x.roundRect(70, 70, W - 140, H - 140, 24); x.stroke()
  x.lineWidth = 2; x.beginPath(); x.roundRect(86, 86, W - 172, H - 172, 18); x.stroke()
  x.direction = 'rtl'; x.textAlign = 'center'
  x.fillStyle = '#5A3A10'; x.font = '900 54px Cairo, sans-serif'; x.fillText('كارت عضوية مملكة كيمت', W / 2, 180)
  const tw = x.measureText('كارت عضوية مملكة كيمت').width
  x.font = `56px ${HIERO_FONT}`; x.fillText('𓂀', W / 2 - tw / 2 - 50, 182); x.fillText('𓂀', W / 2 + tw / 2 + 50, 182)
  // الصورة
  const cx = W / 2, cy = 400, r = 150
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.closePath(); x.clip()
  try { if (avatar) { const img = await loadImg(avatar); x.drawImage(img, cx - r, cy - r, r * 2, r * 2) } else throw 0 } catch {
    x.fillStyle = '#8A5A1C'; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.fillStyle = '#FFE9B8'; x.font = '900 150px Cairo, sans-serif'; x.fillText((name || '؟').charAt(0), cx, cy + 55)
  }
  x.restore()
  x.strokeStyle = '#C98A1B'; x.lineWidth = 10; x.beginPath(); x.arc(cx, cy, r + 6, 0, 7); x.stroke()
  // الاسم
  x.fillStyle = '#2A1A04'; x.font = '900 80px Cairo, sans-serif'; x.fillText(name || '', W / 2, 650)
  // الخرطوش (الاسم بالهيروغليفي)
  const hiero = toHiero(name)
  x.font = `64px ${HIERO_FONT}`
  const hw = Math.min(W - 220, Math.max(300, x.measureText(hiero).width + 100))
  x.strokeStyle = '#8A5A1C'; x.lineWidth = 6; x.beginPath(); x.roundRect(W / 2 - hw / 2, 690, hw, 110, 55); x.stroke()
  x.beginPath(); x.moveTo(W / 2 + hw / 2 + 12, 700); x.lineTo(W / 2 + hw / 2 + 12, 790); x.stroke()
  x.fillStyle = '#4A2C08'; x.direction = 'ltr'; x.fillText(hiero, W / 2, 772); x.direction = 'rtl'
  // البيانات
  const rows = [
    tribe ? [`${tribe.icon} قبيلة`, tribe.name] : null,
    vip ? [`${vipInfo(vip).icon} VIP`, vipInfo(vip).name] : null,
    joined ? ['📅 عضو من', digits(joined.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' }))] : null,
  ].filter(Boolean)
  let y = 900
  for (const [k, v] of rows) {
    x.font = '700 42px Cairo, sans-serif'; x.fillStyle = '#7A5420'; x.textAlign = 'right'; x.fillText(k, W - 180, y)
    x.font = '900 46px Cairo, sans-serif'; x.fillStyle = '#2A1A04'; x.textAlign = 'left'; x.fillText(v, 180, y)
    x.strokeStyle = 'rgba(138,90,28,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(170, y + 24); x.lineTo(W - 170, y + 24); x.stroke()
    y += 90
  }
  x.textAlign = 'center'
  x.fillStyle = '#8A5A1C'; x.font = '900 52px Cairo, sans-serif'; x.fillText('شات كيمت 👑', W / 2, H - 170)
  x.fillStyle = '#5A3A10'; x.font = '700 34px Cairo, sans-serif'; x.fillText('ادخل معايا ببلاش — chatkemet.pages.dev', W / 2, H - 115)
  return new Promise((ok) => c.toBlob(ok, 'image/png'))
}

export function MemberCardButton({ className = '' }) {
  const { user, profile } = useAuth()
  const tribe = useTribeOf(user?.uid)
  const vip = useVip(user?.uid)
  const [open, setOpen] = useState(false)
  const [img, setImg] = useState(null)
  const [blob, setBlob] = useState(null)
  useEffect(() => {
    if (!open || !profile) return
    let url = null
    const joined = profile.created ? new Date(String(profile.created).replace(' ', 'T')) : null
    makeCard({ name: profile.name, avatar: profile.avatar, tribe, vip, joined, uid: user.uid }).then((b) => { setBlob(b); url = URL.createObjectURL(b); setImg(url) })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!user || !profile) return null
  const link = `${window.location.origin}${import.meta.env.BASE_URL}${isGuest(user, profile) ? '' : `?ref=${user.uid}`}`
  const text = `ده كارت عضويتي في مملكة كيمت 👑 شات مصري ببلاش — ادخل معايا:\n${link}`
  const share = async () => {
    const file = blob && new File([blob], 'kemet-card.png', { type: 'image/png' })
    if (file && navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], text }).catch(() => {})
    if (blob) { const a = document.createElement('a'); a.href = img; a.download = 'kemet-card.png'; a.click() }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }
  return (
    <>
      <button type="button" className={`card visitors-link ${className}`} onClick={() => { setImg(null); setOpen(true) }}>🪪 كارت عضويتي الفرعوني<span className="tribe-go" aria-hidden="true">‹</span></button>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">🪪 كارت عضويتك</h2>
          {img ? <img src={img} alt="كارت العضوية" className="member-card-img" /> : <p className="empty">بيرسم الكارت...</p>}
          <button type="button" className="btn-primary" disabled={!blob} onClick={share}>📤 شارك كارتي</button>
          <p className="sheet-sub">الكارت فيه لينك دعوتك — كل صاحب يسجّل بيه ويتكلم = ٢٠٠ كوين ليك وليه.</p>
        </Sheet>
      )}
    </>
  )
}
