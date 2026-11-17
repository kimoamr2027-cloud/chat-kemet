// "مسابقة كيمت": سؤال في كارت فوق الغرفة، وأول واحد يكتب الإجابة الصح ياخد نقطة
import { useEffect, useState } from 'react'
import {
  collection, doc, onSnapshot, query, where, runTransaction, deleteDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'
export { GAME_TYPES } from './gameBank.js'
export { ROUND_MS, GAP_MS, normalize, sha256, buildRound, displayAnswer, weekKey, matchAnswer } from './gamesShared.js'
import { buildRound, displayAnswer, weekKey, matchAnswer, resetUsed } from './gamesShared.js'
import { serverNow } from './presence.js'
import { logDiag } from './diag.js'
import { txAdmins, txWallet, txQuiz } from './coins.js'

const gameRef = (roomId) => doc(db, 'rooms', roomId, 'game', 'current')
// نوع المسابقة (علشان المكس) بنحفظه عندنا بس
const modes = new Map()

export async function startGame(roomId, type, total, me, myName) {
  resetUsed(roomId)
  modes.set(roomId, type)
  const { _mode, ...data } = { ...(await buildRound(roomId, type, 1, total, me, myName)), roundAt: serverTimestamp() }
  return runTransaction(db, async (tx) => { tx.set(gameRef(roomId), data) })
}

// السؤال اللي بعده (أو نهاية المسابقة) — لو حد تاني سبقنا مانعملش حاجة
export async function nextRound(roomId, game, me, myName) {
  const type = modes.get(roomId) || game.type
  const ref = gameRef(roomId)
  if (game.round >= game.total) {
    return runTransaction(db, async (tx) => {
      const cur = await tx.get(ref)
      if (!cur.exists() || cur.data().round !== game.round || cur.data().status === 'ended') return
      tx.update(ref, { status: 'ended' })
    })
  }
  const { _mode, ...data } = { ...(await buildRound(roomId, type, game.round + 1, game.total, me, myName)), roundAt: serverTimestamp() }
  return runTransaction(db, async (tx) => {
    const cur = await tx.get(ref)
    if (!cur.exists() || cur.data().round !== game.round || cur.data().status === 'open') return
    tx.set(ref, data)
  })
}

// الوقت خلص ومحدش جاوب
export function timeoutRound(roomId, game) {
  const ref = gameRef(roomId)
  return runTransaction(db, async (tx) => {
    const cur = await tx.get(ref)
    if (!cur.exists() || cur.data().status !== 'open' || cur.data().round !== game.round) return
    tx.update(ref, { status: 'timeout', answer: displayAnswer(game).slice(0, 100), solvedAt: serverTimestamp() })
  })
}

export const endGame = (roomId) => deleteDoc(gameRef(roomId))
export const stopGame = (roomId) => updateDoc(gameRef(roomId), { status: 'ended' })


// العضو كتب رسالة: لو هي الإجابة الصح ياخد النقطة
export async function tryAnswer(roomId, game, text, uid, name) {
  if (!game || game.status !== 'open' || !crypto?.subtle) return false
  const { n, h } = await matchAnswer(game, text)
  if (!h) return false
  const week = weekKey()
  try {
    await runTransaction(db, async (tx) => {
      const ref = gameRef(roomId)
      const sRef = doc(db, 'scores', uid)
      const cur = await tx.get(ref)
      const sc = await tx.get(sRef)
      const admins = await txAdmins(tx)
      const w = admins.includes(uid) ? null : await txWallet(tx, uid)
      if (!cur.exists() || cur.data().status !== 'open' || !cur.data().hashes.includes(h)) throw new Error('late')
      const old = sc.exists() ? sc.data() : null
      const points = old && old.week === week ? old.points + 1 : 1
      tx.update(ref, { status: 'solved', winner: uid, winnerName: name, answer: n, solvedAt: serverTimestamp() })
      tx.set(sRef, { name, points, week, room: roomId, updatedAt: serverTimestamp() })
      if (w) txQuiz(tx, uid, w, roomId) // +٢٠ كوين
    })
    return true
  } catch (e) {
    if (e?.message !== 'late') logDiag('quiz.answer', e)
    return false
  }
}

export function useGame(roomId) {
  const [game, setGame] = useState(null)
  useEffect(() => onSnapshot(gameRef(roomId), (s) => {
    if (!s.exists()) return setGame(null)
    const x = s.data({ serverTimestamps: 'estimate' })
    setGame({ ...x, roundAt: x.roundAt?.toMillis?.() || serverNow(), solvedAt: x.solvedAt?.toMillis?.() || null })
  }, () => setGame(null)), [roomId])
  return game
}

export function useLeaderboard(enabled) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(query(collection(db, 'scores'), where('week', '==', weekKey())),
      (s) => setList(s.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => b.points - a.points).slice(0, 20)),
      () => setList([]))
  }, [enabled])
  return list
}
