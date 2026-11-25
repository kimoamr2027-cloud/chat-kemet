// الاسم بالهيروغليفي: كل حرف عربي بيقابله الحرف الفرعوني الأقرب (الأبجدية الفرعونية المعروفة)
const MAP = {
  'ا': '𓄿', 'أ': '𓄿', 'إ': '𓇋', 'آ': '𓄿', 'ء': '𓄿', 'ؤ': '𓅱', 'ئ': '𓇌',
  'ب': '𓃀', 'ت': '𓏏', 'ث': '𓏏', 'ة': '𓏏', 'ط': '𓍿', 'ج': '𓆓', 'ح': '𓎛', 'خ': '𓐍',
  'د': '𓂧', 'ض': '𓂧', 'ذ': '𓊃', 'ز': '𓊃', 'ظ': '𓊃', 'ر': '𓂋', 'س': '𓋴', 'ص': '𓋴', 'ش': '𓈙',
  'ع': '𓂝', 'غ': '𓎼', 'ف': '𓆑', 'ق': '𓈎', 'ك': '𓎡', 'ل': '𓃭', 'م': '𓅓', 'ن': '𓈖',
  'ه': '𓉔', 'و': '𓅱', 'ي': '𓇌', 'ى': '𓇌',
  a: '𓄿', b: '𓃀', c: '𓎡', d: '𓂧', e: '𓇋', f: '𓆑', g: '𓎼', h: '𓉔', i: '𓇋', j: '𓆓', k: '𓎡', l: '𓃭', m: '𓅓',
  n: '𓈖', o: '𓅱', p: '𓊪', q: '𓈎', r: '𓂋', s: '𓋴', t: '𓏏', u: '𓅱', v: '𓆑', w: '𓅱', x: '𓎡𓋴', y: '𓇌', z: '𓊃',
}
export function toHiero(name) {
  return [...String(name || '').toLowerCase()].map((ch) => (ch === ' ' ? ' ' : MAP[ch] || '')).join('').replace(/\s+/g, ' ').trim()
}
// الخط بتاع الحروف الفرعونية (بيتحمّل مرة واحدة بس لما نحتاجه)
export const HIERO_FONT = '"Noto Sans Egyptian Hieroglyphs"'
let loading = null
export function loadHieroFont() {
  if (loading) return loading
  if (!document.querySelector('link[data-hiero]')) {
    const l = document.createElement('link')
    l.rel = 'stylesheet'; l.dataset.hiero = '1'
    l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Egyptian+Hieroglyphs&display=swap'
    document.head.appendChild(l)
  }
  loading = new Promise((ok) => setTimeout(ok, 50)).then(() => document.fonts?.load(`48px ${HIERO_FONT}`, '𓂀𓄿')).catch(() => {})
  return loading
}
