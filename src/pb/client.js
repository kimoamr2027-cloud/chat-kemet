// الاتصال بسيرفر PocketBase بتاعنا (على Oracle)
// الدخول نفسه لسه بجوجل/Firebase، وبعدين بنبدّل توكن Firebase بتوكن PocketBase
import PocketBase from 'pocketbase'

export const PB_URL = import.meta.env.VITE_PB_URL || 'https://158-101-231-239.sslip.io'
export const pb = new PocketBase(PB_URL)
pb.autoCancellation(false)

let pending = null
// بيتنادى بعد ما Firebase يقول إن العضو داخل
export function pbLogin(fbUser) {
  if (!fbUser) { pb.authStore.clear(); return Promise.resolve(null) }
  if (pb.authStore.isValid && pb.authStore.record?.id === fbUser.uid) return Promise.resolve(pb.authStore.record)
  if (pending) return pending
  pending = fbUser.getIdToken()
    .then((idToken) => pb.send('/api/kemet/auth', { method: 'POST', body: { idToken } }))
    .then((r) => { pb.authStore.save(r.token, r.record); return r.record })
    .finally(() => { pending = null })
  return pending
}
export const pbReady = () => pending || Promise.resolve(pb.authStore.record)

// تاريخ PocketBase ("2026-11-17 14:28:46.354Z") ← Date
export const toDate = (s) => (s ? new Date(String(s).replace(' ', 'T')) : null)
export const pbTime = (d) => d.toISOString().replace('T', ' ')
// قيمة نص جوه فلتر (من غير ما حد يكسر الفلتر)
export const q = (v) => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

// اشتراك لحظي في مجموعة (بيرجّع دالة إلغاء)
export function live(collection, topic, cb, opts) {
  let off = null
  let dead = false
  pb.collection(collection).subscribe(topic, cb, opts).then((u) => { if (dead) u(); else off = u }).catch(() => {})
  return () => { dead = true; if (off) off() }
}
