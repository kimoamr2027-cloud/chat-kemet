// ألعاب على الموبايل نفسه (من غير سيرفر): ضد الكمبيوتر 🤖 أو أكتر من واحد على نفس الموبايل 👥
// نفس قواعد السيرفر بالظبط، وبتطلّع الترابيزة بنفس الشكل علشان نفس الشاشات تشتغل
// للتسلية والتمرين: من غير دخولية ولا كوينز ولا ترتيب
import { useEffect, useState } from 'react'
import { colorsFor, nextSeat, canMove, legalPieces, absOf, SAFE, LUCK_BONUS, LUCK_SKULL, snTo } from './ludoShared.js'
import { ALL, lo, hi, pips, sidesFor, orient } from './dominoShared.js'

export const isLocal = (id) => typeof id === 'string' && id.startsWith('local-')
export const isLocalUid = (uid) => typeof uid === 'string' && (uid.startsWith('bot-') || uid.startsWith('guest-'))
export const LEVELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' }
export const BOTS = [
  { uid: 'bot-ra', name: 'رع 🤖' },
  { uid: 'bot-horus', name: 'حورس 🤖' },
  { uid: 'bot-anubis', name: 'أنوبيس 🤖' },
]
const KEY = 'kemet-local-game'
const stamp = (ms) => (ms ? { toMillis: () => ms, toDate: () => new Date(ms) } : null)
const rand = (n) => Math.floor(Math.random() * n)

// ===== التخزين (لعبة واحدة شغالة، ومتحفظة لو الصفحة اتقفلت) =====
let G = null // { t, hands, deck }
const subs = new Set()
function load(id) {
  if (G?.t.id === id) return G
  try { const x = JSON.parse(localStorage.getItem(KEY)); if (x?.t?.id === id) G = x } catch {}
  return G?.t.id === id ? G : null
}
function view(t) {
  return {
    ...t, createdAt: stamp(t.created), turnAt: stamp(t.turnAtMs), blockedAt: stamp(t.blockedAtMs), finishedAt: stamp(t.finishedAtMs),
    rolledAt: t.rollN ? { seconds: t.rollN, nanoseconds: 0 } : null, pending: false,
  }
}
function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(G)) } catch {}
  subs.forEach((f) => f())
  schedule()
}

export function useLocalTable(id) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!id) return
    const f = () => tick((x) => x + 1)
    subs.add(f)
    schedule()
    return () => { subs.delete(f) }
  }, [id])
  if (!id) return undefined
  const g = load(id)
  return g ? view(g.t) : null
}
export function useLocalHand(id, uid) {
  useLocalTable(id)
  const g = id ? load(id) : null
  return g?.hands?.[uid] || null
}
export const localHands = (t) => Promise.resolve({ ...(load(t.id)?.hands || {}) })

// مين اللي بيلعب دلوقتي على الموبايل ده (في "على نفس الموبايل" بنسلّم الدور)
export function localActor(t, me) {
  if (!t?.local) return me
  const cur = t.seats[t.turn]
  return t.humans?.[cur] ? cur : me
}

// ===== لعبة جديدة =====
// players: [{ uid, name, bot?: level }]
export function createLocal({ kind, mode = 'classic', players, host }) {
  const n = players.length
  const t = {
    id: 'local-' + Date.now().toString(36), kind, local: true, host, status: 'playing', created: Date.now(),
    seats: players.map((p) => p.uid), names: Object.fromEntries(players.map((p) => [p.uid, p.name])),
    bots: Object.fromEntries(players.filter((p) => p.bot).map((p) => [p.uid, p.bot])),
    humans: Object.fromEntries(players.filter((p) => !p.bot).map((p) => [p.uid, true])),
    left: {}, refunded: {}, paid: {}, size: n, turn: 0, turnAtMs: Date.now(),
  }
  const g = { t, hands: {}, deck: [] }
  if (kind === 'domino') {
    const deck = [...ALL]
    for (let i = deck.length - 1; i > 0; i--) { const j = rand(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]] }
    let first = 0
    let best = -1
    t.seats.forEach((u, k) => {
      const tiles = deck.slice(k * 7, k * 7 + 7)
      tiles.forEach((x) => { if (lo(x) === hi(x) && lo(x) > best) { best = lo(x); first = k } })
      g.hands[u] = { tiles, sum: tiles.reduce((s, x) => s + pips(x), 0) }
      t[`c${k}`] = 7
    })
    g.deck = deck.slice(n * 7)
    Object.assign(t, { turn: first, chain: [], passes: 0, next: n * 7 })
  } else {
    t.colors = colorsFor(n)
    t.phase = 'roll'
    t.rollN = 0
    if (kind === 'ludo' && mode !== 'classic') t.mode = mode
    t.seats.forEach((_, k) => { t[`p${k}`] = kind === 'snakes' ? 0 : mode === 'quick' ? [0, 0, 57, 57] : [0, 0, 0, 0] })
  }
  G = g
  commit()
  return t.id
}

// ===== الحركات (نفس السيرفر) =====
const ok = () => Promise.resolve({ ok: true })
const fail = (m) => Promise.reject(new Error(m))
function get(id) { const g = load(id); if (!g) throw new Error('gone'); return g }
function turnOf(g, uid) {
  const t = g.t
  if (t.status !== 'playing') throw new Error('not playing')
  const s = t.seats.indexOf(uid)
  if (s < 0 || t.turn !== s) throw new Error('not your turn')
  return s
}
function finish(g, uid) {
  const t = g.t
  Object.assign(t, { status: 'done', winner: uid, winnerName: t.names[uid], finishedAtMs: Date.now() })
}

function ludoMove(t, piece, d) {
  const me = t.turn
  const off = t.colors[me]
  const mine = [...t[`p${me}`]]
  const from = mine[piece]
  const to = from === 0 ? 1 : from + d
  const luck = t.mode === 'luck' && to >= 1 && to <= 51
  const skull = luck && LUCK_SKULL.includes(absOf(to, off))
  const bonus = luck && LUCK_BONUS.includes(absOf(to, off))
  mine[piece] = skull ? 0 : to
  t[`p${me}`] = mine
  let hit = false
  if (to <= 51 && !skull) {
    const a = absOf(to, off)
    if (!SAFE.includes(a)) {
      t.seats.forEach((_, j) => {
        if (j === me) return
        const on = (p) => p >= 1 && p <= 51 && absOf(p, t.colors[j]) === a
        if (t[`p${j}`].some(on)) { t[`p${j}`] = t[`p${j}`].map((p) => (on(p) ? 0 : p)); hit = true }
      })
    }
  }
  const done = mine.every((p) => p === 57)
  t.last = { seat: me, piece, from, to, dice: d }
  t.phase = 'roll'; t.turnAtMs = Date.now(); t.turn = d === 6 || to === 57 || hit || bonus || done ? me : nextSeat(t, me)
  return { done, hit, to, skull, bonus }
}

function act(id, uid, fn) {
  try { const g = get(id); const out = fn(g, uid); commit(); return Promise.resolve(out || { ok: true }) } catch (e) { return fail(e.message) }
}
export const localRoll = (t, uid) => act(t.id, uid, (g) => {
  turnOf(g, uid)
  if (g.t.phase !== 'roll') throw new Error('not roll')
  g.t.dice = rand(6) + 1; g.t.rollN = (g.t.rollN || 0) + 1; g.t.phase = 'move'
})
export const localMove = (t, uid, piece) => act(t.id, uid, (g) => {
  const s = turnOf(g, uid)
  const x = g.t
  if (x.phase !== 'move') throw new Error('roll first')
  if (x.kind === 'ludo') {
    if (!canMove(x[`p${s}`][piece], x.dice)) throw new Error('illegal')
    if (ludoMove(x, piece, x.dice).done) finish(g, uid)
    return
  }
  const from = x[`p${s}`]
  const to = snTo(from, x.dice)
  x[`p${s}`] = to
  x.last = { seat: s, from, to, dice: x.dice }
  x.phase = 'roll'; x.turnAtMs = Date.now(); x.turn = to === 100 || x.dice === 6 ? s : nextSeat(x, s)
  if (to === 100) finish(g, uid)
})
export const localPass = (t, uid) => act(t.id, uid, (g) => {
  const x = g.t
  if (x.status !== 'playing') return
  x.turnAtMs = Date.now()
  if (x.kind === 'domino') {
    x.passes = (x.passes || 0) + 1
    x.last = { seat: x.turn, kind: 'pass', at: Date.now() }
    if (x.passes >= x.seats.length) {
      // اتقفلت: الأقل نقط يكسب
      let win = 0
      let best = 1e9
      x.seats.forEach((u, j) => { const sum = g.hands[u].sum; x[`r${j}`] = sum; if (sum < best) { best = sum; win = j } })
      x.blockedAtMs = Date.now(); x.winnerSeat = win
      return finish(g, x.seats[win])
    }
    x.turn = nextSeat(x, x.turn)
    return
  }
  x.turn = nextSeat(x, x.turn); x.phase = 'roll'
})
export const localPlay = (t, uid, xTile, side) => act(t.id, uid, (g) => {
  const s = turnOf(g, uid)
  const x = g.t
  const h = g.hands[uid]
  if (!h.tiles.includes(xTile)) throw new Error('not yours')
  const sd = x.chain.length ? side : 'R'
  if (!sidesFor(xTile, x.chain).includes(sd)) throw new Error('no fit')
  const o = orient(xTile, x.chain, sd)
  x.chain = !x.chain.length ? [o] : sd === 'L' ? [o, ...x.chain] : [...x.chain, o]
  h.tiles = h.tiles.filter((y) => y !== xTile); h.sum -= pips(xTile)
  x[`c${s}`] -= 1; x.passes = 0; x.turnAtMs = Date.now()
  x.last = { seat: s, kind: 'play', x: xTile, o, side: sd, at: Date.now() }
  if (x[`c${s}`] === 0) return finish(g, uid)
  x.turn = nextSeat(x, s)
})
export const localDraw = (t, uid) => act(t.id, uid, (g) => {
  const s = turnOf(g, uid)
  const x = g.t
  if (x.size >= 4 || x.next >= 28) throw new Error('no draw')
  const tile = g.deck[x.next - x.seats.length * 7]
  const h = g.hands[uid]
  h.tiles = [...h.tiles, tile]; h.sum += pips(tile)
  x.next += 1; x[`c${s}`] += 1; x.last = { seat: s, kind: 'draw', at: Date.now() }; x.turnAtMs = Date.now()
  return { x: tile }
})
export const localLeave = (t) => { if (G?.t.id === t.id) { G.t.status = 'cancelled'; commit() } return ok() }
export const localClose = () => { G = null; try { localStorage.removeItem(KEY) } catch {} subs.forEach((f) => f()); return ok() }

// ===== الكمبيوتر 🤖 =====
let timer = null
function schedule() {
  clearTimeout(timer)
  const t = G?.t
  if (!t || t.status !== 'playing' || !subs.size) return
  const cur = t.seats[t.turn]
  const level = t.bots?.[cur]
  if (!level) return
  timer = setTimeout(() => botTurn(cur, level), t.kind === 'domino' ? 1100 : t.phase === 'roll' ? 900 : 750)
}

function botTurn(uid, level) {
  const t = G?.t
  if (!t || t.status !== 'playing' || t.seats[t.turn] !== uid) return
  if (t.kind === 'domino') return botDomino(uid, level)
  if (t.phase === 'roll') return localRoll(t, uid)
  if (t.kind === 'snakes') return localMove(t, uid)
  const s = t.turn
  const legal = legalPieces(t[`p${s}`], t.dice)
  if (!legal.length) return localPass(t, uid)
  return localMove(t, uid, level === 'easy' ? legal[rand(legal.length)] : bestLudo(t, s, legal, level))
}

// لودو: بيقيّم كل نقلة (يضرب، يدخّل البيت، يطلّع قطعة، يقف في أمان، ويبعد عن الخطر)
function bestLudo(t, s, legal, level) {
  let best = legal[0]
  let bestScore = -1e9
  const seen = new Set()
  for (const i of legal) {
    const from = t[`p${s}`][i]
    if (seen.has(from)) continue
    seen.add(from)
    const sim = JSON.parse(JSON.stringify(t))
    const r = ludoMove(sim, i, t.dice)
    let score = r.to / 10
    if (r.done) score += 1000
    if (r.to === 57) score += 120
    if (r.hit) score += 90
    if (from === 0) score += 60
    if (r.bonus) score += 50
    if (r.skull) score -= 150
    if (r.to >= 52 && r.to < 57) score += 35 // دخل السكة الملونة (أمان)
    const a = r.to <= 51 ? absOf(r.to, t.colors[s]) : -1
    if (a >= 0 && SAFE.includes(a)) score += 30
    if (level === 'hard') {
      // خطر: خصم ورايا بـ ١ لـ ٦ خانات يقدر يضربني
      const danger = (abs) => abs >= 0 && !SAFE.includes(abs) && t.seats.some((_, j) => j !== s && sim[`p${j}`].some((p) => p >= 1 && p <= 51 && ((abs - absOf(p, t.colors[j]) + 52) % 52) >= 1 && ((abs - absOf(p, t.colors[j]) + 52) % 52) <= 6))
      if (danger(a)) score -= 70
      const fromA = from >= 1 && from <= 51 ? absOf(from, t.colors[s]) : -1
      if (danger(fromA)) score += 45 // بيهرب من الخطر
    }
    if (level === 'medium') score += Math.random() * 25
    if (score > bestScore) { bestScore = score; best = i }
  }
  return best
}

// دومينو: سهل = أي حتة، متوسط = الأتقل الأول، صعب = الأتقل + يحافظ على الأرقام اللي معاه كتير
function botDomino(uid, level) {
  const t = G.t
  const h = G.hands[uid]
  const options = []
  for (const x of h.tiles) for (const side of sidesFor(x, t.chain)) options.push({ x, side })
  if (!options.length) {
    if (t.size < 4 && t.next < 28) return localDraw(t, uid)
    return localPass(t, uid)
  }
  let pick = options[rand(options.length)]
  if (level !== 'easy') {
    const count = {}
    for (const y of h.tiles) { count[lo(y)] = (count[lo(y)] || 0) + 1; count[hi(y)] = (count[hi(y)] || 0) + 1 }
    let best = -1e9
    for (const o of options) {
      let score = pips(o.x) * 2
      if (lo(o.x) === hi(o.x)) score += 6
      if (level === 'hard') {
        // الطرف اللي هيفضل مفتوح بعد الحتة: يا ريت يكون رقم معايا منه كتير
        const after = orient(o.x, t.chain, t.chain.length ? o.side : 'R')
        const open = !t.chain.length ? [lo(after), hi(after)] : o.side === 'L' ? [lo(after)] : [hi(after)]
        for (const v of open) score += (count[v] || 0) * 4
      } else score += Math.random() * 4
      if (score > best) { best = score; pick = o }
    }
  }
  return localPlay(t, uid, pick.x, pick.side)
}

// "نلعب تاني؟" بنفس اللاعبين والمستوى
export function replayLocal(t) {
  const players = t.seats.map((uid) => ({ uid, name: t.names[uid], bot: t.bots?.[uid] }))
  // اللي بيبدأ بيتغيّر كل مرة
  players.push(players.shift())
  return createLocal({ kind: t.kind, mode: t.mode || 'classic', players, host: t.host })
}
