// منطق الألعاب والكوينز على السيرفر (بيتحمّل بـ require جوه كل handler)
// نفس قواعد التطبيق بالظبط، بس السيرفر هو اللي بيرمي النرد ويوزّع ويحسب
const lib = require(`${__hooks}/lib.js`)

const WELCOME = 500
const FEES = [0, 100, 250, 500]
const DAILY = [100, 150, 200, 250, 300, 400, 1000]
const FREE_WIN = 50
const QUIZ_COINS = 20
const TURN_MS = 30 * 1000
const DOMINO_TURN_MS = 30 * 1000
const ROUND_MS = 45 * 1000
const GAME_AR = { ludo: "لودو", snakes: "السلم والتعبان", domino: "دومينو" }

const dayNum = () => Math.floor((Date.now() + 7200000) / 86400000)
function weekKey(ms) {
  const d = new Date(ms || Date.now())
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y = t.getUTCFullYear()
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)
  return y + "-W" + String(w).padStart(2, "0")
}
const rand = (n) => Math.floor(Math.random() * n)

// ===== الكوينز =====
function logCoins(tx, uid, amount, kind, note) {
  const r = new Record(tx.findCollectionByNameOrId("coinlog"))
  r.set("owner", uid); r.set("amount", amount); r.set("kind", kind); r.set("note", String(note || "").slice(0, 80))
  tx.save(r)
}
// المحفظة (ولو مش موجودة بتتعمل بهدية البداية)
function wallet(tx, uid) {
  try { return tx.findRecordById("wallets", uid) } catch (_) {}
  const w = new Record(tx.findCollectionByNameOrId("wallets"))
  w.set("id", uid); w.set("coins", WELCOME); w.set("day", 0); w.set("streak", 0)
  tx.save(w)
  logCoins(tx, uid, WELCOME, "welcome", "هدية الترحيب")
  return w
}
function addCoins(tx, uid, amount, kind, note) {
  const w = wallet(tx, uid)
  if (w.getInt("coins") + amount < 0) lib.fail("رصيدك مش مكفي")
  w.set("coins", w.getInt("coins") + amount)
  tx.save(w)
  logCoins(tx, uid, amount, kind, note)
  return w.getInt("coins")
}

// ===== الترابيزات =====
function load(tx, id) {
  let rec
  try { rec = tx.findRecordById("tables", String(id || "")) } catch (_) { lib.fail("الترابيزة مش موجودة") }
  const t = lib.readJSON(rec, "state") || {}
  t.id = rec.id; t.kind = rec.getString("kind"); t.status = rec.getString("status"); t.host = rec.getString("host")
  t.seats = lib.readJSON(rec, "seats") || []
  t.left = t.left || {}; t.refunded = t.refunded || {}; t.paid = t.paid || {}; t.names = t.names || {}
  return { rec, t }
}
function save(tx, rec, t) {
  const st = {}
  for (const k in t) if (["id", "kind", "status", "host", "seats"].indexOf(k) < 0) st[k] = t[k]
  rec.set("status", t.status); rec.set("host", t.host); rec.set("seats", t.seats); rec.set("state", st)
  tx.save(rec)
}
function nextSeat(t, from) {
  const n = t.seats.length
  for (let k = 1; k < n; k++) { const j = (from + k) % n; if (!t.left[t.seats[j]]) return j }
  return (from + 1) % n
}
const colorsFor = (n) => (n === 2 ? [0, 26] : n === 3 ? [0, 13, 26] : [0, 13, 26, 39])
const startPos = (kind, mode) => (kind === "snakes" ? 0 : mode === "quick" ? [0, 0, 57, 57] : [0, 0, 0, 0])
function seatOf(t, uid) { const s = t.seats.indexOf(uid); if (s < 0) lib.forbid("انت مش في الترابيزة دي"); return s }
function myTurn(t, uid) {
  if (t.status !== "playing") lib.fail("اللعبة مش شغالة")
  const s = seatOf(t, uid)
  if (t.turn !== s || t.left[uid]) lib.forbid("مش دورك")
  return s
}

// رجوع دخولية لاعب
function refund(tx, t, uid) {
  if (!t.fee || !t.paid[uid] || t.refunded[uid]) return
  t.refunded[uid] = true
  addCoins(tx, uid, t.fee, "refund", "رجوع دخولية " + GAME_AR[t.kind])
}
// الحصالة: الدخولية × اللي دفعوا ولسه فلوسهم مارجعتش
function potOf(t) {
  if (!t.fee) return FREE_WIN
  return t.fee * t.seats.filter((u) => t.paid[u] && !t.refunded[u]).length
}
// المكسب: ترتيب الأسبوع + الكوينز. لو الأدمن كسب ترابيزة بدخولية: الكل ياخد فلوسه
function finish(tx, rec, t, uid) {
  t.status = "done"; t.winner = uid; t.winnerName = t.names[uid] || ""; t.finishedAt = Date.now()
  const week = weekKey()
  let sc
  try { sc = tx.findRecordById("scores", t.kind + "_" + uid) } catch (_) {
    sc = new Record(tx.findCollectionByNameOrId("scores")); sc.set("id", t.kind + "_" + uid); sc.set("board", t.kind); sc.set("uid", uid)
  }
  sc.set("n", sc.getString("week") === week ? sc.getInt("n") + 1 : 1); sc.set("week", week); sc.set("name", t.names[uid] || "")
  tx.save(sc)
  if (lib.isAdmin(tx, uid)) {
    for (const u of t.seats) refund(tx, t, u)
  } else {
    const pot = potOf(t)
    t.won = pot
    addCoins(tx, uid, pot, "win", "كسبت " + GAME_AR[t.kind] + (t.fee ? " (ترابيزة " + t.fee + ")" : ""))
  }
  if (t.kind === "domino") {
    for (const h of tx.findRecordsByFilter("hands", "table = {:t}", "", 10, 0, { t: t.id })) { h.set("open", true); tx.save(h) }
  }
  save(tx, rec, t)
}

// ===== لودو =====
const SAFE = [0, 8, 13, 21, 26, 34, 39, 47]
const LUCK_BONUS = [3, 16, 29, 42]
const LUCK_SKULL = [6, 19, 32, 45]
const absOf = (rel, off) => (off + rel - 1) % 52
const canMove = (p, d) => (p === 0 && d === 6) || (p > 0 && p + d <= 57)
function ludoMove(t, piece, d) {
  const me = t.turn
  const off = t.colors[me]
  const mine = t["p" + me].slice()
  const from = mine[piece]
  const to = from === 0 ? 1 : from + d
  const luck = t.mode === "luck" && to >= 1 && to <= 51
  const skull = luck && LUCK_SKULL.indexOf(absOf(to, off)) >= 0
  const bonus = luck && LUCK_BONUS.indexOf(absOf(to, off)) >= 0
  mine[piece] = skull ? 0 : to
  t["p" + me] = mine
  let hit = false
  if (to <= 51 && !skull) {
    const a = absOf(to, off)
    if (SAFE.indexOf(a) < 0) {
      t.seats.forEach((_, j) => {
        if (j === me) return
        const theirs = t["p" + j]
        const on = (p) => p >= 1 && p <= 51 && absOf(p, t.colors[j]) === a
        if (theirs.some(on)) { t["p" + j] = theirs.map((p) => (on(p) ? 0 : p)); hit = true }
      })
    }
  }
  const done = mine.every((p) => p === 57)
  const extra = d === 6 || to === 57 || hit || bonus
  t.last = { seat: me, piece, from, to, dice: d }
  t.phase = "roll"; t.turnAt = Date.now(); t.turn = extra || done ? me : nextSeat(t, me)
  return done
}

// ===== السلم والتعبان =====
const LADDERS = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 }
const SNAKES = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 99: 41 }
const snTo = (o, d) => { if (o + d > 100) return o; const n = o + d; return LADDERS[n] || SNAKES[n] || n }

// ===== الدومينو =====
const X = (a, b) => Math.min(a, b) * 7 + Math.max(a, b)
const lo = (x) => Math.floor(x / 7)
const hi = (x) => x % 7
const pips = (x) => lo(x) + hi(x)
const ends = (chain) => (chain && chain.length ? [lo(chain[0]), hi(chain[chain.length - 1])] : null)
function sidesFor(x, chain) {
  const e = ends(chain)
  if (!e) return ["R"]
  const out = []
  if (lo(x) === e[0] || hi(x) === e[0]) out.push("L")
  if (lo(x) === e[1] || hi(x) === e[1]) out.push("R")
  if (out.length === 2 && e[0] === e[1]) return ["R"]
  return out
}
function orient(x, chain, side) {
  const e = ends(chain)
  if (!e) return lo(x) * 7 + hi(x)
  const a = lo(x), b = hi(x)
  if (side === "L") { const other = a === e[0] ? b : a; return other * 7 + e[0] }
  const other = a === e[1] ? b : a
  return e[1] * 7 + other
}
function hand(tx, t, uid) { return tx.findRecordById("hands", t.id + "_" + uid) }
// التوزيع: كل واحد ٧، والباقي للسحب (مخفي). اللي معاه أكبر دبل يبدأ
function deal(tx, rec, t) {
  const deck = []
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) deck.push(X(a, b))
  for (let i = deck.length - 1; i > 0; i--) { const j = rand(i + 1); const x = deck[i]; deck[i] = deck[j]; deck[j] = x }
  const n = t.seats.length
  let first = 0, best = -1
  t.seats.forEach((u, k) => {
    const tiles = deck.slice(k * 7, k * 7 + 7)
    tiles.forEach((x) => { if (lo(x) === hi(x) && lo(x) > best) { best = lo(x); first = k } })
    let h
    try { h = hand(tx, t, u) } catch (_) { h = new Record(tx.findCollectionByNameOrId("hands")); h.set("id", t.id + "_" + u) }
    h.set("owner", u); h.set("table", t.id); h.set("tiles", tiles); h.set("sum", tiles.reduce((s, x) => s + pips(x), 0)); h.set("open", false)
    tx.save(h)
    t["c" + k] = 7
  })
  rec.set("deck", deck.slice(n * 7))
  t.size = n; t.status = "playing"; t.turn = first; t.turnAt = Date.now(); t.next = n * 7; t.chain = t.chain || []; t.passes = 0
}

module.exports = {
  WELCOME, FEES, DAILY, FREE_WIN, QUIZ_COINS, TURN_MS, DOMINO_TURN_MS, ROUND_MS, GAME_AR, dayNum, weekKey, rand,
  wallet, addCoins, load, save, nextSeat, colorsFor, startPos, seatOf, myTurn, refund, potOf, finish,
  canMove, ludoMove, snTo, lo, hi, pips, sidesFor, orient, hand, deal,
}
