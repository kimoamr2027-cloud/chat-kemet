// لودو والسلم والتعبان (وأساس الدومينو) من سيرفر PocketBase (نفس شكل src/ludo.js)
// السيرفر بيرمي النرد ويتأكد من كل نقلة ويحسب الكوينز
import { useEffect, useState } from 'react'
import { pb, q, live, toDate } from './client.js'
import { weekKey } from '../gamesShared.js'
import { sendDM } from '../dm.js'
import { sendRoomMessage } from '../rooms.js'
import { notify } from '../notifs.js'
import { MODES, GAME_NAMES, GAME_ICONS } from '../ludoShared.js'
import { isLocal, useLocalTable, localRoll, localMove, localPass, localLeave, localClose } from '../localGames.js'
export {
  TURN_MS, GAME_NAMES, GAME_ICONS, MODES, LUCK_BONUS, LUCK_SKULL, COLOR_NAMES, COLOR_AR, COLOR_HEX, colorsFor, colorIdx, PATH, SAFE,
  absOf, spotOf, canMove, legalPieces, nextSeat, LADDERS, SNAKES, snJump, snTo, snCell,
} from '../ludoShared.js'

// الشاشات متعودة على وقت Firestore (‎.toMillis())
const ms = (v) => (typeof v === 'number' ? v : toDate(v)?.getTime())
const stamp = (v) => { const t = ms(v); return t ? { toMillis: () => t, toDate: () => new Date(t) } : null }
export function toTable(r) {
  const st = r.state || {}
  return {
    ...st, id: r.id, kind: r.kind, status: r.status, host: r.host, seats: r.seats || [], left: st.left || {}, names: st.names || {},
    createdAt: stamp(r.created), turnAt: stamp(st.turnAt), blockedAt: stamp(st.blockedAt), finishedAt: stamp(st.finishedAt),
    rolledAt: st.rollN ? { seconds: st.rollN, nanoseconds: 0 } : null, pending: false,
  }
}
export const game = (action, body) => pb.send('/api/kemet/game', { method: 'POST', body: { action, ...body } })

// النرد من السيرفر
export const diceOf = (t) => (t?.rolledAt ? t.dice || 0 : 0)

// ===== التخزين =====
export function useTable(id, kind = 'ludo') {
  const [t, setT] = useState(undefined)
  // لعبة على الموبايل (ضد الكمبيوتر أو على نفس الموبايل)
  const local = useLocalTable(isLocal(id) ? id : null)
  useEffect(() => {
    if (!id || isLocal(id)) return
    setT(undefined)
    pb.collection('tables').getOne(id).then((r) => setT(r.kind === kind ? toTable(r) : null)).catch(() => setT(null))
    return live('tables', id, (ev) => setT(ev.action === 'delete' ? null : toTable(ev.record)))
  }, [id, kind])
  return isLocal(id) ? local : t
}

// قايمة بتتحدّث لما حاجة تتغير (ومرة كل ١٥ ثانية علشان اللي اتملت أو بدأت تختفي)
function useTableList(filter, map, deps) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!filter) return
    let alive = true
    let soon = null
    const load = () => pb.collection('tables').getList(1, 40, { filter, sort: '-created', skipTotal: true })
      .then((r) => alive && setList(map(r.items.map(toTable)))).catch(() => alive && setList([]))
    load()
    const t = setInterval(load, 15000)
    const off = live('tables', '*', () => { clearTimeout(soon); soon = setTimeout(load, 400) }, { filter })
    return () => { alive = false; clearInterval(t); clearTimeout(soon); off() }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return list
}

export function useOpenTables(kind = 'ludo') {
  return useTableList(`kind=${q(kind)} && status='waiting'`, (l) => {
    const now = Date.now()
    return l.filter((t) => t.seats.length < t.size && now - (t.createdAt?.toMillis() || now) < 20 * 60 * 1000)
  }, [kind])
}

export function useMyTables(uid, kind = 'ludo') {
  const list = useTableList(uid ? `kind=${q(kind)} && seats~${q('"' + uid + '"')} && status!='done' && status!='cancelled'` : '', (l) => l.filter((t) => !t.left?.[uid]), [uid, kind])
  return list || []
}

export function useLudoBoard(enabled = true, kind = 'ludo') {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return
    pb.collection('scores').getList(1, 30, { filter: `board=${q(kind)} && week=${q(weekKey())}`, sort: '-n', skipTotal: true })
      .then((r) => setList(r.items.map((x) => ({ uid: x.uid, name: x.name, wins: x.n, week: x.week })))).catch(() => setList([]))
  }, [enabled, kind])
  return list
}

export function useTableChat(id) {
  const [msgs, setMsgs] = useState([])
  useEffect(() => {
    if (!id || isLocal(id)) return
    const load = () => pb.collection('tablechat').getList(1, 15, { filter: `table=${q(id)}`, sort: '-created', skipTotal: true })
      .then((r) => setMsgs(r.items.map((x) => ({ id: x.id, uid: x.uid, name: x.name, text: x.text, at: stamp(x.created) })).reverse())).catch(() => setMsgs([]))
    load()
    return live('tablechat', '*', load, { filter: `table=${q(id)}` })
  }, [id])
  return msgs
}
export const sendTableChat = (id, uid, name, text) => (isLocal(id) ? Promise.resolve() : game('chat', { id, text: text.slice(0, 120) }))

// ===== الحركات (السيرفر بيتأكد من كل حاجة، والأدمن بيعرفه السيرفر لوحده) =====
export const createTable = ({ size, room = '', kind = 'ludo', mode = 'classic', fee = 0 }) =>
  game('create', { kind, size, room, mode, fee }).then((r) => r.id)
export const joinTable = (id) => game('join', { id })
// العب على طول: أول ترابيزة مستنية بنفس النوع، ولو كلهم اتملوا بتتفتح جديدة
export const quickPlay = ({ kind = 'ludo', size = 4, mode = 'classic', fee = 0 }) => game('quick', { kind, size, mode, fee }).then((r) => r.id)
// في اللعب على الموبايل: الحركة دايمًا لصاحب الدور (انت أو صاحبك اللي جنبك)
const cur = (t) => t.seats[t.turn]
export const startNow = (t) => (t.local ? Promise.resolve() : game('start', { id: t.id }))
export const rollDice = (t) => (t.local ? localRoll(t, cur(t)) : game('roll', { id: t.id }))
export const passTurn = (t) => (t.local ? localPass(t, cur(t)) : game('pass', { id: t.id }))
export const leaveTable = (t) => (t.local ? localLeave(t) : game('leave', { id: t.id }))
export const claimWin = (t) => (t.local ? Promise.resolve() : game('claim', { id: t.id }))
export const closeTable = (id) => (isLocal(id) ? localClose() : game('close', { id }))
export const movePiece = (t, piece) => (t.local ? localMove(t, cur(t), piece) : game('move', { id: t.id, piece }))
export const moveSnake = (t) => (t.local ? localMove(t, cur(t)) : game('move', { id: t.id }))

// ===== الدعوات =====
export function inviteRoom(roomId, profile, uid, tableId, size, kind = 'ludo', mode = 'classic') {
  const nm = mode !== 'classic' && MODES[mode] ? `${GAME_NAMES[kind]} ${MODES[mode].name}` : GAME_NAMES[kind]
  return sendRoomMessage(roomId, profile, uid, { kind, table: tableId, text: `${GAME_ICONS[kind]} ${profile.name} فاتح ترابيزة ${nm} (${size === 2 ? '١ ضد ١' : '٤ لاعبين'})` })
}
export async function inviteDM(me, myName, other, tableId, kind = 'ludo') {
  const text = `${GAME_ICONS[kind]} ${myName} بيتحدّاك في ${GAME_NAMES[kind]}!`
  const msgId = await sendDM({ me, other, kind, text, table: tableId })
  notify(other, me, myName, { type: 'dm', msgId, text }, `dm_${me}`)
}
