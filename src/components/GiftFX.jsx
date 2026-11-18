// عرض الهدايا زي التطبيقات: انفجار نور وكونفيتي ودهب، الهدية بتلف وتظهر، وشريط على الجنب فيه مين بعت لمين وعدّاد
import { useEffect, useRef } from 'react'
import { Avatar } from './ui.jsx'
import { useUser } from '../dm.js'
import { colorIndex } from '../rooms.js'
import { ar } from '../utils.js'
import { giftOf } from '../gifts.js'

function Face({ uid, name, size }) {
  const u = useUser(uid)
  return <Avatar text={(name || '؟').charAt(0)} c={colorIndex(uid)} size={size} round src={u?.avatar} />
}

// جزيئات: عملات دهب، كونفيتي، ونجوم — بترسم على canvas
function Burst({ seed, big }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = cv.clientWidth, H = cv.clientHeight
    cv.width = W * dpr; cv.height = H * dpr
    const ctx = cv.getContext('2d')
    ctx.scale(dpr, dpr)
    const cx = W / 2, cy = H * (big ? 0.4 : 0.48)
    const colors = ['#F7DC8C', '#FFD54A', '#FF5A76', '#7FD3FF', '#B794F4', '#FFFFFF', '#4FD1C5']
    const N = big ? 150 : 70
    const ps = Array.from({ length: N }, (_, i) => {
      const a = Math.random() * Math.PI * 2
      const sp = (big ? 6 : 4) + Math.random() * (big ? 9 : 6)
      const kind = i % 5 === 0 ? 'coin' : i % 5 === 1 ? 'star' : 'conf'
      return { x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (big ? 4 : 3), r: kind === 'coin' ? 6 + Math.random() * 5 : 3 + Math.random() * 4,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length], kind, life: 1 }
    })
    let raf = 0
    const t0 = performance.now()
    const draw = (t) => {
      const el = (t - t0) / 1000
      ctx.clearRect(0, 0, W, H)
      for (const p of ps) {
        p.vy += 0.22; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr
        p.life = Math.max(0, 1 - el / (big ? 3.4 : 2.4))
        ctx.globalAlpha = p.life
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot)
        if (p.kind === 'coin') {
          const g = ctx.createRadialGradient(-p.r / 3, -p.r / 3, 1, 0, 0, p.r)
          g.addColorStop(0, '#FFF6C8'); g.addColorStop(0.5, '#F2C14E'); g.addColorStop(1, '#A66E12')
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * Math.abs(Math.cos(p.rot * 2)) + 1, 0, 0, Math.PI * 2); ctx.fill()
        } else if (p.kind === 'star') {
          ctx.fillStyle = p.c; ctx.beginPath()
          for (let k = 0; k < 8; k++) { const rr = k % 2 ? p.r * 0.4 : p.r * 1.4; ctx.lineTo(Math.cos(k * Math.PI / 4) * rr, Math.sin(k * Math.PI / 4) * rr) }
          ctx.fill()
        } else { ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r) }
        ctx.restore()
      }
      if (el < (big ? 3.5 : 2.5)) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [seed, big])
  return <canvas ref={ref} className="gx-canvas" />
}

export default function GiftFX({ cur }) {
  if (!cur) return null
  const g = giftOf(cur.gift)
  if (!g) return null
  return (
    <div className={`gx ${g.big ? 'gx-big' : 'gx-small'}`} key={cur.id}>
      {g.big && <div className="gx-dim" />}
      {g.big && <div className="gx-rays" />}
      <div className="gx-glow" />
      <Burst seed={cur.bump} big={g.big} />
      <div className="gx-center">
        <span className="gx-emoji" key={cur.bump}>{g.e}</span>
        {g.big && <b className="gx-name">{g.name}</b>}
      </div>
      {/* الشريط اللي على الجنب: مين بعت لمين + العدّاد */}
      <div className="gx-banner">
        <Face uid={cur.from} name={cur.fromName} size={38} />
        <span className="gx-who"><b>{cur.fromName}</b><small>أهدى {g.name} لـ {cur.toName}</small></span>
        <span className="gx-mini">{g.e}</span>
        <span className="gx-combo" key={cur.bump}>x{ar(cur.combo)}</span>
      </div>
    </div>
  )
}
