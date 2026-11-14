// سجل أخطاء صغير: أي غلط بيحصل عند الأعضاء بيتسجّل علشان نعرف نصلّحه
// (من غير أي رسايل أو بيانات شخصية، بس مكان الغلط ونوعه)
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db, auth } from './firebase.js'

let count = 0
const VER = (document.querySelector('script[type="module"][src*="assets/index-"]')?.src || '').split('/').pop().slice(0, 30)

export function logDiag(where, err, extra) {
  try {
    if (!auth.currentUser || count >= 25) return
    count++
    const msg = `${err?.code || ''} ${err?.message || err || ''}`.trim().slice(0, 300)
    const info = extra === undefined ? '' : (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300)
    addDoc(collection(db, 'diag'), {
      uid: auth.currentUser.uid, where: String(where).slice(0, 60), msg, info,
      ua: navigator.userAgent.slice(0, 200), ver: VER, at: serverTimestamp(),
    }).catch(() => {})
  } catch {}
}

// ملخص حالة ترابيزة لودو (من غير بيانات شخصية)
export const ludoInfo = (t, seat) => t && ({ st: t.status, turn: t.turn, ph: t.phase, seat, n: t.seats?.length, pend: t.pending, last: t.last })

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => logDiag('window.error', e.error || e.message, `${e.filename || ''}:${e.lineno || ''}`))
  window.addEventListener('unhandledrejection', (e) => logDiag('promise', e.reason))
}
