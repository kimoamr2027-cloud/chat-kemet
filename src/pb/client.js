// الاتصال بسيرفر PocketBase بتاعنا (على Oracle)
// الدخول نفسه لسه بجوجل/Firebase، وبعدين بنبدّل توكن Firebase بتوكن PocketBase
import PocketBase from 'pocketbase'

export const PB_URL = import.meta.env.VITE_PB_URL || 'https://158-101-231-239.sslip.io'
export const pb = new PocketBase(PB_URL)
pb.autoCancellation(false)
if (import.meta.env.VITE_USE_EMULATOR) window.__pb = pb

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
// كل اشتراك (نفس المجموعة والفلتر) بيتعمل مرة واحدة ويتشارك بين الشاشات،
// والإلغاء بيستنى ٣ ثواني: مكتبة PocketBase فيها مشكلة لو اشتراك اتلغى واتعمل تاني
// بنفس الشكل بسرعة (الشاشة بتبطّل تسمع من غير ما حد يحس)
const subs = new Map()
export function live(collection, topic, cb, opts) {
  const key = `${collection}|${topic}|${JSON.stringify(opts || {})}`
  let s = subs.get(key)
  if (!s) {
    s = { cbs: new Set(), unsub: null, timer: null, dead: false }
    subs.set(key, s)
    const me = s
    pb.collection(collection).subscribe(topic, (ev) => me.cbs.forEach((f) => f(ev)), opts)
      .then((u) => { me.unsub = u; if (me.dead) u() })
      .catch(() => { if (subs.get(key) === me) subs.delete(key) })
  }
  clearTimeout(s.timer)
  const w = (ev) => cb(ev)
  s.cbs.add(w)
  return () => {
    s.cbs.delete(w)
    if (s.cbs.size) return
    clearTimeout(s.timer)
    s.timer = setTimeout(() => {
      if (s.cbs.size || subs.get(key) !== s) return
      subs.delete(key)
      s.dead = true
      if (s.unsub) s.unsub()
    }, 3000)
  }
}

// ===== ذاكرة على الموبايل: الشاشة بتفتح على طول بآخر حاجة شفناها، وبعدين بتتحدّث من السيرفر =====
const CK = 'kemet-c1-'
export function cacheGet(key) {
  try { return JSON.parse(localStorage.getItem(CK + key) || 'null') } catch { return null }
}
export function cacheSet(key, value) {
  try { localStorage.setItem(CK + key, JSON.stringify(value)) } catch {
    // الذاكرة اتملت: نمسح الذاكرة القديمة بتاعتنا ونجرب تاني
    try { for (const k of Object.keys(localStorage)) if (k.startsWith(CK)) localStorage.removeItem(k); localStorage.setItem(CK + key, JSON.stringify(value)) } catch {}
  }
}
