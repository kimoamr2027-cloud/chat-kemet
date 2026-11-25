// حاجات للمتعة: صندوق الكنز، ملك الغرفة، الهرم اللي بنبنيه سوا، حظك اليوم، الخريطة الحية
import { useEffect, useState } from 'react'
import { pb, q, live } from '../pb/client.js'
import { useAuth } from '../auth.jsx'
import { ar } from '../utils.js'

const IS_PB = import.meta.env.VITE_BACKEND === 'pb'

// ===== صندوق الكنز (في الغرفة) =====
export function ChestDrop({ roomId, showToast }) {
  const [chest, setChest] = useState(null)
  const [busy, setBusy] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!IS_PB || !roomId) return
    setChest(null)
    const take = (r) => { if (r && !r.winner && r.until > Date.now()) setChest(r) }
    pb.collection('chests').getList(1, 1, { filter: `room=${q(roomId)} && winner='' && until>${Date.now()}`, sort: '-created', skipTotal: true })
      .then((r) => take(r.items[0])).catch(() => {})
    const off = live('chests', '*', (ev) => {
      if (ev.record.room !== roomId) return
      if (ev.record.winner || ev.action === 'delete') setChest((c) => (c?.id === ev.record.id ? null : c))
      else take(ev.record)
    }, { filter: `room=${q(roomId)}` })
    const t = setInterval(() => tick((x) => x + 1), 1000)
    return () => { off(); clearInterval(t) }
  }, [roomId])
  if (!chest) return null
  const left = Math.ceil((chest.until - Date.now()) / 1000)
  if (left <= 0) return null
  const open = () => {
    setBusy(true)
    pb.send('/api/kemet/chest/claim', { method: 'POST', body: { id: chest.id } })
      .then((r) => showToast?.(r.won ? `💰 كسبت ${ar(r.coins)} كوين من الكنز!` : r.winnerName ? `😅 ${r.winnerName} سبقك على الكنز` : 'الكنز اختفى'))
      .catch((e) => showToast?.(e?.response?.message || 'حصلت مشكلة'))
      .finally(() => { setBusy(false); setChest(null) })
  }
  return (
    <button type="button" className="chest-drop" disabled={busy} onClick={open} aria-label="افتح صندوق الكنز">
      <span className="chest-ic" aria-hidden="true">💰</span>
      <b>صندوق كنز!</b>
      <small>أول واحد يدوس ياخده · {ar(left)}</small>
    </button>
  )
}

// ===== ملك الغرفة (أنشط واحد في الساعة دي) =====
export function useRoomKing(roomId) {
  const [king, setKing] = useState(null)
  useEffect(() => {
    if (!IS_PB || !roomId) return
    let alive = true
    const load = () => pb.send(`/api/kemet/roomking?room=${encodeURIComponent(roomId)}`, { method: 'GET' }).then((r) => alive && setKing(r?.uid ? r : null)).catch(() => {})
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 120000)
    return () => { alive = false; clearInterval(t) }
  }, [roomId])
  return king
}

// ===== الهرم اللي بنبنيه سوا =====
const ROWS = 6 // ٢١ حجر في الرسمة
export function PyramidCard() {
  const [p, setP] = useState(null)
  useEffect(() => {
    if (!IS_PB) return
    let alive = true
    const load = () => pb.send('/api/kemet/pyramid', { method: 'GET' }).then((r) => alive && setP(r)).catch(() => {})
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 120000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  if (!p) return null
  const pct = Math.min(1, p.stones / Math.max(1, p.goal))
  const total = (ROWS * (ROWS + 1)) / 2
  let filled = p.done ? total : Math.floor(pct * total)
  // من تحت لفوق
  const rows = []
  for (let r = ROWS; r >= 1; r--) {
    const cells = []
    for (let c = 0; c < r; c++) cells.push(filled-- > 0)
    rows.unshift(cells)
  }
  return (
    <div className="card pyramid-card">
      <div className="pyr-art" aria-hidden="true">
        {rows.map((cells, i) => <div key={i} className="pyr-row">{cells.map((on, j) => <span key={j} className={on ? 'pyr-on' : ''} />)}</div>)}
      </div>
      <div className="pyr-body">
        <b>🔺 نبني الهرم سوا</b>
        {p.done
          ? <small>الهرم كمل الأسبوع ده! 🎉 اللي ساعدوا خدوا {ar(p.coins)} كوين. هرم جديد الاتنين الجاي.</small>
          : <small>كل رسالة في الغرف حجر، وكل لعبة ٥، وكل دعوة ٢٠. لو كمل قبل آخر الأسبوع، كل اللي كتب {ar(p.min)} رسايل ياخد {ar(p.coins)} كوين.</small>}
        <span className="tribe-bar"><span style={{ width: `${pct * 100}%` }} /></span>
        <small className="pyr-count">{ar(Math.min(p.stones, p.goal))} / {ar(p.goal)} حجر</small>
      </div>
    </div>
  )
}

// ===== حظك اليوم بالفرعوني =====
const FORTUNES = [
  ['إيزيس', '💕', 'النهارده يومك في الحب والود — كلّم حد بتحبه'],
  ['حورس', '👁', 'خلي عينك مفتوحة، فيه فرصة حلوة جاية لك'],
  ['رع', '☀️', 'طاقتك عالية النهارده، استغلها في حاجة بتحبها'],
  ['تحوت', '📜', 'يوم حلو للتعلم — اسأل واعرف حاجة جديدة'],
  ['حتحور', '🎶', 'النهارده يوم فرح وضحك، اقعد مع ناس بتحبهم'],
  ['أنوبيس', '🌙', 'خد بالك من نفسك وريّح شوية النهارده'],
  ['أوزوريس', '🌾', 'اللي زرعته هتحصده قريب، اصبر'],
  ['سخمت', '🦁', 'قوتك في هدوئك النهارده، ماتتعصبش'],
  ['باستت', '🐈', 'يوم لطيف ورايق، دلّع نفسك بحاجة'],
  ['بتاح', '🔨', 'إيدك فيها البركة النهارده، اعمل حاجة بإيدك'],
  ['ماعت', '⚖️', 'العدل والصدق هيكسبوك النهارده'],
  ['نوت', '✨', 'الليلة حلوة، بص للسما وافتكر أحلامك'],
  ['خنوم', '🏺', 'هتقابل حد جديد يفرق معاك'],
  ['سوبك', '🐊', 'خليك صبور، النيل مابيستعجلش'],
  ['نفتيس', '🌸', 'حد محتاجك النهارده، اسأل على صحابك'],
  ['آمون', '👑', 'النهارده يومك يا ملك، ثق في نفسك'],
]
const dayKey = () => Math.floor((Date.now() + 7200000) / 86400000)
function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
export function FortuneCard() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  if (!user) return null
  const h = hash(`${user.uid}:${dayKey()}`)
  const [god, ic, msg] = FORTUNES[h % FORTUNES.length]
  const lucky = (h >> 8) % 9 + 1
  return (
    <button type="button" className={`card fortune-card ${open ? 'fortune-open' : ''}`} onClick={() => setOpen(!open)}>
      <span className="fortune-ic" aria-hidden="true">{open ? ic : '🔮'}</span>
      {open ? (
        <span className="fortune-body"><b>{god} بيقولك:</b><span>{msg}</span><small>رقم حظك النهارده: {ar(lucky)} 🍀</small></span>
      ) : (
        <span className="fortune-body"><b>حظك اليوم بالفرعوني</b><small>دوس وشوف آلهة مصر بتقولك إيه النهارده</small></span>
      )}
    </button>
  )
}

// ===== الخريطة الحية (المتصلين من كل قبيلة) =====
const SPOTS = { alex: [74, 40], delta: [108, 50], cairo: [116, 66], canal: [154, 56], saeed: [128, 124] }
export function LiveMap({ tribes }) {
  const [m, setM] = useState(null)
  useEffect(() => {
    if (!IS_PB) return
    let alive = true
    const load = () => pb.send('/api/kemet/livemap', { method: 'GET' }).then((r) => alive && setM(r)).catch(() => {})
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  if (!m) return null
  const info = Object.fromEntries((tribes || []).map((t) => [t.id, t]))
  const n = (id) => m.tribes[id] || 0
  return (
    <div className="card livemap">
      <div className="livemap-head"><b>🗺️ مصر دلوقتي</b><small>{ar(m.online)} متصلين — النقطة بتكبر بعدد المتصلين من كل قبيلة</small></div>
      <svg viewBox="0 0 200 180" className="livemap-svg" role="img" aria-label="خريطة المتصلين">
        <path className="lm-land" d="M18 32 L62 26 L100 31 L146 29 L186 35 L168 86 L155 62 L149 70 L174 170 L20 170 Z" />
        <path className="lm-sea" d="M0 0 H200 V24 L186 35 L146 29 L100 31 L62 26 L18 32 L0 30 Z" />
        <path className="lm-nile" d="M132 170 C128 140 122 110 118 70 C116 56 108 46 96 34 M118 70 C122 56 130 44 136 32" />
        {Object.entries(SPOTS).map(([id, [x, y]]) => (
          <g key={id}>
            {n(id) > 0 && <circle className="lm-pulse" cx={x} cy={y} r={6 + Math.min(14, n(id) * 2)} />}
            <circle className={n(id) ? 'lm-dot lm-on' : 'lm-dot'} cx={x} cy={y} r={n(id) ? 5 : 3} />
            <text x={x} y={y - 9} className="lm-label">{(info[id]?.icon || '') + ' ' + ar(n(id))}</text>
          </g>
        ))}
      </svg>
      <small className="lm-abroad">✈️ المصريين برّه مصر: {ar(n('abroad'))} متصلين</small>
    </div>
  )
}
