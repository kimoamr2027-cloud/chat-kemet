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

export const TURN_MS = 45 * 1000
// نوع اللعبة: 'ludo' أو 'snakes' (السلم والتعبان) — كل واحدة في مكان لوحدها
export const GAME_NAMES = { ludo: 'لودو', snakes: 'السلم والتعبان', domino: 'دومينو' }
export const GAME_ICONS = { ludo: '🎲', snakes: '🐍', domino: '🁫' }
const K = (t) => t?.kind || 'ludo'
const scoresOf = (kind) => `${kind}Scores`
const startPos = (kind, mode) => (kind === 'snakes' ? 0 : mode === 'quick' ? [0, 0, 57, 57] : [0, 0, 0, 0])
// أنواع اللودو
export const MODES = {
  classic: { name: 'كلاسيك', icon: '🎲', hint: 'اللودو العادي' },
  night: { name: 'الليلي', icon: '🌙', hint: 'نفس اللعب بلوحة غامقة' },
  quick: { name: 'السريع', icon: '⚔️', hint: 'كل لاعب بقطعتين بس' },
  luck: { name: 'الحظ', icon: '⚡', hint: '⚡ دور زيادة و💀 ترجّعك البيت' },
}
export const LUCK_BONUS = [3, 16, 29, 42]
export const LUCK_SKULL = [6, 19, 32, 45]
export const COLOR_NAMES = ['red', 'green', 'yellow', 'blue']
export const COLOR_AR = ['أحمر', 'أخضر', 'أصفر', 'أزرق']
export const COLOR_HEX = ['#E5392F', '#2DB04B', '#F7C21B', '#2C7BE5']
export const colorsFor = (n) => (n === 2 ? [0, 26] : n === 3 ? [0, 13, 26] : [0, 13, 26, 39])
export const colorIdx = (off) => off / 13

// الطريق (٥٢ مربع) بإحداثيات اللوحة [صف، عمود] — بيبدأ من خانة خروج الأحمر
export const PATH = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
]
export const SAFE = [0, 8, 13, 21, 26, 34, 39, 47]
export const absOf = (rel, off) => (off + rel - 1) % 52

const QUAD = [[3, 3], [3, 12], [12, 12], [12, 3]]
const FINISH = [[7.5, 6.55], [6.55, 7.5], [7.5, 8.45], [8.45, 7.5]]
// مكان القطعة على الشاشة (مركز الخانة بوحدة المربعات)
export function spotOf(off, rel, piece) {
  const ci = colorIdx(off)
  if (rel === 0) {
    const [y, x] = QUAD[ci]
    return [y + (piece < 2 ? -0.95 : 0.95), x + (piece % 2 ? 0.95 : -0.95)]
  }
  if (rel <= 51) { const [r, c] = PATH[absOf(rel, off)]; return [r + 0.5, c + 0.5] }
  if (rel <= 56) {
    const k = rel - 51
    const rc = [[7, k], [k, 7], [7, 14 - k], [14 - k, 7]][ci]
    return [rc[0] + 0.5, rc[1] + 0.5]
  }
  return FINISH[ci]
}

export const canMove = (p, d) => (p === 0 && d === 6) || (p > 0 && p + d <= 57)
export const legalPieces = (pieces, d) => [0, 1, 2, 3].filter((i) => canMove(pieces[i], d))

// النرد من وقت السيرفر
export function diceOf(t) {
  if (!t?.rolledAt || t.pending) return 0
  const x = Math.floor(t.rolledAt.nanoseconds / 1000)
  return ((x % 1000) + Math.floor(x / 1000)) % 6 + 1
}

export function nextSeat(t, from) {
  const n = t.seats.length
  for (let k = 1; k < n; k++) {
    const j = (from + k) % n
    if (!t.left?.[t.seats[j]]) return j
  }
  return (from + 1) % n
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

// ===== السلم والتعبان =====
// السلالم (بتطلّعك) والتعابين (بتنزّلك) — لازم تبقى زي اللي في قواعد الأمان بالظبط
export const LADDERS = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 }
export const SNAKES = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 99: 41 }
export const snJump = (n) => LADDERS[n] ?? SNAKES[n] ?? n
export const snTo = (o, d) => (o + d > 100 ? o : snJump(o + d))
// مكان الخانة على اللوحة (٠ = تحت يسار، والصفوف بتلف زي الثعبان)
export function snCell(n) {
  const r = Math.floor((n - 1) / 10)
  let c = (n - 1) % 10
  if (r % 2) c = 9 - c
  return [9 - r, c]
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
