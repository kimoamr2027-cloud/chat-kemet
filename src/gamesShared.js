// مسابقة كيمت: الحاجات المشتركة (Firebase وسيرفر PocketBase)
import { serverNow } from './presence.js'
export { GAME_TYPES }
import { BANK, GAME_TYPES } from './gameBank.js'
export const ROUND_MS = 45 * 1000 // وقت السؤال
export const GAP_MS = 6 * 1000 // استراحة بين الأسئلة

// نوحّد الكتابة: أ/إ/آ = ا، ة = ه، ى = ي، من غير تشكيل ولا مسافات ولا علامات
export function normalize(s) {
  return String(s || '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[^\p{L}\p{N}]/gu, '')
}

export async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// كل الأشكال المقبولة للإجابة (بـ "ال" ومن غيرها)
function variants(answers) {
  const out = new Set()
  for (const a of answers) {
    const n = normalize(a)
    if (!n) continue
    out.add(n)
    if (n.startsWith('ال') && n.length > 4) out.add(n.slice(2))
    else if (!/^[0-9a-z]/.test(n)) out.add('ال' + n)
  }
  return [...out].slice(0, 8)
}

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// نلخبط حروف الكلمة (ومانرجعهاش زي ما هي)
function scramble(word) {
  const letters = [...word.replace(/\s+/g, '')]
  let s = letters
  for (let i = 0; i < 10 && s.join('') === letters.join(''); i++) s = shuffle(letters)
  return s.join(' ')
}

// نختار سؤال مااتسألش قبل كده في المسابقة دي
const used = new Map() // roomId -> Set
export const resetUsed = (roomId) => used.delete(roomId)
function pickQuestion(roomId, type) {
  const t = type === 'mix' ? shuffle(['emoji', 'scramble', 'proverb', 'trivia'])[0] : type
  const set = used.get(roomId) || new Set()
  used.set(roomId, set)
  let pool = BANK[t].filter((q) => !set.has(t + q.p))
  if (!pool.length) { for (const k of [...set]) if (k.startsWith(t)) set.delete(k); pool = BANK[t] }
  const q = pool[Math.floor(Math.random() * pool.length)]
  set.add(t + q.p)
  return { t, q }
}

export async function buildRound(roomId, type, round, total, me, myName) {
  const { t, q } = pickQuestion(roomId, type)
  const hashes = await Promise.all(variants(q.a).map(sha256))
  const prompt = t === 'scramble' ? scramble(q.p) : q.p
  const hint = t === 'scramble' ? `${[...q.p.replace(/\s+/g, '')].length} حروف` : (q.h || '')
  return {
    type: t, prompt, hint, hashes, round, total, status: 'open',
    startedBy: me, startedByName: myName,
    answer: '', winner: '', winnerName: '', solvedAt: null,
    _mode: type,
  }
}

const sorted = (w) => [...w.replace(/\s+/g, '')].sort().join('')
// الإجابة اللي بتتعرض للناس (من البنك)
export function displayAnswer(game) {
  if (!game) return ''
  const list = BANK[game.type] || []
  const q = game.type === 'scramble'
    ? list.find((x) => sorted(x.p) === sorted(game.prompt))
    : list.find((x) => x.p === game.prompt)
  return q?.a[0] || game.answer || ''
}

// رقم الأسبوع (ترتيب الأسبوع بيبدأ من جديد كل أسبوع)
export function weekKey(ms = serverNow()) {
  const d = new Date(ms)
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y = t.getUTCFullYear()
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)
  return `${y}-W${String(w).padStart(2, '0')}`
}

// الإجابة ممكن تكون جوه جملة ("أكيد الفيل الأزرق يا جماعة"): بنجرب كل مجموعة كلمات ورا بعض
export async function matchAnswer(game, text) {
  const words = String(text).split(/\s+/).filter(Boolean).slice(0, 30)
  const cands = new Set([normalize(text)])
  for (let i = 0; i < words.length; i++) {
    for (let k = 1; k <= 6 && i + k <= words.length; k++) cands.add(normalize(words.slice(i, i + k).join(' ')))
  }
  let n = ''
  let h = ''
  for (const c of cands) {
    if (!c || c.length > 100) continue
    const x = await sha256(c)
    if (game.hashes?.includes(x)) { n = c; h = x; break }
  }
  return { n, h }
}
