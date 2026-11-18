// الكوينز: الحاجات المشتركة (Firebase وسيرفر PocketBase)
import { serverNow } from './presence.js'

export const WELCOME = 500
export const FEES = [0, 100, 250, 500]
export const DAILY = [100, 150, 200, 250, 300, 400, 1000]
export const FREE_WIN = 50
export const QUIZ_COINS = 20
export const dayNum = () => Math.floor((serverNow() + 7200000) / 86400000)
export const GAME_AR = { ludo: 'لودو', snakes: 'السلم والتعبان', domino: 'دومينو' }

// هدية التسجيل: كل يوم هدية لمدة ٧ أيام من يوم ما العضو سجّل، وبعدها بتختفي
// joined = تاريخ التسجيل. اليوم الكام من السبعة = النهارده - يوم التسجيل + ١ (ولو فوّت يوم هديته بتروح)
export const dayOf = (at) => { const ms = typeof at === 'number' ? at : new Date(String(at).replace(' ', 'T')).getTime(); return Math.floor((ms + 7200000) / 86400000) }
export function dailyState(w, joined) {
  if (!w) return null
  if (!joined) return { claimed: true, over: true }
  const today = dayNum()
  const n = today - dayOf(joined) + 1
  if (!(n >= 1 && n <= DAILY.length)) return { claimed: true, over: true }
  if (w.day === today) return { claimed: true, streak: n }
  return { claimed: false, streak: n, reward: DAILY[n - 1] }
}

// الحصالة: الدخولية × اللي دفعوا (الأدمن مابيدفعش، واللي رجعتله فلوسه مايتحسبش)
export function potOf(t, admins) {
  const fee = t.fee || 0
  if (!fee) return FREE_WIN
  const paid = t.seats.filter((u) => !admins.includes(u) && !t.refunded?.[u]).length
  return fee * paid
}

// رجوع الدخولية لوحدها: لو الترابيزة اتلغت أو الأدمن كسب
export function needsRefund(t, uid, admins) {
  if (!t || !(t.fee > 0) || !t.seats?.includes(uid) || t.refunded?.[uid] || admins.includes(uid)) return false
  return t.status === 'cancelled' || (t.status === 'done' && admins.includes(t.winner))
}
