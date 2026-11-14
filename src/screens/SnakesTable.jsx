// ترابيزة السلم والتعبان
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Back } from '../components/Icons.jsx'
import { Sheet, useToast } from '../components/ui.jsx'
import { Pin, Dice } from '../components/LudoBits.jsx'
import { useAuth } from '../auth.jsx'
import { useNow } from '../presence.js'
import { ar } from '../utils.js'
import { hasBadWord, useFilter } from '../filter.js'
import { logDiag, ludoInfo } from '../diag.js'
import { playDice, playStep, playWin, playTurn, soundOn } from '../sound.js'
import {
  useTable, useTableChat, sendTableChat, joinTable, startNow, rollDice, passTurn, leaveTable, claimWin,
  closeTable, createTable, diceOf, TURN_MS, LADDERS, SNAKES, snCell, moveSnake,
} from '../ludo.js'

const KIND = 'snakes'
const TILE = ['#FFF6E0', '#FFE9B8']

// مركز الخانة بوحدة الخانات (من ٠ لـ ١٠)
const center = (n) => { const [r, c] = snCell(n); return [c + 0.5, r + 0.5] }

function BoardArt() {
  const tiles = useMemo(() => {
    const out = []
    for (let n = 1; n <= 100; n++) {
      const [r, c] = snCell(n)
      out.push(
        <div key={n} className="sn-tile" style={{ gridArea: `${r + 1}/${c + 1}`, background: TILE[(r + c) % 2] }}>
          <span>{ar(n)}</span>{n === 100 && <b>👑</b>}
        </div>,
      )
    }
    return out
  }, [])
  // السلالم والتعابين مرسومة SVG فوق الخانات
  const ladders = Object.entries(LADDERS).map(([a, b]) => {
    const [x1, y1] = center(+a); const [x2, y2] = center(+b)
    const dx = x2 - x1; const dy = y2 - y1; const len = Math.hypot(dx, dy)
    const nx = (-dy / len) * 0.22; const ny = (dx / len) * 0.22
    const rungs = Math.max(2, Math.round(len * 2.2))
    return (
      <g key={`l${a}`} className="sn-ladder">
        <line x1={x1 + nx} y1={y1 + ny} x2={x2 + nx} y2={y2 + ny} />
        <line x1={x1 - nx} y1={y1 - ny} x2={x2 - nx} y2={y2 - ny} />
        {Array.from({ length: rungs }, (_, i) => {
          const k = (i + 0.5) / rungs; const px = x1 + dx * k; const py = y1 + dy * k
          return <line key={i} className="rung" x1={px + nx} y1={py + ny} x2={px - nx} y2={py - ny} />
        })}
      </g>
    )
  })
  const snakes = Object.entries(SNAKES).map(([a, b], i) => {
    const [x1, y1] = center(+a); const [x2, y2] = center(+b)
    const dx = x2 - x1; const dy = y2 - y1; const len = Math.hypot(dx, dy)
    const nx = -dy / len; const ny = dx / len
    const w = Math.min(0.9, len * 0.18)
    const c1 = [x1 + dx * 0.33 + nx * w, y1 + dy * 0.33 + ny * w]
    const c2 = [x1 + dx * 0.66 - nx * w, y1 + dy * 0.66 - ny * w]
    const d = `M${x1},${y1} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${x2},${y2}`
    const hue = ['#2E8B57', '#7A3FB0', '#C0392B', '#1F6FB2'][i % 4]
    return (
      <g key={`s${a}`}>
        <path d={d} className="sn-body" style={{ stroke: hue }} />
        <path d={d} className="sn-stripe" />
        <circle cx={x1} cy={y1} r="0.3" fill={hue} stroke="#fff" strokeWidth="0.06" />
        <circle cx={x1 - 0.1} cy={y1 - 0.08} r="0.06" fill="#fff" /><circle cx={x1 + 0.1} cy={y1 - 0.08} r="0.06" fill="#fff" />
      </g>
    )
  })
  return (
    <>
      {tiles}
      <svg className="sn-svg" viewBox="0 0 10 10" aria-hidden="true">{ladders}{snakes}</svg>
    </>
  )
}

function PlayerCard({ t, seat, me }) {
  const now = useNow(1000)
  if (seat >= t.seats.length) return null
  const uid = t.seats[seat]
  const turn = t.status === 'playing' && t.turn === seat
  const left = t.left?.[uid]
  const sec = Math.max(0, Math.ceil(((t.turnAt?.toMillis?.() || now) + TURN_MS - now) / 1000))
  return (
    <div className={`lpc ${turn ? 'lpc-turn' : ''} ${left ? 'lpc-left' : ''}`}>
      <Pin uid={uid} name={t.names[uid]} off={t.colors[seat]} tail={false} />
      <div className="lpc-b">
        <b>{t.winner === uid ? '👑 ' : ''}{t.names[uid]}{uid === me ? ' (انت)' : ''}</b>
        <small>{left ? 'خرج' : turn ? <>دوره · <span className="lpc-timer">{ar(Math.min(45, sec))} ث</span></> : `خانة ${ar(t[`p${seat}`] || 0)}`}</small>
      </div>
    </div>
  )
}

export default function SnakesTable() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const t = useTable(id, KIND)
  const chat = useTableChat(id, KIND)
  const navigate = useNavigate()
  const now = useNow(4000)
  const [toast, showToast] = useToast()
  const [rolling, setRolling] = useState(false)
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [flash, setFlash] = useState('')
  const badWords = useFilter()
  const acted = useRef('')

  const me = user.uid
  const mySeat = t ? t.seats.indexOf(me) : -1
  const seated = mySeat >= 0
  const iLeft = !!t?.left?.[me]
  const dice = t ? diceOf(t) : 0
  const myTurn = !!t && t.status === 'playing' && t.turn === mySeat && !iLeft
  const stateKey = t ? `${t.turn}-${t.phase}-${t.rolledAt?.seconds || 0}-${t.rolledAt?.nanoseconds || 0}-${t.pending}` : ''

  // أصوات + رسالة "سلم!" أو "تعبان!"
  const prev = useRef(null)
  useEffect(() => {
    if (!t || t.pending) return
    const p = prev.current
    prev.current = t
    if (!p) return
    if (t.last && JSON.stringify(t.last) !== JSON.stringify(p.last)) {
      const { from, to, dice: d, seat } = t.last
      const who = t.names[t.seats[seat]]
      if (to > from + d) setFlash(`🪜 ${who} طلع السلم لـ ${ar(to)}!`)
      else if (to < from + d && from + d <= 100) setFlash(`🐍 التعبان أكل ${who} ونزل لـ ${ar(to)}!`)
    }
    if (!soundOn('sound')) return
    if (t.status === 'done' && p.status !== 'done') return playWin()
    if (t.phase === 'move' && p.phase !== 'move') playDice()
    if (t.last && JSON.stringify(t.last) !== JSON.stringify(p.last)) playStep()
    if (t.status === 'playing' && t.turn === mySeat && (p.turn !== mySeat || p.status !== 'playing') && t.phase === 'roll') playTurn()
  }, [t, mySeat])
  useEffect(() => { if (!flash) return; const x = setTimeout(() => setFlash(''), 2600); return () => clearTimeout(x) }, [flash])
  useEffect(() => { if (dice || t?.phase === 'roll') setRolling(false) }, [dice, t?.phase])

  // النقلة بتتعمل لوحدها بعد النرد، والدور اللي اتأخر بيعدّي
  useEffect(() => {
    if (!t || t.pending || t.status !== 'playing' || !seated || iLeft) return
    const cur = t.seats[t.turn]
    if (myTurn && t.phase === 'move' && dice && acted.current !== stateKey) {
      acted.current = stateKey
      setTimeout(() => moveSnake(t, me).catch((e) => logDiag('snakes.move', e, ludoInfo(t, mySeat))), 650)
      return
    }
    const active = t.seats.filter((u) => !t.left?.[u])
    if (active.length === 1 && active[0] === me && acted.current !== 'claim') {
      acted.current = 'claim'
      claimWin(t, me).catch((e) => logDiag('snakes.claim', e, ludoInfo(t, mySeat)))
      return
    }
    if (cur !== me) {
      const helper = t.seats.find((u, j) => j !== t.turn && !t.left?.[u])
      const late = now > (t.turnAt?.toMillis?.() || now) + TURN_MS + (helper === me ? 1500 : 8000)
      if ((t.left?.[cur] || late) && acted.current !== `skip-${stateKey}`) {
        acted.current = `skip-${stateKey}`
        passTurn(t).catch((e) => logDiag('snakes.skip', e, ludoInfo(t, mySeat)))
      }
    }
  }, [stateKey, now, dice]) // eslint-disable-line react-hooks/exhaustive-deps

  if (t === undefined) return <main className="screen ludo-screen"><p className="l-msg">بيحمّل الترابيزة...</p></main>
  if (t === null) {
    return (
      <main className="screen ludo-screen">
        <p className="l-msg">الترابيزة دي اتقفلت 🐍</p>
        <Link to="/games" className="lbtn lbtn-orange l-msg-btn">رجوع للألعاب</Link>
      </main>
    )
  }

  // أماكن القطع (اللي في نفس الخانة بيتزحزحوا شوية)
  const bySpot = new Map()
  t.seats.forEach((uid, seat) => {
    const n = t[`p${seat}`] || 0
    if (!bySpot.has(n)) bySpot.set(n, [])
    bySpot.get(n).push({ uid, seat, n })
  })
  const tokens = []
  for (const [n, list] of bySpot) {
    list.forEach((p, k) => {
      const shift = list.length > 1 ? (k - (list.length - 1) / 2) * 0.32 : 0
      if (n === 0) tokens.push({ ...p, start: true })
      else { const [x, y] = center(n); tokens.push({ ...p, x: x + shift, y }) }
    })
  }

  const cur = t.seats[t.turn]
  const lastDice = t.phase === 'move' ? dice : t.last?.dice || 0
  const showRolling = rolling || (t.phase === 'move' && !dice)

  function roll() {
    if (!myTurn || t.phase !== 'roll' || rolling) return
    setRolling(true)
    rollDice(t).catch((e) => { logDiag('snakes.roll', e, ludoInfo(t, mySeat)); setRolling(false); showToast('النرد ماترماش، جرب تاني') })
  }
  function say(text) {
    const x = text.trim()
    if (!x || !seated) return
    if (hasBadWord(x, badWords)) return showToast('فيها كلمة ممنوعة 🚫')
    setDraft(''); setTyping(false)
    sendTableChat(id, me, profile.name, x, KIND).catch(() => showToast('الرسالة ماتبعتتش'))
  }
  async function sit() {
    try { await joinTable(id, me, profile.name, KIND) } catch (e) { logDiag('snakes.join', e); showToast('الترابيزة كملت') }
  }
  async function again() {
    try {
      const nid = await createTable({ uid: me, name: profile.name, size: t.seats.length === 2 ? 2 : 4, kind: KIND })
      navigate(`/snakes/${nid}`)
    } catch { showToast('حصلت مشكلة') }
  }
  const ranking = t.status === 'done'
    ? t.seats.map((uid, seat) => ({ uid, seat, score: uid === t.winner ? 1e9 : (t[`p${seat}`] || 0) - (t.left?.[uid] ? 1e6 : 0) })).sort((a, b) => b.score - a.score)
    : []
  const status = t.status === 'waiting' ? `مستنيين لاعبين (${ar(t.seats.length)}/${ar(t.size)})`
    : t.status === 'done' ? `🏆 ${t.winnerName} كسب`
    : myTurn ? (t.phase === 'roll' ? 'دورك! ارمي النرد' : 'بتتحرك...')
    : `دور ${t.names[cur]}`

  return (
    <main className="screen ludo-screen sn-screen">
      <header className="l-head">
        <button type="button" className="l-ibtn" aria-label="رجوع" onClick={() => navigate('/games')}><Back /></button>
        <div className="l-title">السلم والتعبان<small>ترابيزة {t.hostName}{t.roomName ? ` · ${t.roomName}` : ''}</small></div>
        {seated && t.status !== 'done' && !iLeft
          ? <button type="button" className="l-ibtn l-exit" onClick={() => setConfirmLeave(true)}>خروج</button>
          : <span className="l-ibtn l-ghost" />}
      </header>

      <div className="sn-players">
        {t.seats.map((_, seat) => <PlayerCard key={seat} t={t} seat={seat} me={me} />)}
      </div>

      <div className="l-board-wrap">
        <div className="l-board sn-board">
          <BoardArt />
          <div className="l-pieces">
            {tokens.filter((p) => !p.start).map((p) => (
              <span key={p.seat} className="l-spot sn-spot" style={{ top: `${(p.y / 10) * 100}%`, left: `${(p.x / 10) * 100}%`, zIndex: p.seat === t.turn ? 5 : 3 }}>
                <Pin uid={p.uid} name={t.names[p.uid]} off={t.colors[p.seat]} glow={p.seat === t.turn && t.status === 'playing'} />
              </span>
            ))}
          </div>
          {flash && <div className="sn-flash">{flash}</div>}
          {t.status === 'waiting' && (
            <div className="l-wait">
              <b>⏳ مستنيين لاعبين</b>
              <span>{ar(t.seats.length)} من {ar(t.size)} قاعدين</span>
              {!seated && <button type="button" className="lbtn lbtn-orange" onClick={sit}>اقعد والعب</button>}
              {t.host === me && t.seats.length >= 2 && t.size === 4 && (
                <button type="button" className="lbtn lbtn-green" onClick={() => startNow(t).catch((e) => { logDiag('snakes.start', e); showToast('حصلت مشكلة') })}>ابدأ بالموجودين ({ar(t.seats.length)})</button>
              )}
              {t.host === me && <small>ابعت لصحابك الترابيزة من الغرفة أو الخاص، أو استنى حد يقعد من «ترابيزات مفتوحة».</small>}
            </div>
          )}
        </div>
      </div>
      {tokens.some((p) => p.start) && t.status !== 'waiting' && (
        <div className="sn-start"><span>لسه ماتحركوش:</span>{tokens.filter((p) => p.start).map((p) => <Pin key={p.seat} uid={p.uid} name={t.names[p.uid]} off={t.colors[p.seat]} tail={false} />)}</div>
      )}

      <div className="l-bottom">
        <div className="l-bubbles">
          {chat.slice(-2).map((m) => (
            <div key={m.id} className={`l-bb ${m.uid === me ? 'me' : ''}`}><b>{m.uid === me ? 'انت' : m.name}</b>{m.text}</div>
          ))}
        </div>
        <div className="l-drow">
          <button type="button" className={`l-dicebox ${myTurn && t.phase === 'roll' ? 'l-dice-ready' : ''}`} onClick={roll} aria-label="ارمي النرد">
            <Dice n={showRolling ? 0 : lastDice} rolling={showRolling} />
          </button>
          <button type="button" className="l-roll" disabled={!(myTurn && t.phase === 'roll') || rolling} onClick={roll}>
            {myTurn && t.phase === 'roll' ? 'ارمي النرد 🎲' : status}
            <small>{t.status === 'playing' && myTurn && t.phase === 'roll' ? 'الـ٦ بتديك دور كمان' : t.status === 'playing' && !myTurn && seated ? 'استنى دورك' : !seated ? 'انت بتتفرّج' : ''}</small>
          </button>
        </div>
        {seated && (typing ? (
          <form className="l-type" onSubmit={(e) => { e.preventDefault(); say(draft) }}>
            <input className="l-input" autoFocus maxLength={120} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="اكتب رسالة..." />
            <button type="submit" className="lbtn lbtn-orange lbtn-sm">ابعت</button>
            <button type="button" className="l-ibtn" onClick={() => setTyping(false)}>✕</button>
          </form>
        ) : (
          <div className="l-quick">
            {['😂', '🔥', '🐍', '👏'].map((e) => <button key={e} type="button" onClick={() => say(e)}>{e}</button>)}
            <button type="button" className="l-msgbtn" onClick={() => setTyping(true)}>اكتب رسالة...</button>
          </div>
        ))}
      </div>

      {t.status === 'done' && (
        <div className="l-win-scrim">
          <div className="l-win">
            <div className="l-ribbon">🎉 {t.winner === me ? 'مبروك!' : 'اللعبة خلصت'} 🎉</div>
            <Pin uid={t.winner} name={t.winnerName} off={t.colors[t.seats.indexOf(t.winner)]} className="l-winner" />
            <h2>👑 {t.winner === me ? 'انت كسبت!' : `${t.winnerName} كسب!`}</h2>
            <p>{t[`p${t.seats.indexOf(t.winner)}`] === 100 ? 'وصل لخانة ١٠٠ الأول' : 'الباقيين خرجوا من اللعبة'}</p>
            <div className="l-pods">
              {ranking.map((r, k) => (
                <div key={r.uid} className="l-pod">
                  <span>{['🥇', '🥈', '🥉', '٤'][k]}</span>
                  <Pin uid={r.uid} name={t.names[r.uid]} off={t.colors[r.seat]} tail={false} />
                  {t.names[r.uid]}
                  <span className="l-pts">{k === 0 ? '+١ مكسب' : t.left?.[r.uid] ? 'خرج' : `خانة ${ar(t[`p${r.seat}`] || 0)}`}</span>
                </div>
              ))}
            </div>
            <button type="button" className="lbtn lbtn-green l-again" onClick={again}>نلعب تاني؟</button>
            <button type="button" className="l-link" onClick={() => { if (t.host === me) closeTable(id, KIND).catch(() => {}); navigate('/games') }}>رجوع للألعاب</button>
          </div>
        </div>
      )}

      {confirmLeave && (
        <Sheet onClose={() => setConfirmLeave(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">تخرج من اللعبة؟</h2>
          <p className="sheet-sub">{t.status === 'waiting' && t.host === me ? 'الترابيزة هتتقفل لكل اللي قاعدين.' : 'مش هتقدر ترجع للعبة دي تاني، ودورك هيعدّي لوحده.'}</p>
          <button type="button" className="btn-primary danger-bg" onClick={() => { setConfirmLeave(false); leaveTable(t, me).then(() => navigate('/games')).catch((e) => { logDiag('snakes.leave', e); showToast('حصلت مشكلة') }) }}>أيوه، اخرج</button>
          <button type="button" className="btn-outline" style={{ marginTop: 8 }} onClick={() => setConfirmLeave(false)}>لا، كمّل</button>
        </Sheet>
      )}
      {toast}
    </main>
  )
}
