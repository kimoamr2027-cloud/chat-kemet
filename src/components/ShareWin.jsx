// «شارك الفوز»: بنرسم صورة «كسبت في شات كيمت 🏆» فيها لينك الدعوة بتاع اللي كسب، وبنشاركها على واتساب وفيسبوك
import { useState } from 'react'
import pyramids from '../assets/pyramids-night.png'
import { useAuth, isGuest } from '../auth.jsx'

const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src })

export async function makeWinImage({ game, detail, name }) {
  const S = 1080
  const c = document.createElement('canvas')
  c.width = S; c.height = S
  const x = c.getContext('2d')
  try { await Promise.all(['900 120px Cairo', '700 48px Cairo'].map((f) => document.fonts?.load(f))) } catch {}
  // الخلفية: ليلة الأهرامات
  const bg = x.createLinearGradient(0, 0, 0, S)
  bg.addColorStop(0, '#120A22'); bg.addColorStop(0.6, '#2A1A3A'); bg.addColorStop(1, '#4A2C14')
  x.fillStyle = bg; x.fillRect(0, 0, S, S)
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,240,200,${0.2 + Math.random() * 0.5})`; x.beginPath(); x.arc(Math.random() * S, Math.random() * S * 0.55, Math.random() * 2.2, 0, 7); x.fill() }
  try { const img = await loadImg(pyramids); const w = S * 0.6, h = (img.height / img.width) * w; x.drawImage(img, (S - w) / 2, S - h - 150, w, h) } catch {}
  x.direction = 'rtl'; x.textAlign = 'center'
  x.shadowColor = 'rgba(0,0,0,.75)'; x.shadowBlur = 18
  const gold = (y1, y2) => { const g = x.createLinearGradient(0, y1, 0, y2); g.addColorStop(0, '#FFF1C9'); g.addColorStop(0.55, '#F7D277'); g.addColorStop(1, '#E9A93A'); return g }
  const digits = (t) => String(t || '').replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])
  x.font = '140px serif'; x.fillText('🏆', S / 2, 190)
  x.fillStyle = gold(220, 330); x.font = '900 110px Cairo, sans-serif'; x.fillText('كسبت!', S / 2, 320)
  x.fillStyle = '#FFE9B8'; x.font = '800 60px Cairo, sans-serif'; x.fillText(digits(game), S / 2, 410)
  if (detail) { x.fillStyle = '#E8D8B4'; x.font = '700 40px Cairo, sans-serif'; x.fillText(digits(detail), S / 2, 470) }
  x.fillStyle = '#FFFFFF'; x.font = '800 52px Cairo, sans-serif'; x.fillText(name || '', S / 2, detail ? 545 : 490)
  x.shadowBlur = 0
  // الشريط اللي تحت
  x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, S - 150, S, 150)
  x.fillStyle = gold(S - 130, S - 70); x.font = '900 60px Cairo, sans-serif'; x.fillText('شات كيمت 👑', S / 2, S - 78)
  x.fillStyle = '#EADBB8'; x.font = '700 34px Cairo, sans-serif'; x.fillText('العب معايا ببلاش — chatkemet.pages.dev', S / 2, S - 28)
  return new Promise((ok) => c.toBlob(ok, 'image/png'))
}

export function ShareWinButton({ game, detail, className = '' }) {
  const { user, profile } = useAuth()
  const [busy, setBusy] = useState(false)
  if (!user) return null
  const share = async () => {
    setBusy(true)
    try {
      // اللينك فيه دعوته (٢٠٠ كوين له ولصاحبه) — للمسجّلين بس
      const link = `${window.location.origin}${import.meta.env.BASE_URL}${isGuest(user, profile) ? '' : `?ref=${user.uid}`}`
      const text = `كسبت في ${game} على شات كيمت 🏆 تعالى العب معايا ببلاش:\n${link}`
      const blob = await makeWinImage({ game, detail, name: profile?.name })
      const file = blob && new File([blob], 'kemet-win.png', { type: 'image/png' })
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text }).catch(() => {})
      } else {
        // من غير مشاركة صور (كمبيوتر مثلًا): نحمّل الصورة ونفتح واتساب بالكلام واللينك
        if (blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kemet-win.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000) }
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
      }
    } finally { setBusy(false) }
  }
  return <button type="button" className={`pill-btn pill-gold share-win ${className}`} disabled={busy} onClick={share}>{busy ? 'بيجهّز الصورة...' : '📤 شارك فوزك'}</button>
}
