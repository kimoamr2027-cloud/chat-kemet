// ⚔️ شريط التحدي في الغرفة الصوتية + 💪 لوحة الداعمين
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { pkAct, topSup, supportBoard, SUPPORT_TIERS } from '../pk.js'
import { ar } from '../utils.js'

const fmt = (n) => Number(n || 0).toLocaleString('ar-EG')

export function PkBar({ room, pk, me, royal, showToast }) {
  const [, tick] = useState(0)
  const ended = useRef('')
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(t) }, [])
  if (!pk) return null
  if (pk.status === 'invite') {
    if (pk.b === me) {
      return (
        <div className="pk-invite">
          <span>⚔️ <b>{pk.aName}</b> بيتحداك {ar(pk.mins)} دقايق!</span>
          <button type="button" className="pill-btn pill-gold" onClick={() => pkAct(room, { action: 'accept', id: pk.id }).catch((e) => showToast(e?.response?.message || 'حصلت مشكلة'))}>قبول</button>
          <button type="button" className="pill-btn" onClick={() => pkAct(room, { action: 'decline', id: pk.id }).catch(() => {})}>رفض</button>
        </div>
      )
    }
    return <div className="pk-invite pk-wait">⚔️ <b>{pk.aName}</b> اتحدى <b>{pk.bName}</b>… مستنيين يقبل</div>
  }
  const left = Math.max(0, Math.ceil((pk.endAt - Date.now()) / 1000))
  if (left === 0 && ended.current !== pk.id) { ended.current = pk.id; pkAct(room, { action: 'end', id: pk.id }).catch(() => {}) }
  const a = pk.scoreA || 0, b = pk.scoreB || 0
  const pct = a + b ? (a / (a + b)) * 100 : 50
  const supA = topSup(pk.supA), supB = topSup(pk.supB)
  return (
    <div className={`pk-bar ${left <= 30 ? 'pk-hot' : ''}`}>
      <div className="pk-top">
        <span className="pk-side pk-a"><b>{pk.aName}</b><i>{fmt(a)}</i></span>
        <span className="pk-timer">⚔️ {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
        <span className="pk-side pk-b"><i>{fmt(b)}</i><b>{pk.bName}</b></span>
      </div>
      <div className="pk-track"><span className="pk-fill" style={{ width: `${pct}%` }} /></div>
      <div className="pk-sups">
        <span>{supA.map((s, i) => <em key={s.uid}>{['🥇', '🥈', '🥉'][i]} {s.name}</em>)}</span>
        <span>{supB.map((s, i) => <em key={s.uid}>{['🥇', '🥈', '🥉'][i]} {s.name}</em>)}</span>
      </div>
      <small className="pk-how">ادعم اللي بتحبه: الهدايا بقيمتها، والورد 🌹 بنقطة</small>
      {royal && <button type="button" className="pk-stop" onClick={() => pkAct(room, { action: 'stop', id: pk.id }).catch(() => {})}>⏹ إنهاء</button>}
    </div>
  )
}

// نتيجة التحدي (بتفضل دقيقة بعد ما يخلص)
export function PkResult({ pk }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 5000); return () => clearInterval(t) }, [])
  if (!pk || pk.status !== 'done' || Date.now() - pk.endAt > 60000) return null
  if (pk.winner === 'draw') return <div className="pk-result">🤝 التحدي بين {pk.aName} و{pk.bName} خلص تعادل ({fmt(pk.scoreA)} – {fmt(pk.scoreB)})</div>
  const aWon = pk.winner === pk.a
  const guard = topSup(aWon ? pk.supA : pk.supB)[0]
  return (
    <div className="pk-result">
      🏆 <b>{aWon ? pk.aName : pk.bName}</b> كسب التحدي! ({fmt(aWon ? pk.scoreA : pk.scoreB)} – {fmt(aWon ? pk.scoreB : pk.scoreA)})
      {guard && <> · 🛡 حارس البطل: <b>{guard.name}</b></>}
    </div>
  )
}
// تأثير التحدي على الكرسي: تاج للكسبان ساعة، وطماطم للخسران ١٠ دقايق
export function pkMark(last, uid) {
  if (!last || last.status !== 'done' || last.winner === 'draw' || !uid) return null
  const ago = Date.now() - last.endAt
  if (last.winner === uid && ago < 3600000) return 'win'
  const loser = last.winner === last.a ? last.b : last.a
  if (loser === uid && ago < 600000) return 'lose'
  return null
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
      <h3 className="admin-sub">🏅 مستويات الداعم (كل شهر من جديد)</h3>
      <p className="game-hint">{SUPPORT_TIERS.slice(1).map((t) => `${t.icon} ${t.name}: ${fmt(t.min)}`).join(' · ')}</p>
    </div>
  )
}
