// لودو كيمت: منطق اللعبة والتخزين
// كل لاعب عنده ٤ قطع، ومكان القطعة رقم من ٠ لـ ٥٧:
// ٠ = في البيت، ١..٥١ = على الطريق، ٥٢..٥٦ = السكة الملونة، ٥٧ = وصلت
// النرد بيطلع من وقت السيرفر (الميكروثانية) والسيرفر بيتأكد من كل نقلة
import { useEffect, useState } from 'react'
import {
  collection, doc, onSnapshot, query, where, limit, orderBy, addDoc, updateDoc, deleteDoc, getDoc,
  runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { weekKey } from './games.js'
import { sendDM, chatIdFor } from './dm.js'
import { sendRoomMessage } from './rooms.js'
import { notify } from './notifs.js'

export const TURN_MS = 45 * 1000
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

function nextSeat(t, from) {
  const n = t.seats.length
  for (let k = 1; k < n; k++) {
    const j = (from + k) % n
    if (!t.left?.[t.seats[j]]) return j
  }
  return (from + 1) % n
}

// ===== التخزين =====
export function useTable(id) {
  const [t, setT] = useState(undefined)
  useEffect(() => {
    if (!id) return
    return onSnapshot(doc(db, 'ludo', id), { includeMetadataChanges: true }, (s) => {
      if (!s.exists()) return setT(null)
      const x = s.data({ serverTimestamps: 'estimate' })
      setT({ id: s.id, ...x, pending: s.metadata.hasPendingWrites })
    }, () => setT(null))
  }, [id])
  return t
}

export function useOpenTables() {
  const [list, setList] = useState(null)
  useEffect(() => onSnapshot(query(collection(db, 'ludo'), where('status', '==', 'waiting'), limit(40)), (s) => {
    const now = Date.now()
    setList(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
      // الترابيزات القديمة (أكتر من ٢٠ دقيقة) غالبًا صاحبها مشي
      .filter((t) => t.seats.length < t.size && now - (t.createdAt?.toMillis?.() || now) < 20 * 60 * 1000)
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)))
  }, () => setList([])), [])
  return list
}

export function useMyTables(uid) {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!uid) return
    return onSnapshot(query(collection(db, 'ludo'), where('seats', 'array-contains', uid), limit(30)), (s) => {
      setList(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
        .filter((t) => (t.status === 'playing' || t.status === 'waiting') && !t.left?.[uid])
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)))
    }, () => setList([]))
  }, [uid])
  return list
}

export function useLudoBoard(enabled = true) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(query(collection(db, 'ludoScores'), where('week', '==', weekKey())),
      (s) => setList(s.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => b.wins - a.wins).slice(0, 30)),
      () => setList([]))
  }, [enabled])
  return list
}

export function useTableChat(id) {
  const [msgs, setMsgs] = useState([])
  useEffect(() => {
    if (!id) return
    return onSnapshot(query(collection(db, 'ludo', id, 'chat'), orderBy('at', 'desc'), limit(15)),
      (s) => setMsgs(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).reverse()),
      () => setMsgs([]))
  }, [id])
  return msgs
}
export const sendTableChat = (id, uid, name, text) =>
  addDoc(collection(db, 'ludo', id, 'chat'), { uid, name, text: text.slice(0, 120), at: serverTimestamp() })

// ===== الحركات =====
export async function createTable({ uid, name, size, room = '', roomName = '' }) {
  const ref = await addDoc(collection(db, 'ludo'), {
    host: uid, hostName: name, room, roomName: roomName.slice(0, 40), size, colors: colorsFor(size),
    seats: [uid], names: { [uid]: name }, p0: [0, 0, 0, 0], status: 'waiting', turn: 0, phase: 'roll',
    createdAt: serverTimestamp(), left: {},
  })
  return ref.id
}

export function joinTable(id, uid, name) {
  const ref = doc(db, 'ludo', id)
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref)
    if (!s.exists()) throw new Error('gone')
    const t = s.data()
    if (t.seats.includes(uid)) return
    if (t.status !== 'waiting' || t.seats.length >= t.size) throw new Error('full')
    const n = t.seats.length
    const full = n + 1 === t.size
    tx.update(ref, {
      seats: [...t.seats, uid], [`names.${uid}`]: name, [`p${n}`]: [0, 0, 0, 0],
      status: full ? 'playing' : 'waiting', ...(full ? { turnAt: serverTimestamp() } : {}),
    })
  })
}

export const startNow = (t) => updateDoc(doc(db, 'ludo', t.id), {
  size: t.seats.length, colors: colorsFor(t.seats.length), status: 'playing', turnAt: serverTimestamp(),
})
export const rollDice = (t) => updateDoc(doc(db, 'ludo', t.id), { phase: 'move', rolledAt: serverTimestamp() })
export const passTurn = (t) => updateDoc(doc(db, 'ludo', t.id), { turn: nextSeat(t, t.turn), phase: 'roll', turnAt: serverTimestamp() })
export const leaveTable = (t, uid) => (t.status === 'waiting' && t.host === uid
  ? deleteDoc(doc(db, 'ludo', t.id))
  : updateDoc(doc(db, 'ludo', t.id), { [`left.${uid}`]: true }))
// الباقيين خرجوا: آخر واحد يكسب (وبياخد المكسب في ترتيب الأسبوع)
export function claimWin(t, uid) {
  const ref = doc(db, 'ludo', t.id)
  const sRef = doc(db, 'ludoScores', uid)
  const week = weekKey()
  return runTransaction(db, async (tx) => {
    const sc = await tx.get(sRef)
    const old = sc.exists() ? sc.data() : null
    tx.update(ref, { status: 'done', winner: uid, winnerName: t.names[uid], finishedAt: serverTimestamp() })
    tx.set(sRef, { name: t.names[uid], wins: old && old.week === week ? old.wins + 1 : 1, week, table: t.id, updatedAt: serverTimestamp() })
  })
}
export const closeTable = (id) => deleteDoc(doc(db, 'ludo', id))

// نحسب النقلة (وضرب قطع الخصم)
export function planMove(t, piece, d) {
  const me = t.turn
  const off = t.colors[me]
  const mine = [...t[`p${me}`]]
  const from = mine[piece]
  const to = from === 0 ? 1 : from + d
  mine[piece] = to
  const patch = { [`p${me}`]: mine }
  let hit = false
  if (to <= 51) {
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
  const extra = d === 6 || to === 57 || hit
  Object.assign(patch, {
    last: { seat: me, piece, from, to, dice: d },
    phase: 'roll', turnAt: serverTimestamp(), turn: extra || done ? me : nextSeat(t, me),
  })
  return { patch, done, hit, to }
}

export async function movePiece(t, piece, uid) {
  const d = diceOf(t)
  const { patch, done } = planMove(t, piece, d)
  const ref = doc(db, 'ludo', t.id)
  if (!done) return updateDoc(ref, patch)
  // كسب: نسجّل المكسب في ترتيب الأسبوع مع النقلة
  const week = weekKey()
  const sRef = doc(db, 'ludoScores', uid)
  return runTransaction(db, async (tx) => {
    const sc = await tx.get(sRef)
    const old = sc.exists() ? sc.data() : null
    tx.update(ref, { ...patch, status: 'done', winner: uid, winnerName: t.names[uid], finishedAt: serverTimestamp() })
    tx.set(sRef, { name: t.names[uid], wins: old && old.week === week ? old.wins + 1 : 1, week, table: t.id, updatedAt: serverTimestamp() })
  })
}

// ===== الدعوات =====
export function inviteRoom(roomId, profile, uid, tableId, size) {
  return sendRoomMessage(roomId, profile, uid, { kind: 'ludo', table: tableId, text: `🎲 ${profile.name} فاتح ترابيزة لودو (${size === 2 ? '١ ضد ١' : '٤ لاعبين'})` })
}
export async function inviteDM(me, myName, other, tableId) {
  const s = await getDoc(doc(db, 'chats', chatIdFor(me, other)))
  const text = `🎲 ${myName} بيتحدّاك في لودو!`
  const msgId = await sendDM({ me, other, exists: s.exists(), kind: 'ludo', text, table: tableId })
  notify(other, me, myName, { type: 'dm', msgId, text }, `dm_${me}`)
}
