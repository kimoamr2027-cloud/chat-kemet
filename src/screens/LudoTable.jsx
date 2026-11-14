// ترابيزة لودو كيمت
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Back } from '../components/Icons.jsx'
import { Sheet, useToast } from '../components/ui.jsx'
import { Pin, Dice } from '../components/LudoBits.jsx'
import { useAuth } from '../auth.jsx'
import { useNow } from '../presence.js'
import { ar } from '../utils.js'
import { hasBadWord, useFilter } from '../filter.js'
import { playDice, playStep, playWin, playTurn, soundOn } from '../sound.js'
import {
  useTable, useTableChat, sendTableChat, joinTable, startNow, rollDice, passTurn, movePiece, leaveTable, claimWin,
  closeTable, createTable, diceOf, legalPieces, spotOf, PATH, SAFE, TURN_MS, COLOR_HEX, COLOR_AR, colorIdx,
} from '../ludo.js'

const START = { '6,1': 0, '1,8': 1, '8,13': 2, '13,6': 3 }
const HOME_COL = {}
for (let k = 1; k <= 5; k++) { HOME_COL[`7,${k}`] = 0; HOME_COL[`${k},7`] = 1; HOME_COL[`7,${14 - k}`] = 2; HOME_COL[`${14 - k},7`] = 3 }
const SAFE_CELLS = new Set(SAFE.map((a) => PATH[a].join(',')))

// اللوحة الثابتة (بتترسم مرة واحدة)
function BoardBase({ used }) {
  const cells = useMemo(() => {
    const out = []
    for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
      if (((r < 6 || r > 8) && (c < 6 || c > 8)) || (r >= 6 && r <= 8 && c >= 6 && c <= 8)) continue
      const k = `${r},${c}`
      const col = HOME_COL[k] ?? START[k]
      out.push(
        <div key={k} className="lcell" style={{ gridArea: `${r + 1}/${c + 1}`, ...(col !== undefined ? { background: COLOR_HEX[col] } : {}) }}>
          {START[k] !== undefined ? <span className="lcell-arrow">➜</span> : SAFE_CELLS.has(k) ? '★' : null}
        </div>,
      )
    }
    return out
  }, [])
  return (
    <>
      {cells}
      {[[1, 1, 0], [1, 10, 1], [10, 10, 2], [10, 1, 3]].map(([r, c, ci]) => (
        <div key={ci} className={`lhome ${used.includes(ci) ? '' : 'lhome-off'}`} style={{ gridArea: `${r}/${c}/${r + 6}/${c + 6}`, background: COLOR_HEX[ci] }}>
          <div className="lhome-in">{[0, 1, 2, 3].map((i) => <span key={i} className="lslot" />)}</div>
        </div>
      ))}
      <div className="lcenter" />
    </>
  )
}

function PlayerCard({ t, seat, me }) {
  const now = useNow(1000) // العدّاد بيتحدّث هنا بس، مش الشاشة كلها
  if (seat === undefined || seat >= t.seats.length) return <div className="lpc lpc-empty" />
  const uid = t.seats[seat]
  const off = t.colors[seat]
  const turn = t.status === 'playing' && t.turn === seat
  const left = t.left?.[uid]
  const sec = Math.max(0, Math.ceil(((t.turnAt?.toMillis?.() || now) + TURN_MS - now) / 1000))
  const home = t[`p${seat}`].filter((p) => p === 57).length
  return (
    <div className={`lpc ${turn ? 'lpc-turn' : ''} ${left ? 'lpc-left' : ''}`}>
      <Pin uid={uid} name={t.names[uid]} off={off} tail={false} />
      <div className="lpc-b">
        <b>{t.winner === uid ? '👑 ' : ''}{t.names[uid]}{uid === me ? ' (انت)' : ''}</b>
        <small>{left ? 'خرج' : turn ? <>دوره · <span className="lpc-timer">{ar(Math.min(45, sec))} ث</span></> : `${COLOR_AR[colorIdx(off)]}${home ? ` · ${ar(home)} وصل` : ''}`}</small>
      </div>
    </div>
  )
}

export default function LudoTable() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const t = useTable(id)
  const chat = useTableChat(id)
  const navigate = useNavigate()
  const now = useNow(4000) // للدور اللي اتأخر بس
  const [toast, showToast] = useToast()
  const [rolling, setRolling] = useState(false)
  const [moving, setMoving] = useState(false)
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const badWords = useFilter()
  const acted = useRef('')

  const me = user.uid
  const mySeat = t ? t.seats.indexOf(me) : -1
  const seated = mySeat >= 0
  const iLeft = !!t?.left?.[me]
  const dice = t ? diceOf(t) : 0
  const myTurn = !!t && t.status === 'playing' && t.turn === mySeat && !iLeft
  const legal = myTurn && t.phase === 'move' && dice ? legalPieces(t[`p${mySeat}`], dice) : []
  const stateKey = t ? `${t.turn}-${t.phase}-${t.rolledAt?.seconds || 0}-${t.rolledAt?.nanoseconds || 0}-${t.pending}` : ''

  // أصوات
  const prev = useRef(null)
  useEffect(() => {
    if (!t || t.pending) return
    const p = prev.current
    prev.current = t
    if (!p || !soundOn('sound')) return
    if (t.status === 'done' && p.status !== 'done') return playWin()
    if (t.phase === 'move' && p.phase !== 'move') playDice()
    if (t.last && JSON.stringify(t.last) !== JSON.stringify(p.last)) playStep()
    if (t.status === 'playing' && t.turn === mySeat && (p.turn !== mySeat || p.status !== 'playing') && t.phase === 'roll') playTurn()
  }, [t, mySeat])

  useEffect(() => { if (dice || t?.phase === 'roll') setRolling(false) }, [dice, t?.phase])
  useEffect(() => { setMoving(false) }, [stateKey])

  // حاجات بتحصل لوحدها
  useEffect(() => {
    if (!t || t.pending || t.status !== 'playing' || !seated || iLeft) return
    const cur = t.seats[t.turn]
    const key = stateKey
    // دوري ومفيش نقلة → الدور يعدّي، أو نقلة واحدة بس → تتعمل لوحدها
    if (myTurn && t.phase === 'move' && dice && acted.current !== key) {
      if (legal.length === 0) {
        acted.current = key
        setTimeout(() => passTurn(t).catch(() => {}), 1300)
        return
      }
      const distinct = new Set(legal.map((i) => t[`p${mySeat}`][i]))
      if (distinct.size === 1) {
        acted.current = key
        setTimeout(() => movePiece(t, legal[0], me).catch(() => {}), 700)
        return
      }
    }
    // كل اللي معايا خرجوا → أنا الكسبان
    const active = t.seats.filter((u) => !t.left?.[u])
    if (active.length === 1 && active[0] === me && acted.current !== 'claim') {
      acted.current = 'claim'
      claimWin(t, me).catch(() => {})
      return
    }
    // صاحب الدور خرج أو اتأخر → أول واحد بعده يعدّي الدور
    if (cur !== me) {
      const helper = t.seats.find((u, j) => j !== t.turn && !t.left?.[u])
      const late = now > (t.turnAt?.toMillis?.() || now) + TURN_MS + (helper === me ? 1500 : 8000)
      if ((t.left?.[cur] || late) && acted.current !== `skip-${key}`) {
        acted.current = `skip-${key}`
        passTurn(t).catch(() => {})
      }
    }
  }, [stateKey, now, dice, legal.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (t === undefined) return <main className="screen ludo-screen"><p className="l-msg">بيحمّل الترابيزة...</p></main>
  if (t === null) {
    return (
      <main className="screen ludo-screen">
        <p className="l-msg">الترابيزة دي اتقفلت 🎲</p>
        <Link to="/games" className="lbtn lbtn-orange l-msg-btn">رجوع للألعاب</Link>
      </main>
    )
  }

  const order = t.colors.map((off, seat) => ({ seat, ci: colorIdx(off) }))
  const seatOfColor = (ci) => order.find((o) => o.ci === ci)?.seat
  const used = order.map((o) => o.ci)

  // أماكن القطع
  const pieces = []
  const groups = new Map()
  t.seats.forEach((uid, seat) => {
    const off = t.colors[seat]
    t[`p${seat}`].forEach((rel, i) => {
      const [y, x] = spotOf(off, rel, i)
      const key = rel === 0 ? `h${seat}${i}` : `${y},${x}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push({ uid, seat, i, rel, y, x, off })
    })
  })
  for (const list of groups.values()) {
    const bySeat = new Map()
    for (const p of list) { if (!bySeat.has(p.seat)) bySeat.set(p.seat, []); bySeat.get(p.seat).push(p) }
    const seats = [...bySeat.values()]
    seats.forEach((ps, k) => {
      const shift = seats.length > 1 ? (k - (seats.length - 1) / 2) * 0.32 : 0
      const movable = ps.find((p) => p.seat === mySeat && legal.includes(p.i))
      pieces.push({ ...(movable || ps[0]), x: ps[0].x + shift, count: ps.length, movable: !!movable })
    })
  }

  const cur = t.seats[t.turn]
  const lastDice = t.phase === 'move' ? dice : t.last?.dice || 0
  const showRolling = rolling || (t.phase === 'move' && !dice)

  async function roll() {
    if (!myTurn || t.phase !== 'roll' || rolling) return
    setRolling(true)
    rollDice(t).catch(() => { setRolling(false); showToast('النرد ماترماش، جرب تاني') })
  }
  function pick(p) {
    if (!p.movable || moving) return
    setMoving(true)
    movePiece(t, p.i, me).catch(() => { setMoving(false); showToast('النقلة ماتمتش، جرب تاني') })
  }
  function say(text) {
    const x = text.trim()
    if (!x || !seated) return
    if (hasBadWord(x, badWords)) return showToast('فيها كلمة ممنوعة 🚫')
    setDraft(''); setTyping(false)
    sendTableChat(id, me, profile.name, x).catch(() => showToast('الرسالة ماتبعتتش'))
  }
  async function sit() {
    try { await joinTable(id, me, profile.name) } catch { showToast('الترابيزة كملت') }
  }
  async function again() {
    try {
      const nid = await createTable({ uid: me, name: profile.name, size: t.seats.length === 2 ? 2 : 4 })
      navigate(`/ludo/${nid}`)
    } catch { showToast('حصلت مشكلة') }
  }

  // الترتيب في الآخر: الكسبان، وبعده حسب القطع اللي مشيت أكتر
  const ranking = t.status === 'done'
    ? t.seats.map((uid, seat) => ({ uid, seat, score: uid === t.winner ? 1e9 : t[`p${seat}`].reduce((a, b) => a + b, 0) - (t.left?.[uid] ? 1e6 : 0) }))
      .sort((a, b) => b.score - a.score)
    : []

  const status = t.status === 'waiting' ? `مستنيين لاعبين (${ar(t.seats.length)}/${ar(t.size)})`
    : t.status === 'done' ? `🏆 ${t.winnerName} كسب`
    : myTurn ? (t.phase === 'roll' ? 'دورك! ارمي النرد' : dice ? (legal.length ? 'اختار القطعة اللي هتمشي' : 'مفيش نقلة بالرقم ده') : 'النرد بيلف...')
    : `دور ${t.names[cur]}`

  return (
    <main className="screen ludo-screen">
      <header className="l-head">
        <button type="button" className="l-ibtn" aria-label="رجوع" onClick={() => navigate('/games')}><Back /></button>
        <div className="l-title">لودو كيمت<small>ترابيزة {t.hostName}{t.roomName ? ` · ${t.roomName}` : ''}</small></div>
        {seated && t.status !== 'done' && !iLeft
          ? <button type="button" className="l-ibtn l-exit" onClick={() => setConfirmLeave(true)}>خروج</button>
          : <span className="l-ibtn l-ghost" />}
      </header>

      <div className="l-players" dir="ltr">
        <PlayerCard t={t} seat={seatOfColor(0)} me={me} />
        <PlayerCard t={t} seat={seatOfColor(1)} me={me} />
      </div>

      <div className="l-board-wrap">
        <div className="l-board">
          <BoardBase used={used} />
          <div className="l-pieces">
            {pieces.map((p) => (
              <span key={`${p.seat}-${p.i}`} className="l-spot" style={{ top: `${(p.y / 15) * 100}%`, left: `${(p.x / 15) * 100}%`, zIndex: p.movable ? 5 : 2 }}>
                <Pin uid={p.uid} name={t.names[p.uid]} off={p.off} glow={p.movable} badge={p.count}
                  className={p.movable ? 'l-piece-go' : ''} onClick={p.movable ? () => pick(p) : undefined} />
              </span>
            ))}
          </div>
          {t.status === 'waiting' && (
            <div className="l-wait">
              <b>⏳ مستنيين لاعبين</b>
              <span>{ar(t.seats.length)} من {ar(t.size)} قاعدين</span>
              {!seated && <button type="button" className="lbtn lbtn-orange" onClick={sit}>اقعد والعب</button>}
              {t.host === me && t.seats.length >= 2 && t.size === 4 && (
                <button type="button" className="lbtn lbtn-green" onClick={() => startNow(t).catch(() => showToast('حصلت مشكلة'))}>ابدأ بالموجودين ({ar(t.seats.length)})</button>
              )}
              {t.host === me && <small>ابعت لصحابك الترابيزة من الغرفة أو الخاص، أو استنى حد يقعد من «ترابيزات مفتوحة».</small>}
            </div>
          )}
        </div>
      </div>

      <div className="l-players" dir="ltr">
        <PlayerCard t={t} seat={seatOfColor(3)} me={me} />
        <PlayerCard t={t} seat={seatOfColor(2)} me={me} />
      </div>

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
            <small>{t.status === 'playing' && myTurn && t.phase === 'roll' ? 'الـ٦ بتطلّعك من البيت وبتلعب تاني' : t.status === 'playing' && !myTurn && seated ? 'استنى دورك' : !seated ? 'انت بتتفرّج' : ''}</small>
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
            {['😂', '🔥', '😢', '👏'].map((e) => <button key={e} type="button" onClick={() => say(e)}>{e}</button>)}
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
            <p>{t[`p${t.seats.indexOf(t.winner)}`]?.every((p) => p === 57) ? 'وصّل الأربع قطع للبيت الأول' : 'الباقيين خرجوا من اللعبة'}</p>
            <div className="l-pods">
              {ranking.map((r, k) => (
                <div key={r.uid} className="l-pod">
                  <span>{['🥇', '🥈', '🥉', '٤'][k]}</span>
                  <Pin uid={r.uid} name={t.names[r.uid]} off={t.colors[r.seat]} tail={false} />
                  {t.names[r.uid]}
                  <span className="l-pts">{k === 0 ? '+١ مكسب' : t.left?.[r.uid] ? 'خرج' : ''}</span>
                </div>
              ))}
            </div>
            <button type="button" className="lbtn lbtn-green l-again" onClick={again}>نلعب تاني؟</button>
            <button type="button" className="l-link" onClick={() => { if (t.host === me) closeTable(id).catch(() => {}); navigate('/games') }}>رجوع للألعاب</button>
          </div>
        </div>
      )}

      {confirmLeave && (
        <Sheet onClose={() => setConfirmLeave(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">تخرج من اللعبة؟</h2>
          <p className="sheet-sub">{t.status === 'waiting' && t.host === me ? 'الترابيزة هتتقفل لكل اللي قاعدين.' : 'مش هتقدر ترجع للعبة دي تاني، ودورك هيعدّي لوحده.'}</p>
          <button type="button" className="btn-primary danger-bg" onClick={() => { setConfirmLeave(false); leaveTable(t, me).then(() => navigate('/games')).catch(() => showToast('حصلت مشكلة')) }}>أيوه، اخرج</button>
          <button type="button" className="btn-outline" style={{ marginTop: 8 }} onClick={() => setConfirmLeave(false)}>لا، كمّل</button>
        </Sheet>
      )}
      {toast}
    </main>
  )
}
