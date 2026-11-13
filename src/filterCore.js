// فلتر الشتايم: بيحوّل الكلمات الممنوعة لنمط بيمسك التحايل
// (ا/أ/إ/آ، ه/ة، ي/ى/ئ، و/ؤ، المطّ ـــ، المسافات والتشكيل بين الحروف)
const GROUPS = ['اأإآٱ', 'هة', 'يىئ', 'وؤ']
const SEP = '[ـ\\sًٌٍَُِّْ]*'
const escapeRe = (c) => c.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')

function charPattern(ch) {
  const g = GROUPS.find((x) => x.includes(ch))
  return g ? `[${g}]` : escapeRe(ch)
}

export function normalizeWord(w) {
  return w.toLowerCase().replace(/[ـًٌٍَُِّْ\s]/g, '').trim()
}

function wordPattern(w) {
  return [...normalizeWord(w)].map(charPattern).join(SEP)
}

// الكلمة كاملة بس (علشان «كلبش» ماتتمسكش بسبب «كلب»)، مع البدايات والنهايات المشهورة
const EDGE_L = '(^|[^ء-يa-z0-9])'
const EDGE_R = '($|[^ء-يa-z0-9])'
const PREFIX = '(وال|بال|فال|يا|ال|لل|و|ف|ب|ل)?'
const SUFFIX = '(ين|ون|ات|كم|ها|هم|ة|ه|ك|ي|ا|و|es|s)?'

// النمط الأساسي (من غير flags)
export function corePattern(words) {
  const list = [...new Set(words.map(normalizeWord).filter(Boolean))]
  return list.length ? `${EDGE_L}${PREFIX}${SEP}(${list.map(wordPattern).join('|')})${SEP}${SUFFIX}${EDGE_R}` : ''
}

// النمط اللي بيتحفظ للسيرفر (Security Rules بتستخدم RE2 وبتطابق النص كله)
export const rulesPattern = (words) => {
  const core = corePattern(words)
  return core ? `(?s).*${core}.*` : ''
}


// فيها كلمة ممنوعة؟
export function hasBadWord(text, words) {
  const core = corePattern(words)
  if (!core) return false
  try { return new RegExp(core, 's').test(text.toLowerCase()) } catch { return false }
}
