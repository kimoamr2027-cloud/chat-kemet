// حاجات الإشعارات المشتركة بين Firebase وسيرفر PocketBase
import { ar } from './utils.js'

export function notifTarget(n) {
  if (n.type === 'friend') return `/u/${n.from}`
  return n.type === 'dm' || n.type === 'welcome' ? `/dm/${n.from}` : `/rooms/${n.roomId}`
}

export function notifAction(n) {
  if (n.type === 'dm') return 'بعتلك رسالة خاصة'
  if (n.type === 'reply') return `رد على رسالتك في ${n.roomName}`
  if (n.type === 'mention') return `ذكر اسمك في ${n.roomName}`
  if (n.type === 'react') return `تفاعل بـ ${n.emoji} على رسالتك في ${n.roomName}`
  if (n.type === 'mod') return `خلّاك مشرف في ${n.roomName} 🛡`
  if (n.type === 'invite') return `بيدعوك تدخل ${n.roomName} 🙌`
  if (n.type === 'welcome') return 'بيرحّب بيك في كيمت 👋 — دوس ورد عليه'
  if (n.type === 'friend') return n.text === 'ok' ? 'قبل طلب الصداقة 🎉 بقيتوا أصحاب' : 'بعتلك طلب صداقة 🤝 — دوس علشان تقبله'
  return ''
}

// "من ٥ دقايق"
export function ago(d) {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'دلوقتي'
  const m = Math.floor(s / 60)
  if (m < 60) return m === 1 ? 'من دقيقة' : m === 2 ? 'من دقيقتين' : `من ${ar(m)} دقايق`
  const h = Math.floor(m / 60)
  if (h < 24) return h === 1 ? 'من ساعة' : h === 2 ? 'من ساعتين' : `من ${ar(h)} ساعات`
  const days = Math.floor(h / 24)
  if (days === 1) return 'أمس'
  if (days < 7) return `من ${ar(days)} أيام`
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })
}

// صوت تنبيه صغير
export { playNotif as beep } from './sound.js'
