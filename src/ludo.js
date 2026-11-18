// لودو كيمت: منطق اللعبة والتخزين
// كل لاعب عنده ٤ قطع، ومكان القطعة رقم من ٠ لـ ٥٧:
// ٠ = في البيت، ١..٥١ = على الطريق، ٥٢..٥٦ = السكة الملونة، ٥٧ = وصلت
// النرد بيطلع من وقت السيرفر (الميكروثانية) والسيرفر بيتأكد من كل نقلة
import { useEffect, useState } from 'react'
import {
  collection, doc, onSnapshot, query, where, limit, orderBy, addDoc, updateDoc, deleteDoc, getDoc, setDoc,
  runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { weekKey } from './games.js'
import { sendDM, chatIdFor } from './dm.js'
import { sendRoomMessage } from './rooms.js'
import { notify } from './notifs.js'
import { txAdmins, txWallet, txPay, txRefund, txWin } from './coins.js'

export { TURN_MS, GAME_NAMES, GAME_ICONS, MODES, LUCK_BONUS, LUCK_SKULL, COLOR_NAMES, COLOR_AR, COLOR_HEX, colorsFor, colorIdx, PATH, SAFE, absOf, spotOf, canMove, legalPieces, nextSeat, LADDERS, SNAKES, snJump, snTo, snCell } from './ludoShared.js'
import { nextSeat, colorsFor, absOf, SAFE, LUCK_BONUS, LUCK_SKULL, snTo, MODES, GAME_NAMES, GAME_ICONS } from './ludoShared.js'
const K = (t) => t?.kind || 'ludo'
const scoresOf = (kind) => `${kind}Scores`
const startPos = (kind, mode) => (kind === 'snakes' ? 0 : mode === 'quick' ? [0, 0, 57, 57] : [0, 0, 0, 0])

// النرد من وقت السيرفر
export function diceOf(t) {
  if (!t?.rolledAt || t.pending) return 0
  const x = Math.floor(t.rolledAt.nanoseconds / 1000)
  return ((x % 1000) + Math.floor(x / 1000)) % 6 + 1
}

// ===== التخزين =====
export function useTable(id, kind = 'ludo') {
  const [t, setT] = useState(undefined)
  useEffect(() => {
    if (!id) return
    return onSnapshot(doc(db, kind, id), { includeMetadataChanges: true }, (s) => {
      if (!s.exists()) return setT(null)
      const x = s.data({ serverTimestamps: 'estimate' })
      setT({ id: s.id, kind, ...x, pending: s.metadata.hasPendingWrites })
    }, () => setT(null))
  }, [id, kind])
  return t
}

export function useOpenTables(kind = 'ludo') {
  const [list, setList] = useState(null)
  useEffect(() => onSnapshot(query(collection(db, kind), where('status', '==', 'waiting'), limit(40)), (s) => {
    const now = Date.now()
    setList(s.docs.map((d) => ({ id: d.id, kind, ...d.data({ serverTimestamps: 'estimate' }) }))
      // الترابيزات القديمة (أكتر من ٢٠ دقيقة) غالبًا صاحبها مشي
      .filter((t) => t.seats.length < t.size && now - (t.createdAt?.toMillis?.() || now) < 20 * 60 * 1000)
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)))
  }, () => setList([])), [kind])
  return list
}

export function useMyTables(uid, kind = 'ludo') {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!uid) return
    return onSnapshot(query(collection(db, kind), where('seats', 'array-contains', uid), limit(30)), (s) => {
      setList(s.docs.map((d) => ({ id: d.id, kind, ...d.data({ serverTimestamps: 'estimate' }) }))
        .filter((t) => t.status !== 'done' && t.status !== 'cancelled' && !t.left?.[uid])
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)))
    }, () => setList([]))
  }, [uid, kind])
  return list
}

export function useLudoBoard(enabled = true, kind = 'ludo') {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(query(collection(db, scoresOf(kind)), where('week', '==', weekKey())),
      (s) => setList(s.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => b.wins - a.wins).slice(0, 30)),
      () => setList([]))
  }, [enabled, kind])
  return list
}

export function useTableChat(id, kind = 'ludo') {
  const [msgs, setMsgs] = useState([])
  useEffect(() => {
    if (!id) return
    return onSnapshot(query(collection(db, kind, id, 'chat'), orderBy('at', 'desc'), limit(15)),
      (s) => setMsgs(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).reverse()),
      () => setMsgs([]))
  }, [id, kind])
  return msgs
}
export const sendTableChat = (id, uid, name, text, kind = 'ludo') =>
  addDoc(collection(db, kind, id, 'chat'), { uid, name, text: text.slice(0, 120), at: serverTimestamp() })

// ===== الحركات =====
export async function createTable({ uid, name, size, room = '', roomName = '', kind = 'ludo', mode = 'classic', fee = 0, admin = false }) {
  const ref = doc(collection(db, kind))
  const data = {
    host: uid, hostName: name, room, roomName: roomName.slice(0, 40), size, colors: colorsFor(size),
    seats: [uid], names: { [uid]: name }, p0: startPos(kind, mode), status: 'waiting', turn: 0, phase: 'roll',
    createdAt: serverTimestamp(), left: {}, ...(kind === 'ludo' && mode !== 'classic' ? { mode } : {}), ...(fee ? { fee } : {}),
  }
  await createWithFee(ref, data, uid, fee, admin, kind)
  return ref.id
}
// ترابيزة بدخولية: الترابيزة والدفع مع بعض (الأدمن مابيدفعش)
export function createWithFee(ref, data, uid, fee, admin, kind) {
  if (!fee || admin) return setDoc(ref, data)
  return runTransaction(db, async (tx) => {
    const w = await txWallet(tx, uid)
    tx.set(ref, data)
    txPay(tx, uid, w, fee, kind, ref.id)
  })
}

export function joinTable(id, uid, name, kind = 'ludo', admin = false) {
  const ref = doc(db, kind, id)
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref)
    if (!s.exists()) throw new Error('gone')
    const t = s.data()
    if (t.seats.includes(uid)) return
    if (t.status !== 'waiting' || t.seats.length >= t.size) throw new Error('full')
    if (t.fee && !admin) txPay(tx, uid, await txWallet(tx, uid), t.fee, kind, id)
    const n = t.seats.length
    const full = n + 1 === t.size
    tx.update(ref, {
      seats: [...t.seats, uid], [`names.${uid}`]: name, [`p${n}`]: startPos(kind, t.mode),
      status: full ? 'playing' : 'waiting', ...(full ? { turnAt: serverTimestamp() } : {}),
    })
  })
}

export const startNow = (t) => updateDoc(doc(db, K(t), t.id), {
  size: t.seats.length, colors: colorsFor(t.seats.length), status: 'playing', turnAt: serverTimestamp(),
})
export const rollDice = (t) => updateDoc(doc(db, K(t), t.id), { phase: 'move', rolledAt: serverTimestamp() })
export const passTurn = (t) => updateDoc(doc(db, K(t), t.id), { turn: nextSeat(t, t.turn), phase: 'roll', turnAt: serverTimestamp() })
export function leaveTable(t, uid, admin = false) {
  const ref = doc(db, K(t), t.id)
  // ترابيزة بدخولية لسه مابدأتش: الدخولية بترجع، وصاحبها بيلغيها
  if (t.status === 'waiting' && t.fee > 0) {
    return runTransaction(db, async (tx) => {
      const w = admin ? null : await txWallet(tx, uid)
      tx.update(ref, { [`left.${uid}`]: true, [`refunded.${uid}`]: true, status: t.host === uid ? 'cancelled' : 'waiting' })
      if (!admin) txRefund(tx, uid, w, t.fee, K(t), t.id)
    })
  }
  return t.status === 'waiting' && t.host === uid ? deleteDoc(ref) : updateDoc(ref, { [`left.${uid}`]: true })
}
// المكسب: ترتيب الأسبوع + الكوينز (الحصالة أو ٥٠ في الترابيزة المجانية)
export async function txFinish(tx, t, uid, tablePatch) {
  const ref = doc(db, K(t), t.id)
  const sRef = doc(db, scoresOf(K(t)), uid)
  const week = weekKey()
  const sc = await tx.get(sRef)
  const admins = await txAdmins(tx)
  const w = admins.includes(uid) ? null : await txWallet(tx, uid)
  const old = sc.exists() ? sc.data() : null
  tx.update(ref, { ...tablePatch, status: 'done', winner: uid, winnerName: t.names[uid], finishedAt: serverTimestamp() })
  tx.set(sRef, { name: t.names[uid], wins: old && old.week === week ? old.wins + 1 : 1, week, table: t.id, updatedAt: serverTimestamp() })
  txWin(tx, uid, w, { ...t, kind: K(t) }, admins)
}
// الباقيين خرجوا: آخر واحد يكسب (وبياخد المكسب في ترتيب الأسبوع)
export function claimWin(t, uid) {
  return runTransaction(db, (tx) => txFinish(tx, t, uid, {}))
}
export const closeTable = (id, kind = 'ludo') => deleteDoc(doc(db, kind, id))

// نحسب النقلة (وضرب قطع الخصم)
export function planMove(t, piece, d) {
  const me = t.turn
  const off = t.colors[me]
  const mine = [...t[`p${me}`]]
  const from = mine[piece]
  const to = from === 0 ? 1 : from + d
  // لودو الحظ: 💀 بترجّع البيت، ⚡ دور زيادة
  const luck = t.mode === 'luck' && to >= 1 && to <= 51
  const skull = luck && LUCK_SKULL.includes(absOf(to, off))
  const bonus = luck && LUCK_BONUS.includes(absOf(to, off))
  mine[piece] = skull ? 0 : to
  const patch = { [`p${me}`]: mine }
  let hit = false
  if (to <= 51 && !skull) {
    const a = absOf(to, off)
    if (!SAFE.includes(a)) {
      t.seats.forEach((_, j) => {
        if (j === me) return
        const theirs = t[`p${j}`]
        if (theirs.some((p) => p >= 1 && p <= 51 && absOf(p, t.colors[j]) === a)) {
          patch[`p${j}`] = theirs.map((p) => (p >= 1 && p <= 51 && absOf(p, t.colors[j]) === a ? 0 : p))
          hit = true
        }
      })
    }
  }
  const done = mine.every((p) => p === 57)
  const extra = d === 6 || to === 57 || hit || bonus
  Object.assign(patch, {
    last: { seat: me, piece, from, to, dice: d },
    phase: 'roll', turnAt: serverTimestamp(), turn: extra || done ? me : nextSeat(t, me),
  })
  return { patch, done, hit, to, skull, bonus }
}

export async function movePiece(t, piece, uid) {
  const d = diceOf(t)
  const { patch, done } = planMove(t, piece, d)
  const ref = doc(db, K(t), t.id)
  if (!done) return updateDoc(ref, patch)
  // كسب: ترتيب الأسبوع والكوينز مع النقلة
  return runTransaction(db, (tx) => txFinish(tx, t, uid, patch))
}

// ===== الدعوات =====
export function inviteRoom(roomId, profile, uid, tableId, size, kind = 'ludo', mode = 'classic') {
  const nm = mode !== 'classic' && MODES[mode] ? `${GAME_NAMES[kind]} ${MODES[mode].name}` : GAME_NAMES[kind]
  return sendRoomMessage(roomId, profile, uid, { kind, table: tableId, text: `${GAME_ICONS[kind]} ${profile.name} فاتح ترابيزة ${nm} (${size === 2 ? '١ ضد ١' : '٤ لاعبين'})` })
}
export async function inviteDM(me, myName, other, tableId, kind = 'ludo') {
  const s = await getDoc(doc(db, 'chats', chatIdFor(me, other)))
  const text = `${GAME_ICONS[kind]} ${myName} بيتحدّاك في ${GAME_NAMES[kind]}!`
  const msgId = await sendDM({ me, other, exists: s.exists(), kind, text, table: tableId })
  notify(other, me, myName, { type: 'dm', msgId, text }, `dm_${me}`)
}

export async function moveSnake(t, uid) {
  const d = diceOf(t)
  const k = `p${t.turn}`
  const from = t[k]
  const to = snTo(from, d)
  const ref = doc(db, 'snakes', t.id)
  const patch = {
    [k]: to, last: { seat: t.turn, from, to, dice: d }, phase: 'roll', turnAt: serverTimestamp(),
    turn: to === 100 || d === 6 ? t.turn : nextSeat(t, t.turn),
  }
  if (to !== 100) return updateDoc(ref, patch)
  return runTransaction(db, (tx) => txFinish(tx, { ...t, kind: 'snakes' }, uid, patch))
}

// العب على طول (نسخة Firebase القديمة: بتفتح ترابيزة جديدة بس)
export async function quickPlay({ uid, name, kind = 'ludo', size = 4, mode = 'classic', fee = 0, admin = false }) {
  if (kind === 'domino') { const { createDomino } = await import('./domino.js'); return createDomino({ uid, name, size, fee, admin }) }
  return createTable({ uid, name, size, kind, mode, fee, admin })
}
