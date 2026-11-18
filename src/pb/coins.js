// الكوينز من سيرفر PocketBase (نفس شكل src/coins.js)
// كل الحسابات على السيرفر: الدخولية والمكسب والرجوع بيحصلوا مع الحركة نفسها
import { useEffect, useState } from 'react'
import { pb, q, live, toDate } from './client.js'
import { dailyState as dailyOf } from '../coinsShared.js'
export { WELCOME, FEES, DAILY, FREE_WIN, QUIZ_COINS, dayNum, GAME_AR, potOf, needsRefund } from '../coinsShared.js'
// هدية التسجيل بتتحسب من يوم ما الحساب اتعمل
export const dailyState = (w) => dailyOf(w, pb.authStore.record?.created)

const stamp = (s) => { const d = toDate(s); return d ? { toMillis: () => d.getTime(), toDate: () => d } : null }
const toWallet = (r) => ({ coins: r.coins, day: r.day, streak: r.streak })

// المحفظة (ولو مش موجودة السيرفر بيعملها بهدية البداية)
export function useWallet(uid) {
  const [w, setW] = useState(undefined)
  useEffect(() => {
    if (!uid) return
    pb.send('/api/kemet/wallet', { method: 'POST' })
      .then(() => pb.collection('wallets').getOne(uid)).then((r) => setW(toWallet(r))).catch(() => setW(null))
    return live('wallets', uid, (ev) => setW(ev.action === 'delete' ? null : toWallet(ev.record)))
  }, [uid])
  return w
}

export const claimDaily = () => pb.send('/api/kemet/daily', { method: 'POST' }).then((r) => r.reward)

export function useCoinLog(uid, enabled = true) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!uid || !enabled) return
    const load = () => pb.collection('coinlog').getList(1, 40, { filter: `owner=${q(uid)}`, sort: '-created', skipTotal: true })
      .then((r) => setList(r.items.map((x) => ({ id: x.id, amount: x.amount, kind: x.kind, note: x.note, at: stamp(x.created) })))).catch(() => setList([]))
    load()
    return live('coinlog', '*', load, { filter: `owner=${q(uid)}` })
  }, [uid, enabled])
  return list
}

export function useRichest(enabled = true) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return
    pb.collection('wallets').getList(1, 20, { sort: '-coins', fields: 'id,coins', skipTotal: true })
      .then((r) => setList(r.items.map((x) => ({ uid: x.id, coins: x.coins })))).catch(() => setList([]))
  }, [enabled])
  return list
}

// هدية من الأدمن
export const giftCoins = (uid, amount) => pb.send('/api/kemet/gift', { method: 'POST', body: { uid, amount } })

// الرجوع بيحصل على السيرفر لوحده (لما الترابيزة تتلغي أو الأدمن يكسب)
export function useAutoRefunds() {}
export const refundTable = () => Promise.resolve()

export const getWallet = (uid) => pb.collection('wallets').getOne(uid).then(toWallet).catch(() => null)
