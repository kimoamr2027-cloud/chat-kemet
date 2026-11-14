// الكوينز: هدية البداية، مكافأة اليوم، دخولية الترابيزات، المكسب، والمسابقة
// كل حركة السيرفر بيتأكد منها (قواعد wallets في firestore.rules)
// الأدمن رصيده غير محدود: مابيدفعش دخولية، وبيهادي الأعضاء
import { useEffect, useState } from 'react'
import {
  collection, doc, getDoc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, where,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { serverNow } from './presence.js'

export const WELCOME = 500
export const FEES = [0, 100, 250, 500]
export const DAILY = [100, 150, 200, 250, 300, 400, 1000]
export const FREE_WIN = 50
export const QUIZ_COINS = 20
export const dayNum = () => Math.floor((serverNow() + 7200000) / 86400000)

const wRef = (uid) => doc(db, 'wallets', uid)
const logRef = (uid) => doc(collection(db, 'wallets', uid, 'log'))
const logEntry = (amount, kind, note) => ({ amount, kind, note: String(note || '').slice(0, 80), at: serverTimestamp() })

// المحفظة (ولو مش موجودة بتتعمل بهدية البداية)
let creating = false
export function useWallet(uid) {
  const [w, setW] = useState(undefined)
  useEffect(() => {
    if (!uid) return
    return onSnapshot(wRef(uid), (s) => {
      if (s.exists()) return setW(s.data())
      setW(null)
      if (creating) return
      creating = true
      setDoc(wRef(uid), { coins: WELCOME, day: 0, streak: 0, op: 'welcome', refColl: '', refId: '', amount: 0, at: serverTimestamp() })
        .then(() => setDoc(logRef(uid), logEntry(WELCOME, 'welcome', 'هدية الترحيب')))
        .catch(() => {}).finally(() => { creating = false })
    }, () => setW(null))
  }, [uid])
  return w
}

// مكافأة اليوم: النهارده الكام في السلسلة؟
export function dailyState(w) {
  if (!w) return null
  const today = dayNum()
  if (w.day === today) return { claimed: true, streak: w.streak }
  const streak = w.day === today - 1 ? (w.streak % 7) + 1 : 1
  return { claimed: false, streak, reward: DAILY[streak - 1] }
}
export function claimDaily(uid) {
  return runTransaction(db, async (tx) => {
    const s = await tx.get(wRef(uid))
    const w = s.data()
    const st = dailyState(w)
    if (!st || st.claimed) throw new Error('claimed')
    tx.update(wRef(uid), { coins: w.coins + st.reward, day: dayNum(), streak: st.streak, op: 'daily', at: serverTimestamp() })
    tx.set(logRef(uid), logEntry(st.reward, 'daily', `مكافأة اليوم (يوم ${'١٢٣٤٥٦٧'[st.streak - 1]})`))
    return st.reward
  })
}

export function useCoinLog(uid, enabled = true) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!uid || !enabled) return
    return onSnapshot(query(collection(db, 'wallets', uid, 'log'), orderBy('at', 'desc'), limit(40)),
      (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))), () => setList([]))
  }, [uid, enabled])
  return list
}
export function useRichest(enabled = true) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(query(collection(db, 'wallets'), orderBy('coins', 'desc'), limit(20)),
      (s) => setList(s.docs.map((d) => ({ uid: d.id, coins: d.data().coins }))), () => setList([]))
  }, [enabled])
  return list
}

// هدية من الأدمن
export function giftCoins(uid, amount) {
  return runTransaction(db, async (tx) => {
    const s = await tx.get(wRef(uid))
    if (!s.exists()) throw new Error('no-wallet')
    tx.update(wRef(uid), { coins: s.data().coins + amount, op: 'gift', amount, at: serverTimestamp() })
    tx.set(logRef(uid), logEntry(amount, 'gift', 'هدية من الأدمن 🎁'))
  })
}

// ===== جوه الترانزاكشن (القراية الأول وبعدين الكتابة) =====
export async function txAdmins(tx) {
  const r = await tx.get(doc(db, 'config', 'roles'))
  return r.exists() ? r.data().admins || [] : []
}
export async function txWallet(tx, uid) {
  const s = await tx.get(wRef(uid))
  return s.exists() ? s.data() : null
}
export const GAME_AR = { ludo: 'لودو', snakes: 'السلم والتعبان', domino: 'دومينو' }
export function txPay(tx, uid, w, fee, coll, id) {
  if (!w || w.coins < fee) throw new Error('coins')
  tx.update(wRef(uid), { coins: w.coins - fee, op: 'pay', refColl: coll, refId: id, at: serverTimestamp() })
  tx.set(logRef(uid), logEntry(-fee, 'fee', `دخولية ترابيزة ${GAME_AR[coll]}`))
}
export function txRefund(tx, uid, w, fee, coll, id) {
  tx.update(wRef(uid), { coins: w.coins + fee, op: 'refund', refColl: coll, refId: id, at: serverTimestamp() })
  tx.set(logRef(uid), logEntry(fee, 'refund', `رجوع دخولية ${GAME_AR[coll]}`))
}
// الحصالة: الدخولية × اللي دفعوا (الأدمن مابيدفعش، واللي رجعتله فلوسه مايتحسبش)
export function potOf(t, admins) {
  const fee = t.fee || 0
  if (!fee) return FREE_WIN
  const paid = t.seats.filter((u) => !admins.includes(u) && !t.refunded?.[u]).length
  return fee * paid
}
export function txWin(tx, uid, w, t, admins) {
  if (!w || admins.includes(uid)) return 0
  const pot = potOf(t, admins)
  tx.update(wRef(uid), { coins: w.coins + pot, op: 'win', refColl: t.kind, refId: t.id, at: serverTimestamp() })
  tx.set(logRef(uid), logEntry(pot, 'win', `كسبت ${GAME_AR[t.kind]}${t.fee ? ` (ترابيزة ${t.fee})` : ''}`))
  return pot
}
export function txQuiz(tx, uid, w, roomId) {
  tx.update(wRef(uid), { coins: w.coins + QUIZ_COINS, op: 'quiz', refColl: 'quiz', refId: roomId, at: serverTimestamp() })
  tx.set(logRef(uid), logEntry(QUIZ_COINS, 'quiz', 'إجابة صح في مسابقة كيمت'))
}

// رجوع الدخولية لوحدها: لو الترابيزة اتلغت أو الأدمن كسب
export function needsRefund(t, uid, admins) {
  if (!t || !(t.fee > 0) || !t.seats?.includes(uid) || t.refunded?.[uid] || admins.includes(uid)) return false
  return t.status === 'cancelled' || (t.status === 'done' && admins.includes(t.winner))
}
export function refundTable(t, uid) {
  const ref = doc(db, t.kind, t.id)
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref)
    const w = await txWallet(tx, uid)
    if (!s.exists() || !w) return
    const cur = { ...s.data(), id: t.id, kind: t.kind }
    if (cur.refunded?.[uid]) return
    tx.update(ref, { [`refunded.${uid}`]: true })
    txRefund(tx, uid, w, cur.fee, t.kind, t.id)
  })
}
// بيدوّر على أي فلوس ليك لسه مارجعتش (بيشتغل مرة لما التطبيق يفتح)
export function useAutoRefunds(uid, admins, loaded) {
  useEffect(() => {
    if (!uid || !loaded) return
    const unsubs = ['ludo', 'snakes', 'domino'].map((kind) => onSnapshot(
      query(collection(db, kind), where('seats', 'array-contains', uid), limit(30)),
      (s) => s.docs.forEach((d) => {
        const t = { id: d.id, kind, ...d.data() }
        if (needsRefund(t, uid, admins)) refundTable(t, uid).catch(() => {})
      }), () => {}))
    return () => unsubs.forEach((u) => u())
  }, [uid, loaded, admins.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
}

export const getWallet = async (uid) => { const s = await getDoc(wRef(uid)); return s.exists() ? s.data() : null }
