// مسابقة كيمت من سيرفر PocketBase (نفس شكل src/games.js)
// الأسئلة من بنك التطبيق، والسيرفر بيتأكد من الإجابة (بالـ hash) ويدّي النقطة والكوينز
import { useEffect, useState } from 'react'
import { pb, q, live } from './client.js'
import { buildRound, displayAnswer, weekKey, matchAnswer, resetUsed } from '../gamesShared.js'
import { serverNow } from '../presence.js'
export { GAME_TYPES } from '../gameBank.js'
export { ROUND_MS, GAP_MS, normalize, sha256, buildRound, displayAnswer, weekKey, matchAnswer } from '../gamesShared.js'

const quiz = (room, body) => pb.send('/api/kemet/quiz', { method: 'POST', body: { room, ...body } })
const modes = new Map()

export async function startGame(roomId, type, total, me, myName) {
  resetUsed(roomId)
  modes.set(roomId, type)
  const { _mode, ...data } = await buildRound(roomId, type, 1, total, me, myName)
  return quiz(roomId, { action: 'start', data })
}

export async function nextRound(roomId, game, me, myName) {
  if (game.round >= game.total) return quiz(roomId, { action: 'ended', round: game.round })
  // المسابقة التلقائية: السيرفر هو اللي بيختار السؤال
  if (game.auto) return quiz(roomId, { action: 'next', round: game.round + 1 })
  const type = modes.get(roomId) || game.type
  const { _mode, ...data } = await buildRound(roomId, type, game.round + 1, game.total, me, myName)
  return quiz(roomId, { action: 'next', data })
}

export const timeoutRound = (roomId, game) => quiz(roomId, { action: 'timeout', round: game.round, answer: displayAnswer(game).slice(0, 100) })
export const endGame = (roomId) => quiz(roomId, { action: 'end' })
export const stopGame = (roomId) => quiz(roomId, { action: 'stop' })

export async function tryAnswer(roomId, game, text) {
  if (!game || game.status !== 'open' || !crypto?.subtle) return false
  const { n, h } = await matchAnswer(game, text)
  if (!h) return false
  try { return (await quiz(roomId, { action: 'answer', hash: h, answer: n })).ok === true } catch { return false }
}

const toGame = (st) => (st ? { ...st, roundAt: st.roundAt || serverNow(), solvedAt: st.solvedAt || null } : null)
export function useGame(roomId) {
  const [game, setGame] = useState(null)
  useEffect(() => {
    setGame(null)
    pb.collection('quiz').getOne(roomId).then((r) => setGame(toGame(r.state))).catch(() => setGame(null))
    return live('quiz', roomId, (ev) => setGame(ev.action === 'delete' ? null : toGame(ev.record.state)))
  }, [roomId])
  return game
}

export function useLeaderboard(enabled) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return
    pb.collection('scores').getList(1, 20, { filter: `board='quiz' && week=${q(weekKey())}`, sort: '-n', skipTotal: true })
      .then((r) => setList(r.items.map((x) => ({ uid: x.uid, name: x.name, points: x.n, week: x.week })))).catch(() => setList([]))
  }, [enabled])
  return list
}
