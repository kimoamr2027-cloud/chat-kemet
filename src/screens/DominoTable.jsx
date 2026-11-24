// ترابيزة الدومينو
import { ShareWinButton } from '../components/ShareWin.jsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Back } from '../components/Icons.jsx'
import { Sheet, useToast } from '../components/ui.jsx'
import { PotLine } from '../components/Coins.jsx'
import { Pin } from '../components/LudoBits.jsx'
import { useAuth } from '../auth.jsx'
import { localActor, replayLocal } from '../localGames.js'
import { useNow } from '../presence.js'
import { ar } from '../utils.js'
import { hasBadWord, useFilter } from '../filter.js'
import { logDiag } from '../diag.js'
import { playStep, playWin, playTurn, soundOn } from '../sound.js'
import { useTable, useTableChat, sendTableChat, leaveTable, claimWin, closeTable, colorsFor } from '../ludo.js'
import { DOMINO_TURN_MS as TURN_MS } from '../dominoShared.js'
import {
  useHand, getHands, joinDomino, startNowDomino, deal, playTile, drawTile, passDomino, reveal, claimBlocked,
  sidesFor, lo, hi, createDomino,
} from '../domino.js'

const KIND = 'domino'
const DOTS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
const Half = ({ n }) => <span className="dm-half">{Array.from({ length: 9 }, (_, i) => <i key={i} className={DOTS[n].includes(i) ? 'on' : ''} />)}</span>

// الحتة: a فوق/شمال و b تحت/يمين
export function Tile({ a, b, vertical, small, className = '', onClick, glow, back }) {
  return (
    <span className={`dm-tile ${vertical ? 'dm-v' : 'dm-h'} ${small ? 'dm-sm' : ''} ${glow ? 'dm-glow' : ''} ${back ? 'dm-back' : ''} ${className}`}
      onClick={onClick} role={onClick ? 'button' : undefined}>
      {back ? null : <><Half n={a} /><span className="dm-line" /><Half n={b} /></>}
    </span>
  )
}

// رسم السلسلة زي القهوة: أول حتة في النص، والصف ماشي بالطول (فوق وتحت)،
// ولما يوصل لآخر الترابيزة بيلف لجنب. lead = مكان أول حتة في السلسلة
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
function layoutChain(chain, lead, W, H, u) {
  const out = []
  const lim = { x: W / 2 - 4, y: H / 2 - 4 }
  // كل دراع: الحتت من الأول للآخر بعيد عن النص، وترتيب اللفّات بتاعه
  const place = (items, turns, first) => {
    let dir = turns[0], ti = 0
    let pos = first.pos, half = first.half
    for (const it of items) {
      const dbl = lo(it.o) === hi(it.o)
      for (let k = 0; k < 2; k++) {
        const [dx, dy] = DIRS[dir]
        const len = dbl ? u : 2 * u, wid = dbl ? 2 * u : u
        const endX = pos[0] + dx * len, endY = pos[1] + dy * len
        const fits = Math.abs(endX) <= lim.x && Math.abs(endY) <= lim.y
        if (fits || ti >= turns.length - 1 || k) {
          // الحتة بتتحط من pos في اتجاه dir
          const cx = pos[0] + dx * len / 2, cy = pos[1] + dy * len / 2
          const vert = dy !== 0
          const w = vert ? wid : len, h = vert ? len : wid
          // الوش اللي ناحية النص أو اللي قبله
          const near = it.fromCenterIsLo ? lo(it.o) : hi(it.o), far = it.fromCenterIsLo ? hi(it.o) : lo(it.o)
          let a, bb
          if (dbl) { a = near; bb = near } else if (dx > 0 || dy > 0) { a = near; bb = far } else { a = far; bb = near }
          out.push({ idx: it.idx, x: cx - w / 2, y: cy - h / 2, w, h, a, b: bb, vertical: dbl ? !vert : vert })
          pos = [endX, endY]; half = wid / 2
          break
        }
        // لفّة: الحتة الجاية بتقعد جنب آخر حتة
        const nd = turns[++ti]
        const [ndx, ndy] = DIRS[nd]
        pos = [pos[0] - dx * (u / 2) + ndx * half, pos[1] - dy * (u / 2) + ndy * half]
        dir = nd
      }
    }
  }
  const L = Math.min(Math.max(0, lead || 0), chain.length - 1)
  const o0 = chain[L]
  const d0 = lo(o0) === hi(o0)
  // أول حتة: بالطول في النص (والدبل بالعرض)
  const w0 = d0 ? 2 * u : u, h0 = d0 ? u : 2 * u
  out.push({ idx: L, x: -w0 / 2, y: -h0 / 2, w: w0, h: h0, a: lo(o0), b: hi(o0), vertical: !d0 })
  const down = [], up = []
  for (let i = L + 1; i < chain.length; i++) down.push({ o: chain[i], idx: i, fromCenterIsLo: true })
  for (let i = L - 1; i >= 0; i--) up.push({ o: chain[i], idx: i, fromCenterIsLo: false })
  place(down, ['down', 'right', 'up', 'right'], { pos: [0, h0 / 2], half: w0 / 2 })
  place(up, ['up', 'left', 'down', 'left'], { pos: [0, -h0 / 2], half: w0 / 2 })
  return out
}

function Chain({ chain, last, lead }) {
  const box = useRef(null)
  const [size, setSize] = useState({ w: 330, h: 300 })
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 330, h: el.clientHeight || 300 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // أكبر حجم للحتت يخلي السلسلة كلها جوه الترابيزة
  const { tiles, u } = useMemo(() => {
    if (!chain.length) return { tiles: [], u: 20 }
    let best = null
    for (let u = 22; u >= 9; u--) {
      const ts = layoutChain(chain, lead ?? Math.floor(chain.length / 2), size.w, size.h, u)
      best = { tiles: ts, u }
      const fit = ts.every((t) => t.x >= -size.w / 2 && t.y >= -size.h / 2 && t.x + t.w <= size.w / 2 && t.y + t.h <= size.h / 2)
      if (fit) break
    }
    return best
  }, [chain, lead, size.w, size.h])
  return (
    <div className="dm-col" ref={box} style={{ '--u': `${u}px` }}>
      {!chain.length && <div className="dm-empty">الترابيزة فاضية — أول حتة بتتحط هنا</div>}
      {tiles.map((p) => {
        const o = chain[p.idx]
        const isLast = last?.kind === 'play' && last.o === o
        const endCls = p.idx === 0 ? 'dm-endL' : p.idx === chain.length - 1 ? 'dm-endR' : ''
        return (
          <span key={p.idx} className="dm-at" style={{ left: `calc(50% + ${p.x}px)`, top: `calc(50% + ${p.y}px)` }}>
            <Tile a={p.a} b={p.b} vertical={p.vertical} className={`dm-cu ${isLast ? 'dm-new' : ''} ${endCls}`} />
          </span>
        )
      })}
    </div>
  )
}

// كومة السحب: حتت مقلوبة على جنب الترابيزة، ودوس عليها تسحب لما مايبقاش معاك حتة راكبة
function Stock({ n, can, onDraw }) {
  if (n <= 0) return null
  return (
    <button type="button" className={`dm-stock ${can ? 'dm-stock-on' : ''}`} onClick={can ? onDraw : undefined} aria-label="السحب">
      <span className="dm-stock-pile">
        {Array.from({ length: Math.min(n, 7) }, (_, i) => <Tile key={i} back className="dm-cu" vertical />)}
      </span>
      <small>السحب {ar(n)}</small>
    </button>
  )
}

function Opp({ t, seat, me, now }) {
  const uid = t.seats[seat]
  const turn = t.status === 'playing' && t.turn === seat
  const left = t.left?.[uid]
  const sec = Math.max(0, Math.ceil(((t.turnAt?.toMillis?.() || now) + TURN_MS - now) / 1000))
  const cnt = t[`c${seat}`] ?? 0
  return (
    <div className={`lpc dm-opp ${turn ? 'lpc-turn' : ''} ${left ? 'lpc-left' : ''}`}>
      <Pin uid={uid} name={t.names[uid]} off={colorsFor(4)[seat]} tail={false} />
      <div className="lpc-b">
        <b>{t.winner === uid ? '👑 ' : ''}{t.names[uid]}{uid === me ? ' (انت)' : ''}</b>
        <small>{left ? 'خرج' : turn ? <>دوره · <span className="lpc-timer">{ar(Math.min(30, sec))} ث</span></> : `معاه ${ar(cnt)} ${cnt === 1 ? 'حتة' : 'حتت'}`}</small>
      </div>
    </div>
  )
}

export default function DominoTable() {
  const { id } = useParams()
  const { user, profile, roles } = useAuth()
  const admin = (roles.admins || []).includes(user.uid)
  const t = useTable(id, KIND)
  const chat = useTableChat(id, KIND)
  const navigate = useNavigate()
  const now = useNow(1000)
  const [toast, showToast] = useToast()
  const [pick, setPick] = useState(null)
  // على نفس الموبايل: كل واحد يكشف ورقه في دوره بس
  const [shownFor, setShownFor] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [allHands, setAllHands] = useState(null)
  const badWords = useFilter()
  const acted = useRef('')

  // على نفس الموبايل: الشاشة بتبقى بتاعة صاحب الدور
  const me = localActor(t, user.uid)
  const mySeat = t ? t.seats.indexOf(me) : -1
  const seated = mySeat >= 0
  const iLeft = !!t?.left?.[me]
  const hand = useHand(id, me, seated && !!t && t.status !== 'waiting')
  const myTurn = !!t && t.status === 'playing' && t.turn === mySeat && !iLeft
  const playable = useMemo(() => (myTurn && hand ? hand.tiles.filter((x) => sidesFor(x, t.chain).length) : []), [myTurn, hand, t?.chain])
  const canDraw = myTurn && t.size < 4 && t.next < 28 && playable.length === 0
  const mustPass = myTurn && playable.length === 0 && !canDraw && !!hand
  const key = t ? `${t.status}-${t.turn}-${t.chain?.length}-${t.passes}-${t.next}-${t.pending}` : ''

  // أصوات
  const prev = useRef(null)
  useEffect(() => {
    if (!t || t.pending) return
    const p = prev.current
    prev.current = t
    if (!p || !soundOn('sound')) return
    if (t.status === 'done' && p.status !== 'done') return playWin()
    if ((t.chain?.length || 0) > (p.chain?.length || 0)) playStep()
    if (t.status === 'playing' && t.turn === mySeat && (p.turn !== mySeat || p.status !== 'playing')) playTurn()
  }, [t, mySeat])

  // حاجات بتحصل لوحدها
  useEffect(() => {
    if (!t || t.pending || !seated || iLeft) return
    // صاحب الترابيزة بيوزّع
    if (t.status === 'deal' && t.host === me && acted.current !== 'deal') {
      acted.current = 'deal'
      deal(t).catch((e) => { acted.current = ''; logDiag('domino.deal', e) })
      return
    }
    // اتقفلت: كل واحد يكشف نقطه، والأقل يكسب
    if (t.status === 'blocked') {
      if (!(`r${mySeat}` in t) && hand && acted.current !== `rev-${key}`) {
        acted.current = `rev-${key}`
        reveal(t, mySeat, hand.sum).catch((e) => logDiag('domino.reveal', e))
        return
      }
      const mine = t[`r${mySeat}`]
      if (mine === undefined) return
      const waitOver = now > (t.blockedAt?.toMillis?.() || now) + 31000
      const iWin = t.seats.every((u, j) => j === mySeat
        || (t[`r${j}`] === undefined ? (waitOver || t.left?.[u]) : (t[`r${j}`] > mine || (t[`r${j}`] === mine && j > mySeat))))
      if (iWin && acted.current !== 'claimB') {
        acted.current = 'claimB'
        claimBlocked(t, me, mySeat).catch((e) => { acted.current = ''; logDiag('domino.claimBlocked', e) })
      }
      return
    }
    if (t.status !== 'playing') return
    // مفيش لعب ولا سحب: الدور يعدّي
    if (mustPass && acted.current !== `pass-${key}`) {
      acted.current = `pass-${key}`
      setTimeout(() => passDomino(t).catch((e) => logDiag('domino.pass', e)), 1300)
      return
    }
    const active = t.seats.filter((u) => !t.left?.[u])
    if (active.length === 1 && active[0] === me && acted.current !== 'claim') {
      acted.current = 'claim'
      claimWin(t, me).catch((e) => logDiag('domino.claim', e))
      return
    }
    const cur = t.seats[t.turn]
    if (cur !== me) {
      const helper = t.seats.find((u, j) => j !== t.turn && !t.left?.[u])
      const late = now > (t.turnAt?.toMillis?.() || now) + TURN_MS + (helper === me ? 1500 : 8000)
      if ((t.left?.[cur] || late) && acted.current !== `skip-${key}`) {
        acted.current = `skip-${key}`
        passDomino(t).catch((e) => logDiag('domino.skip', e))
      }
    }
  }, [key, now, hand, mustPass]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPick(null) }, [key])
  useEffect(() => { if (t?.status === 'done') getHands(t).then(setAllHands) }, [t?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (t === undefined) return <main className="screen ludo-screen"><p className="l-msg">بيحمّل الترابيزة...</p></main>
  if (t === null || t.status === 'cancelled') {
    return (
      <main className="screen ludo-screen">
        <p className="l-msg">الترابيزة دي اتقفلت 🁫</p>
        <Link to="/games" className="lbtn lbtn-orange l-msg-btn">رجوع للألعاب</Link>
      </main>
    )
  }

  async function play(x, side) {
    if (busy) return
    setBusy(true); setPick(null)
    try { await playTile(t, me, hand, x, side) } catch (e) { logDiag('domino.play', e, { x, side, chain: t.chain?.length }); showToast('الحتة مااتلعبتش، جرب تاني') }
    setBusy(false)
  }
  function tapTile(x) {
    if (!myTurn || busy) return
    const sides = sidesFor(x, t.chain)
    if (!sides.length) return showToast('الحتة دي مش راكبة على أي طرف')
    if (sides.length === 1) return play(x, sides[0])
    setPick(x)
  }
  async function draw() {
    if (busy) return
    setBusy(true)
    try { await drawTile(t, me, hand) } catch (e) { logDiag('domino.draw', e); showToast('مقدرناش نسحب، جرب تاني') }
    setBusy(false)
  }
  function say(text) {
    const x = text.trim()
    if (!x || !seated) return
    if (hasBadWord(x, badWords)) return showToast('فيها كلمة ممنوعة 🚫')
    setDraft(''); setTyping(false)
    sendTableChat(id, me, profile.name, x, KIND).catch(() => showToast('الرسالة ماتبعتتش'))
  }
  async function sit() {
    try { await joinDomino(id, me, profile.name, admin) } catch (e) { logDiag('domino.join', e); showToast(e?.message === 'coins' ? 'رصيدك مش كفاية للدخولية دي 🪙' : 'الترابيزة كملت') }
  }
  async function again() {
    if (t.local) return navigate(`/domino/${replayLocal(t)}`)
    try { const nid = await createDomino({ uid: me, name: profile.name, size: t.seats.length === 2 ? 2 : 4 , fee: t.fee || 0, admin }); navigate(`/domino/${nid}`) } catch (e) { showToast(e?.message === 'coins' ? 'رصيدك مش كفاية للدخولية دي 🪙' : 'حصلت مشكلة') }
  }

  const others = t.seats.map((_, j) => j).filter((j) => j !== mySeat)
  const e = t.chain?.length ? [lo(t.chain[0]), hi(t.chain[t.chain.length - 1])] : null
  const cur = t.seats[t.turn]
  const status = t.status === 'waiting' ? `مستنيين لاعبين (${ar(t.seats.length)}/${ar(t.size)})`
    : t.status === 'deal' ? 'بيتوزّع الورق...'
    : t.status === 'blocked' ? '🔒 اللعبة اتقفلت! بنعدّ النقط...'
    : t.status === 'done' ? `🏆 ${t.winnerName} كسب`
    : myTurn ? (playable.length ? 'دورك! دوس على حتة' : canDraw ? 'مفيش حتة راكبة، اسحب' : 'مفيش لعب، الدور بيعدّي')
    : `دور ${t.names[cur]}`
  const ranking = t.status === 'done'
    ? t.seats.map((uid, seat) => ({ uid, seat, sum: allHands?.[uid]?.sum ?? t[`r${seat}`] ?? null, tiles: allHands?.[uid]?.tiles || [] }))
      .sort((a, b) => (a.uid === t.winner ? -1 : b.uid === t.winner ? 1 : (a.sum ?? 999) - (b.sum ?? 999)))
    : []

  return (
    <main className="screen ludo-screen dm-screen">
      <header className="l-head">
        <button type="button" className="l-ibtn" aria-label="رجوع" onClick={() => navigate('/games')}><Back /></button>
        <div className="l-title">دومينو<small>ترابيزة {t.hostName}{t.roomName ? ` · ${t.roomName}` : ''}</small></div>
        {seated && t.status !== 'done' && !iLeft
          ? <button type="button" className="l-ibtn l-exit" onClick={() => setConfirmLeave(true)}>خروج</button>
          : <span className="l-ibtn l-ghost" />}
      </header>

      <div className="dm-opps">
        {(seated ? others : t.seats.map((_, j) => j)).map((j) => <Opp key={j} t={t} seat={j} me={me} now={now} />)}
      </div>

      <div className="dm-table">
        <Chain chain={t.chain || []} last={t.last} lead={t.lead} />
        {(e || t.status === 'playing') && (
          <div className="dm-ends">
            <span>{e && <><i className="dm-dot dm-dotL" /> طرف <b>{ar(e[0])}</b></>}</span>
            {t.status === 'playing' && t.size < 4 && <Stock n={Math.max(0, 28 - (t.next || 28))} can={canDraw && !busy} onDraw={draw} />}
            <span>{e && <><i className="dm-dot dm-dotR" /> طرف <b>{ar(e[1])}</b></>}</span>
          </div>
        )}
        {(t.status === 'waiting' || t.status === 'deal') && (
          <div className="l-wait dm-wait">
            <b>{t.status === 'deal' ? '🁫 بيتوزّع الورق...' : '⏳ مستنيين لاعبين'}</b>
            <span>{ar(t.seats.length)} من {ar(t.size)} قاعدين</span>
            {t.status === 'deal' && t.host !== me && <small>صاحب الترابيزة بيوزّع دلوقتي</small>}
            {t.status === 'waiting' && !seated && <button type="button" className="lbtn lbtn-orange" onClick={sit}>اقعد والعب</button>}
            {t.status === 'waiting' && t.host === me && t.seats.length >= 2 && t.size === 4 && (
              <button type="button" className="lbtn lbtn-green" onClick={() => startNowDomino(t).catch((er) => { logDiag('domino.start', er); showToast('حصلت مشكلة') })}>ابدأ بالموجودين ({ar(t.seats.length)})</button>
            )}
          </div>
        )}
        {t.status === 'blocked' && <div className="sn-flash">🔒 اللعبة اتقفلت! أقل مجموع نقط هو اللي يكسب...</div>}
      </div>

      <div className="l-bottom dm-bottom">
        <div className="l-bubbles">
          {chat.slice(-2).map((m) => (
            <div key={m.id} className={`l-bb ${m.uid === me ? 'me' : ''}`}><b>{m.uid === me ? 'انت' : m.name}</b>{m.text}</div>
          ))}
        </div>
        <div className={`dm-status ${myTurn ? 'dm-myturn' : ''}`}>{status}</div>
        {t.local && Object.keys(t.humans || {}).length > 1 && t.status === 'playing' && shownFor !== me ? (
          <div className="dm-handoff">
            <b>📱 دور {t.names[me]}</b>
            <span>سلّم الموبايل لـ {t.names[me]} من غير ما حد يبص 😉</span>
            <button type="button" className="lbtn lbtn-green" onClick={() => setShownFor(me)}>أنا {t.names[me]} — اكشف ورقي</button>
          </div>
        ) : seated && hand && t.status !== 'done' && (
          <div className="dm-hand">
            {hand.tiles.map((x) => {
              const ok = playable.includes(x)
              return <Tile key={x} a={lo(x)} b={hi(x)} vertical glow={ok} className={`${!myTurn || ok ? '' : 'dm-dim'} ${pick === x ? 'dm-picked' : ''}`} onClick={() => tapTile(x)} />
            })}
          </div>
        )}
        {pick !== null && (
          <div className="dm-pick">
            <span>تحطها على أنهي طرف؟</span>
            <button type="button" className="lbtn lbtn-sm dm-btnL" onClick={() => play(pick, 'L')}>🔵 طرف {ar(e?.[0])}</button>
            <button type="button" className="lbtn lbtn-sm dm-btnR" onClick={() => play(pick, 'R')}>🟠 طرف {ar(e?.[1])}</button>
          </div>
        )}
        {canDraw && <button type="button" className="lbtn lbtn-orange dm-draw" disabled={busy} onClick={draw}>🁢 اسحب حتة</button>}
        {seated && !t.local && (typing ? (
          <form className="l-type" onSubmit={(ev) => { ev.preventDefault(); say(draft) }}>
            <input className="l-input" autoFocus maxLength={120} value={draft} onChange={(ev) => setDraft(ev.target.value)} placeholder="اكتب رسالة..." />
            <button type="submit" className="lbtn lbtn-orange lbtn-sm">ابعت</button>
            <button type="button" className="l-ibtn" onClick={() => setTyping(false)}>✕</button>
          </form>
        ) : (
          <div className="l-quick">
            {['😂', '🔥', '😢', '👏'].map((em) => <button key={em} type="button" onClick={() => say(em)}>{em}</button>)}
            <button type="button" className="l-msgbtn" onClick={() => setTyping(true)}>اكتب رسالة...</button>
          </div>
        ))}
      </div>

      {t.status === 'done' && (
        <div className="l-win-scrim">
          <div className="l-win">
            <div className="l-ribbon">🎉 {t.winner === me ? 'مبروك!' : 'اللعبة خلصت'} 🎉</div>
            <Pin uid={t.winner} name={t.winnerName} off={colorsFor(4)[t.seats.indexOf(t.winner)]} className="l-winner" />
            <h2>👑 {t.winner === me ? 'انت كسبت!' : `${t.winnerName} كسب!`}</h2>
            {t.winner === me && <ShareWinButton game="دومينو" detail={t.fee ? `ترابيزة بـ ${t.fee} كوين` : ''} />}
            <PotLine t={t} />
            <p>{t.winnerSeat !== undefined ? 'الترابيزة اتقفلت وكان معاه أقل نقط' : t[`c${t.seats.indexOf(t.winner)}`] === 0 ? 'خلّص ورقه الأول' : 'الباقيين خرجوا من اللعبة'}</p>
            <div className="l-pods">
              {ranking.map((r, k) => (
                <div key={r.uid} className="l-pod dm-pod">
                  <span>{['🥇', '🥈', '🥉', '٤'][k]}</span>
                  <Pin uid={r.uid} name={t.names[r.uid]} off={colorsFor(4)[r.seat]} tail={false} />
                  <span className="dm-pod-b">{t.names[r.uid]}
                    <span className="dm-pod-tiles">{r.tiles.map((x) => <Tile key={x} a={lo(x)} b={hi(x)} vertical small />)}</span>
                  </span>
                  <span className="l-pts">{k === 0 ? (t.local ? '🏆' : '+١ مكسب') : t.left?.[r.uid] ? 'خرج' : r.sum !== null ? `${ar(r.sum)} نقطة` : ''}</span>
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
          <button type="button" className="btn-primary danger-bg" onClick={() => { setConfirmLeave(false); leaveTable(t, me, admin).then(() => navigate('/games')).catch((er) => { logDiag('domino.leave', er); showToast('حصلت مشكلة') }) }}>أيوه، اخرج</button>
          <button type="button" className="btn-outline" style={{ marginTop: 8 }} onClick={() => setConfirmLeave(false)}>لا، كمّل</button>
        </Sheet>
      )}
      {toast}
    </main>
  )
}

