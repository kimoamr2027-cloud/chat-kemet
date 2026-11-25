// ⚔️ شريط التحدي في الغرفة الصوتية + 💪 لوحة الداعمين
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { pkAct, topSup, supportBoard, SUPPORT_TIERS, dareFor, PUNISH_MS, DOUBLE_MS, pkBoard, pkSideOf } from '../pk.js'
import { ar } from '../utils.js'
import { Avatar, Sheet } from './ui.jsx'
import { Coin, fmtCoins } from './Coins.jsx'
import { useAvatar } from '../dm.js'
import { colorIndex } from '../rooms.js'
import { GIFTS } from '../gifts.js'

const fmt = (n) => Number(n || 0).toLocaleString('ar-EG')

// ⚡ الدعم السريع: دوسة على صورة المتسابق = الهدية السريعة بتاعتك على طول (العادي وردة ببلاش)
const QG_KEY = 'kemet-quick-gift'
export const QUICK_ROSE = { id: 'rose', e: '🌹', name: 'وردة ببلاش', price: 0 }
export function getQuickGift() { try { const id = localStorage.getItem(QG_KEY); return GIFTS.find((g) => g.id === id) || QUICK_ROSE } catch { return QUICK_ROSE } }
function setQuickGift(g) { try { localStorage.setItem(QG_KEY, g.id) } catch {} }

function SideFace({ uid, name, team, onTap, pops }) {
  const src = useAvatar(team ? null : uid)
  return (
    <button type="button" className="pk-face" onClick={onTap} aria-label={`ادعم ${name}`}>
      {team ? <span className="pk-team-ic">{team === 'A' ? '🔴' : '🔵'}</span>
        : <Avatar text={(name || '؟').charAt(0)} c={colorIndex(uid || '')} size={40} round src={src || undefined} uid={uid} />}
      {pops.map((p) => <i key={p.id} className="pk-pop">+{ar(p.n)}</i>)}
    </button>
  )
}

export function PkBar({ room, pk, me, royal, showToast, act, onSupport }) {
  const doAct = act || ((body) => pkAct(room, body))
  const [, tick] = useState(0)
  const ended = useRef('')
  const [quick, setQuick] = useState(getQuickGift)
  const [picker, setPicker] = useState(false)
  const [pops, setPops] = useState({ A: [], B: [] })
  const pop = (side, n) => {
    const id = Math.random().toString(36).slice(2)
    setPops((p) => ({ ...p, [side]: [...p[side].slice(-4), { id, n }] }))
    setTimeout(() => setPops((p) => ({ ...p, [side]: p[side].filter((x) => x.id !== id) })), 1200)
  }
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(t) }, [])
  if (!pk) return null
  if (pk.status === 'invite') {
    if (pk.b === me) {
      return (
        <div className="pk-invite">
          <span>⚔️ <b>{pk.aName}</b> بيتحداك {ar(pk.mins)} دقايق!</span>
          <button type="button" className="pill-btn pill-gold" onClick={() => doAct({ action: 'accept', id: pk.id }).catch((e) => showToast(e?.response?.message || 'حصلت مشكلة'))}>قبول</button>
          <button type="button" className="pill-btn" onClick={() => doAct({ action: 'decline', id: pk.id }).catch(() => {})}>رفض</button>
        </div>
      )
    }
    return <div className="pk-invite pk-wait">⚔️ <b>{pk.aName}</b> اتحدى <b>{pk.bName}</b>… مستنيين يقبل</div>
  }
  const left = Math.max(0, Math.ceil((pk.endAt - Date.now()) / 1000))
  if (left === 0 && ended.current !== pk.id) { ended.current = pk.id; doAct({ action: 'end', id: pk.id }).catch(() => {}) }
  const a = pk.scoreA || 0, b = pk.scoreB || 0
  const pct = a + b ? (a / (a + b)) * 100 : 50
  const supA = topSup(pk.supA), supB = topSup(pk.supB)
  const isTeam = (pk.teamA || []).length > 0
  const double = left * 1000 <= DOUBLE_MS
  const support = (side) => {
    if (!onSupport || left === 0) return
    Promise.resolve(onSupport(side, quick)).then((ok) => { if (ok !== false) pop(side, (quick.price || 1) * (double ? 2 : 1)) }).catch(() => {})
  }
  return (
    <div className={`pk-bar ${left <= 30 ? 'pk-hot' : ''}`}>
      <div className="pk-top">
        {onSupport && <SideFace uid={pk.a} name={pk.aName} team={isTeam && 'A'} onTap={() => support('A')} pops={pops.A} />}
        <span className="pk-side pk-a"><b>{pk.aName}</b><i>{fmt(a)}</i></span>
        <span className={`pk-timer ${left * 1000 <= DOUBLE_MS ? 'pk-x2' : ''}`}>{left * 1000 <= DOUBLE_MS ? '🔥×٢ ' : '⚔️ '}{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
        <span className="pk-side pk-b"><i>{fmt(b)}</i><b>{pk.bName}</b></span>
        {onSupport && <SideFace uid={pk.b} name={pk.bName} team={isTeam && 'B'} onTap={() => support('B')} pops={pops.B} />}
      </div>
      <div className="pk-track"><span className="pk-fill" style={{ width: `${pct}%` }} /></div>
      <div className="pk-sups">
        <span>{supA.map((s, i) => <em key={s.uid}>{['🥇', '🥈', '🥉'][i]} {s.name}</em>)}</span>
        <span>{supB.map((s, i) => <em key={s.uid}>{['🥇', '🥈', '🥉'][i]} {s.name}</em>)}</span>
      </div>
      <small className="pk-how">{double ? '🔥 آخر دقيقة: كل الهدايا بالضعف!' : onSupport ? '👆 دوس على صورة اللي بتحبه وادعمه على طول' : 'ادعم اللي بتحبه: الهدايا بقيمتها، والورد والقلوب بنقطة'}</small>
      {onSupport && (
        <button type="button" className="pk-quick" onClick={() => setPicker(true)}>
          ⚡ دعمك السريع: {quick.img ? <img src={quick.img} alt="" /> : quick.e} {quick.name}{quick.price ? <> · <Coin size="sm" /> {fmtCoins(quick.price)}</> : ''} ▾
        </button>
      )}
      {royal && <button type="button" className="pk-stop" onClick={() => doAct({ action: 'stop', id: pk.id }).catch(() => {})}>⏹ إنهاء</button>}
      {picker && (
        <Sheet onClose={() => setPicker(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">⚡ اختار دعمك السريع</h2>
          <p className="sheet-sub">بعد كده كل دوسة على صورة المتسابق بتبعت الهدية دي على طول (والكوينز بتتخصم).</p>
          <div className="gs-grid">
            {[QUICK_ROSE, ...GIFTS].map((g) => (
              <button key={g.id} type="button" className={`gs-g ${quick.id === g.id ? 'on' : ''}`} onClick={() => { setQuick(g); setQuickGift(g); setPicker(false) }}>
                <span className="ic">{g.img ? <img src={g.img} alt="" /> : g.e}</span><b>{g.name}</b><small>{g.price ? <><Coin size="sm" /> {fmtCoins(g.price)}</> : 'ببلاش · نقطة'}</small>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}

// نتيجة التحدي (بتفضل دقيقة بعد ما يخلص)
export function PkResult({ pk }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t) }, [])
  if (!pk || pk.status !== 'done' || Date.now() - pk.endAt > PUNISH_MS + 30000) return null
  if (pk.winner === 'draw') return <div className="pk-result">🤝 التحدي بين {pk.aName} و{pk.bName} خلص تعادل ({fmt(pk.scoreA)} – {fmt(pk.scoreB)})</div>
  const aWon = pk.winner === pk.a
  const guard = topSup(aWon ? pk.supA : pk.supB)[0]
  const punishLeft = Math.ceil((pk.endAt + PUNISH_MS - Date.now()) / 1000)
  return (
    <div className="pk-result">
      🏆 <b>{aWon ? pk.aName : pk.bName}</b> كسب التحدي! ({fmt(aWon ? pk.scoreA : pk.scoreB)} – {fmt(aWon ? pk.scoreB : pk.scoreA)})
      {guard && <> · 🛡 حارس البطل: <b>{guard.name}</b></>}
      {punishLeft > 0 && <div className="pk-punish">🎭 وقت العقاب ({ar(punishLeft)}): <b>{aWon ? pk.bName : pk.aName}</b> لازم {dareFor(pk)}</div>}
    </div>
  )
}
// تأثير التحدي على الكرسي: تاج للكسبان ساعة، وطماطم للخسران ١٠ دقايق
export function pkMark(last, uid) {
  if (!last || last.status !== 'done' || last.winner === 'draw' || !uid) return null
  const ago = Date.now() - last.endAt
  const side = pkSideOf(last, uid)
  if (!side) return null
  const won = (side === 'A') === (last.winner === last.a)
  if (won && ago < 3600000) return 'win'
  if (!won && ago < 600000) return 'lose'
  return null
}
// ⚔️ أبطال التحديات الأسبوع ده
export function PkBoard() {
  const [d, setD] = useState(null)
  useEffect(() => { pkBoard().then(setD).catch(() => setD([])) }, [])
  return (
    <>
      <h3 className="admin-sub">⚔️ أبطال التحديات (الأسبوع ده)</h3>
      <p className="game-hint">كل اتنين: الأول ٢٠٠ كوين، والتاني ١٠٠، والتالت ٥٠</p>
      {!d ? <p className="game-hint">بيحمّل...</p> : !d.length ? <p className="game-hint">محدش كسب تحدي الأسبوع ده لسه</p> : d.map((r, i) => (
        <Link key={r.uid} to={`/u/${r.uid}`} className="top-member"><span className="top-rank">{['🥇', '🥈', '🥉'][i] || ar(i + 1)}</span><span className="top-name">{r.name}{r.streak >= 2 && ` 🔥${ar(r.streak)}`}</span><span className="hbar-val">{ar(r.n)} انتصار</span></Link>
      ))}
    </>
  )
}

export function SupportBoard() {
  const [d, setD] = useState(null)
  useEffect(() => { supportBoard().then(setD).catch(() => setD({ givers: [], takers: [] })) }, [])
  const List = ({ rows, empty }) => (rows?.length ? rows.map((r, i) => (
    <Link key={r.uid} to={`/u/${r.uid}`} className="top-member"><span className="top-rank">{ar(i + 1)}</span><span className="top-name">{r.name}</span><span className="hbar-val">{fmt(r.n)} 🪙</span></Link>
  )) : <p className="game-hint">{empty}</p>)
  return (
    <div className="support-board">
      <h2 className="sheet-title">💪 الداعمين — الأسبوع ده</h2>
      <h3 className="admin-sub">🎁 أكبر الداعمين</h3>
      {d ? <List rows={d.givers} empty="محدش بعت هدايا الأسبوع ده لسه" /> : <p className="game-hint">بيحمّل...</p>}
      <h3 className="admin-sub">⭐ أكتر ناس اتدعموا</h3>
      {d && <List rows={d.takers} empty="لسه" />}
      <PkBoard />
      <h3 className="admin-sub">🏅 مستويات الداعم (كل شهر من جديد)</h3>
      <p className="game-hint">{SUPPORT_TIERS.slice(1).map((t) => `${t.icon} ${t.name}: ${fmt(t.min)}`).join(' · ')}</p>
    </div>
  )
}
