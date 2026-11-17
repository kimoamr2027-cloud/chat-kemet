// حاجات مشتركة بين نسخة Firebase ونسخة PocketBase (من غير أي اتصال بسيرفر)
// الغرف الأساسية (أول نسخة من التطبيق) — دلوقتي الأدمن بيعمل غرف جديدة من التطبيق
export const DEFAULT_ROOMS = {
  pyramids: { name: 'غرفة الأهرامات', order: 1 },
  nile: { name: 'نهر النيل', order: 2 },
  luxor: { name: 'الأقصر وأسوان', order: 3 },
  alex: { name: 'إسكندرية', order: 4 },
  youth: { name: 'شباب كيمت', order: 5 },
  history: { name: 'تاريخ مصر القديمة', order: 6 },
}

export const PAGE = 50

export const preview = (m) => (m.kind === 'sticker' ? 'ستيكر' : m.kind === 'image' ? '📷 صورة' : m.kind === 'voice' ? '🎤 رسالة صوتية' : m.text)

// شكل الوقت: ٩:١٥ م / أمس / الإثنين / ١٢‏/١١
export function fmtTime(d) {
  if (!d) return ''
  return d.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })
}
export function fmtWhen(d) {
  if (!d) return ''
  const now = new Date()
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86400000)
  if (diff <= 0) return fmtTime(d)
  if (diff === 1) return 'أمس'
  if (diff < 7) return d.toLocaleDateString('ar-EG', { weekday: 'long' })
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })
}
export function fmtDay(d) {
  const now = new Date()
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86400000)
  if (diff <= 0) return 'النهارده'
  if (diff === 1) return 'أمس'
  return d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })
}

// لون ثابت لكل عضو حسب الـ uid
export function colorIndex(uid = '') {
  let h = 0
  for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 5
}

export const EDIT_WINDOW_MS = 15 * 60 * 1000
export const canEditMsg = (m) => m.me && m.kind === 'text' && !m.pending && Date.now() - (m.at?.getTime?.() || 0) < EDIT_WINDOW_MS
