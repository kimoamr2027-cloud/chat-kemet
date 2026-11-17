// الدومينو: ٢٨ حتة (دبل ٦). الحتة رقمها x = صغير×٧ + كبير
// ورق كل لاعب في مكان محدش يقراه غيره، والسحب حتة حتة، والسيرفر بيتأكد من كل لعبة
import { useEffect, useState } from 'react'
import { collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase.js'
import { nextSeat, createWithFee, txFinish } from './ludo.js'
import { txWallet, txPay } from './coins.js'

export { X, lo, hi, pips, ALL, ends, sidesFor, orient } from './dominoShared.js'
import { lo, hi, pips, ALL, orient } from './dominoShared.js'

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

export async function createDomino({ uid, name, size, room = '', roomName = '', fee = 0, admin = false }) {
  const ref = doc(collection(db, 'domino'))
  await createWithFee(ref, {
    host: uid, hostName: name, room, roomName: roomName.slice(0, 40), size, seats: [uid], names: { [uid]: name },
    status: 'waiting', turn: 0, createdAt: serverTimestamp(), left: {}, chain: [], passes: 0, ...(fee ? { fee } : {}),
  }, uid, fee, admin, 'domino')
  return ref.id
}

export function joinDomino(id, uid, name, admin = false) {
  return runTransaction(db, async (tx) => {
    const s = await tx.get(tRef(id))
    if (!s.exists()) throw new Error('gone')
    const t = s.data()
    if (t.seats.includes(uid)) return
    if (t.status !== 'waiting' || t.seats.length >= t.size) throw new Error('full')
    if (t.fee && !admin) txPay(tx, uid, await txWallet(tx, uid), t.fee, 'domino', id)
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
  // خلّص ورقه: كسب (ترتيب الأسبوع والكوينز)
  return runTransaction(db, async (tx) => {
    await txFinish(tx, { ...t, kind: 'domino' }, uid, patch)
    tx.update(hRef(t.id, uid), { tiles, sum: hand.sum - pips(x) })
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
  return runTransaction(db, (tx) => txFinish(tx, { ...t, kind: 'domino' }, uid, { winnerSeat: seat }))
}
