// VIP كيمت: ٦ مستويات بتتشرى بالكوينز لمدة ٣٠ يوم (الأسعار الحقيقية على السيرفر: server/pb_hooks/viplib.js)
// كل التطبيق بيقرا قايمة واحدة بس (الـ VIP الشغالين) علشان يفضل خفيف
import { useSyncExternalStore } from 'react'
import { pb, live } from './pb/client.js'

export const VIP_LEVELS = [
  { level: 1, name: 'الكاتب', icon: '📜', price: 1000, c: '#B8763A', c2: '#F0B47A', c3: '#9A5A1E', d1: '#2A1608', d2: '#4A2A10', perk: 'شارة VIP جنب اسمك، وشريط «منوّر» لما تدخل الغرفة' },
  { level: 2, name: 'الكاهن', icon: '🪬', price: 2000, c: '#9AA6B8', c2: '#E8EEF6', c3: '#5E6F88', d1: '#161B24', d2: '#2A3240', perk: 'اسمك ملوّن في الشات' },
  { level: 3, name: 'القائد', icon: '⚔️', price: 3500, c: '#D4A23C', c2: '#FFE08A', c3: '#B07A12', d1: '#2A1A04', d2: '#4A3009', perk: 'برواز دهب حوالين صورتك' },
  { level: 4, name: 'الوزير', icon: '🏺', price: 5000, c: '#2FA88A', c2: '#9BF0D6', c3: '#147A60', d1: '#06231C', d2: '#0E3F33', perk: 'صوت مميز لما تدخل الغرفة' },
  { level: 5, name: 'الأمير', icon: '💎', price: 8000, c: '#3D6BFF', c2: '#B9CCFF', c3: '#2447C8', d1: '#0A1440', d2: '#182A78', perk: 'تقعد على كرسي في الغرفة الصوتية من غير ما تستنى موافقة' },
  { level: 6, name: 'الفرعون', icon: '👑', price: 12000, c: '#E5392F', c2: '#FFD27A', c3: '#B0201A', d1: '#2A0606', d2: '#5A1010', perk: 'دخول ملكي بعربة الفرعون، وتاج 👑 جنب اسمك في كل حتة' },
]
// صور الشارات (اللي اختارها الأدمن) — المستوى اللي مالوش صورة بيفضل بالشارة المرسومة
const BASE = import.meta.env.BASE_URL
const BADGES = [1, 2, 3, 4, 5, 6] // أرقام المستويات اللي ليها صورة في public/vip
for (const l of VIP_LEVELS) if (BADGES.includes(l.level)) { l.badge = `${BASE}vip/vip${l.level}S.webp`; l.badgeL = `${BASE}vip/vip${l.level}L.webp` }
export const vipInfo = (lv) => VIP_LEVELS[lv - 1] || null
// ستايل الألوان بتاعة المستوى (CSS variables)
export const vipVars = (lv) => { const v = vipInfo(lv); return v ? { '--vc': v.c, '--vc2': v.c2, '--vc3': v.c3, '--vd1': v.d1, '--vd2': v.d2 } : undefined }

const IS_PB = import.meta.env.VITE_BACKEND === 'pb'
const EMPTY = {}
let state = EMPTY
let started = false
const subs = new Set()
const emit = (s) => { state = s; subs.forEach((f) => f()) }

function start() {
  if (started || !IS_PB) return
  started = true
  let soon = null
  const load = async () => {
    try {
      const list = await pb.collection('vips').getFullList({ filter: `until > ${Date.now()}`, fields: 'id,level,until', batch: 500 })
      emit(Object.fromEntries(list.map((x) => [x.id, { level: x.level, until: x.until }])))
    } catch { started = false }
  }
  load()
  live('vips', '*', () => { clearTimeout(soon); soon = setTimeout(load, 800) })
}
function subscribe(f) {
  start()
  subs.add(f)
  return () => subs.delete(f)
}
export function useVips() {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}
// مستوى العضو دلوقتي (٠ = مش VIP)
export const vipLevelOf = (all, uid) => { const v = uid && all[uid]; return v && v.until > Date.now() ? v.level : 0 }
export function useVip(uid) {
  const all = useVips()
  return vipLevelOf(all, uid)
}
export const vipOf = (uid) => (uid && state[uid]) || null

export const buyVip = (level) => pb.send('/api/kemet/vip/buy', { method: 'POST', body: { level } })
export const grantVip = (uid, level, days = 30) => pb.send('/api/kemet/vip/grant', { method: 'POST', body: { uid, level, days } })
