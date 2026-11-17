// حاجات مشتركة للأدوار (من غير اتصال بسيرفر)
export const EMPTY_ROLES = { admins: [], mods: {}, loaded: false }

export const isAdminUid = (roles, uid) => roles.admins.includes(uid)
export const isModUid = (roles, roomId, uid) => (roles.mods?.[roomId] || []).includes(uid)
export const canModerate = (roles, roomId, uid) => isAdminUid(roles, uid) || isModUid(roles, roomId, uid)
export function roleOf(roles, roomId, uid) {
  if (isAdminUid(roles, uid)) return 'admin'
  if (roomId && isModUid(roles, roomId, uid)) return 'mod'
  return null
}

export function timeLeft(until) {
  const m = Math.max(1, Math.round((until.getTime() - Date.now()) / 60000))
  if (m < 60) return `${m} دقيقة`
  const h = Math.round(m / 60)
  if (h < 24) return h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : `${h} ساعات`
  const d = Math.round(h / 24)
  return d === 1 ? 'يوم' : d === 2 ? 'يومين' : `${d} أيام`
}
