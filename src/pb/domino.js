// الدومينو من سيرفر PocketBase (نفس شكل src/domino.js)
// السيرفر بيوزّع ويخبّي ورق السحب، وكل لاعب يشوف ورقه بس، ولو اتقفلت السيرفر بيعدّ النقط
import { useEffect, useState } from 'react'
import { pb, q, live } from './client.js'
import { game } from './ludo.js'
import { isLocal, useLocalHand, localHands, localPlay, localDraw, localPass } from '../localGames.js'
export { X, lo, hi, pips, ALL, ends, sidesFor, orient } from '../dominoShared.js'

export function useHand(id, uid, enabled = true) {
  const [h, setH] = useState(null)
  const local = useLocalHand(isLocal(id) ? id : null, uid)
  useEffect(() => {
    if (!id || !uid || !enabled || isLocal(id)) return
    const hid = `${id}_${uid}`
    pb.collection('hands').getOne(hid).then((r) => setH({ tiles: r.tiles || [], sum: r.sum })).catch(() => setH(null))
    return live('hands', hid, (ev) => setH(ev.action === 'delete' ? null : { tiles: ev.record.tiles || [], sum: ev.record.sum }))
  }, [id, uid, enabled])
  return isLocal(id) ? local : h
}
// بعد ما اللعبة تخلص الكل يشوف ورق الكل
export async function getHands(t) {
  if (t.local) return localHands(t)
  const out = {}
  try {
    const list = await pb.collection('hands').getFullList({ filter: `table=${q(t.id)}` })
    for (const h of list) out[h.owner] = { tiles: h.tiles || [], sum: h.sum }
  } catch {}
  return out
}

export const createDomino = ({ size, room = '', fee = 0 }) => game('create', { kind: 'domino', size, room, fee }).then((r) => r.id)
export const joinDomino = (id) => game('join', { id })
export const startNowDomino = (t) => game('start', { id: t.id })
export const playTile = (t, uid, hand, x, side) => (t.local ? localPlay(t, t.seats[t.turn], x, side) : game('play', { id: t.id, x, side }))
export const drawTile = (t) => (t.local ? localDraw(t, t.seats[t.turn]) : game('draw', { id: t.id })).then((r) => r.x)
export const passDomino = (t) => (t.local ? localPass(t, t.seats[t.turn]) : game('pass', { id: t.id }))
// التوزيع والكشف وحساب الترابيزة المقفولة بيحصلوا على السيرفر لوحده
export const deal = () => Promise.resolve()
export const reveal = () => Promise.resolve()
export const claimBlocked = () => Promise.resolve()
