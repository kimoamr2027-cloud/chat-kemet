// الدومينو: ٢٨ حتة (دبل ٦). الحتة رقمها x = صغير×٧ + كبير
// ورق كل لاعب في مكان محدش يقراه غيره، والسحب حتة حتة، والسيرفر بيتأكد من كل لعبة
import { useEffect, useState } from 'react'
import { addDoc, collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase.js'
import { weekKey } from './games.js'
import { nextSeat } from './ludo.js'

export const X = (a, b) => Math.min(a, b) * 7 + Math.max(a, b)
export const lo = (x) => Math.floor(x / 7)
export const hi = (x) => x % 7
export const pips = (x) => lo(x) + hi(x)
export const ALL = []
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) ALL.push(X(a, b))

export const ends = (chain) => (chain?.length ? [lo(chain[0]), hi(chain[chain.length - 1])] : null)
// الحتة دي تنفع تتلعب فين؟ ['L'] أو ['R'] أو الاتنين (أو [] مش نافعة)
export function sidesFor(x, chain) {
  const e = ends(chain)
  if (!e) return ['R']
  const out = []
  if (lo(x) === e[0] || hi(x) === e[0]) out.push('L')
  if (lo(x) === e[1] || hi(x) === e[1]) out.push('R')
  if (out.length === 2 && e[0] === e[1]) return ['R']
  return out
}
// اتجاه الحتة على الترابيزة
function orient(x, chain, side) {
  const e = ends(chain)
  if (!e) return lo(x) * 7 + hi(x)
  const a = lo(x); const b = hi(x)
  if (side === 'L') { const other = a === e[0] ? b : a; return other * 7 + e[0] }
  const other = a === e[1] ? b : a
  return e[1] * 7 + other
}

const tRef = (id) => doc(db, 'domino', id)
const hRef = (id, uid) => doc(db, 'domino', id, 'hands', uid)

export function useHand(id, uid, enabled = true) {
  const [h, setH] = useState(null)
  useEffect(() => {
    if (!id || !uid || !enabled) return
    return onSnapshot(hRef(id, uid), (s) => setH(s.exists() ? s.data() : null), () => setH(null))
  }, [id, uid, enabled])
  return h
}
// بعد ما اللعبة تخلص الكل يشوف ورق الكل
export async function getHands(t) {
  const out = {}
  await Promise.all(t.seats.map(async (u) => { try { const s = await getDoc(hRef(t.id, u)); if (s.exists()) out[u] = s.data() } catch {} }))
  return out
}

export async function createDomino({ uid, name, size, room = '', roomName = '' }) {
  const ref = await addDoc(collection(db, 'domino'), {
    host: uid, hostName: name, room, roomName: roomName.slice(0, 40), size, seats: [uid], names: { [uid]: name },
    status: 'waiting', turn: 0, createdAt: serverTimestamp(), left: {}, chain: [], passes: 0,
  })
  return ref.id
}

export function joinDomino(id, uid, name) {
  return runTransaction(db, async (tx) => {
    const s = await tx.get(tRef(id))
    if (!s.exists()) throw new Error('gone')
    const t = s.data()
    if (t.seats.includes(uid)) return
    if (t.status !== 'waiting' || t.seats.length >= t.size) throw new Error('full')
    tx.update(tRef(id), { seats: [...t.seats, uid], [`names.${uid}`]: name, status: t.seats.length + 1 === t.size ? 'deal' : 'waiting' })
  })
}
export const startNowDomino = (t) => updateDoc(tRef(t.id), { size: t.seats.length, status: 'deal' })

// التوزيع (صاحب الترابيزة): كل واحد ٧، والباقي للسحب. اللي معاه أكبر دبل يبدأ
export async function deal(t) {
  const deck = [...ALL]
  const rnd = new Uint32Array(deck.length)
  crypto.getRandomValues(rnd)
  for (let i = deck.length - 1; i > 0; i--) { const j = rnd[i] % (i + 1); [deck[i], deck[j]] = [deck[j], deck[i]] }
  const n = t.seats.length
  const b = writeBatch(db)
  let first = 0
  let best = -1
  t.seats.forEach((u, k) => {
    const tiles = deck.slice(k * 7, k * 7 + 7)
    tiles.forEach((x) => { if (lo(x) === hi(x) && lo(x) > best) { best = lo(x); first = k } })
    b.set(hRef(t.id, u), { tiles, sum: tiles.reduce((a, x) => a + pips(x), 0) })
  })
  for (let i = n * 7; i < 28; i++) b.set(doc(db, 'domino', t.id, 'bone', String(i)), { x: deck[i] })
  const counts = {}
  for (let k = 0; k < n; k++) counts[`c${k}`] = 7
  b.update(tRef(t.id), { status: 'playing', turn: first, turnAt: serverTimestamp(), next: n * 7, ...counts })
  return b.commit()
}

export async function playTile(t, uid, hand, x, side) {
  const seat = t.turn
  const o = orient(x, t.chain, side)
  const chain = !t.chain.length ? [o] : side === 'L' ? [o, ...t.chain] : [...t.chain, o]
  const tiles = hand.tiles.filter((y) => y !== x)
  const left = t[`c${seat}`] - 1
  const patch = {
    chain, [`c${seat}`]: left, passes: 0, turnAt: serverTimestamp(),
    last: { seat, kind: 'play', x, o, side: t.chain.length ? side : 'R', at: serverTimestamp() },
  }
  if (left > 0) {
    const b = writeBatch(db)
    b.update(hRef(t.id, uid), { tiles, sum: hand.sum - pips(x) })
    b.update(tRef(t.id), { ...patch, turn: nextSeat(t, seat) })
    return b.commit()
  }
  // خلّص ورقه: كسب
  const week = weekKey()
  const sRef = doc(db, 'dominoScores', uid)
  return runTransaction(db, async (tx) => {
    const sc = await tx.get(sRef)
    const old = sc.exists() ? sc.data() : null
    tx.update(hRef(t.id, uid), { tiles, sum: hand.sum - pips(x) })
    tx.update(tRef(t.id), { ...patch, status: 'done', winner: uid, winnerName: t.names[uid], finishedAt: serverTimestamp() })
    tx.set(sRef, { name: t.names[uid], wins: old && old.week === week ? old.wins + 1 : 1, week, table: t.id, updatedAt: serverTimestamp() })
  })
}

export async function drawTile(t, uid, hand) {
  const s = await getDoc(doc(db, 'domino', t.id, 'bone', String(t.next)))
  const x = s.data().x
  const seat = t.turn
  const b = writeBatch(db)
  b.update(hRef(t.id, uid), { tiles: [...hand.tiles, x], sum: hand.sum + pips(x) })
  b.update(tRef(t.id), { next: t.next + 1, [`c${seat}`]: t[`c${seat}`] + 1, last: { seat, kind: 'draw', at: serverTimestamp() }, turnAt: serverTimestamp() })
  await b.commit()
  return x
}

export function passDomino(t) {
  const passes = (t.passes || 0) + 1
  const blocked = passes >= t.seats.length
  return updateDoc(tRef(t.id), {
    passes, last: { seat: t.turn, kind: 'pass', at: serverTimestamp() }, turnAt: serverTimestamp(),
    ...(blocked ? { status: 'blocked', blockedAt: serverTimestamp() } : { turn: nextSeat(t, t.turn) }),
  })
}
export const reveal = (t, seat, sum) => updateDoc(tRef(t.id), { [`r${seat}`]: sum, revealSeat: seat })
export function claimBlocked(t, uid, seat) {
  const week = weekKey()
  const sRef = doc(db, 'dominoScores', uid)
  return runTransaction(db, async (tx) => {
    const sc = await tx.get(sRef)
    const old = sc.exists() ? sc.data() : null
    tx.update(tRef(t.id), { status: 'done', winner: uid, winnerName: t.names[uid], winnerSeat: seat, finishedAt: serverTimestamp() })
    tx.set(sRef, { name: t.names[uid], wins: old && old.week === week ? old.wins + 1 : 1, week, table: t.id, updatedAt: serverTimestamp() })
  })
}
