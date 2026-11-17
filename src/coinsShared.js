// الكوينز: الحاجات المشتركة (Firebase وسيرفر PocketBase)
import { serverNow } from './presence.js'

export const WELCOME = 500
export const FEES = [0, 100, 250, 500]
export const DAILY = [100, 150, 200, 250, 300, 400, 1000]
export const FREE_WIN = 50
export const QUIZ_COINS = 20
export const dayNum = () => Math.floor((serverNow() + 7200000) / 86400000)
export const GAME_AR = { ludo: 'لودو', snakes: 'السلم والتعبان', domino: 'دومينو' }

// مكافأة اليوم: النهارده الكام في السلسلة؟
export function dailyState(w) {
  if (!w) return null
  const today = dayNum()
  if (w.day === today) return { claimed: true, streak: w.streak }
  const streak = w.day === today - 1 ? (w.streak % 7) + 1 : 1
  return { claimed: false, streak, reward: DAILY[streak - 1] }
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
