// قواعد لودو والسلم والتعبان المشتركة (Firebase وسيرفر PocketBase)
export const TURN_MS = 30 * 1000
// نوع اللعبة: 'ludo' أو 'snakes' (السلم والتعبان) — كل واحدة في مكان لوحدها
export const GAME_NAMES = { ludo: 'لودو', snakes: 'السلم والتعبان', domino: 'دومينو' }
export const GAME_ICONS = { ludo: '🎲', snakes: '🐍', domino: '🁫' }
// أنواع اللودو
export const MODES = {
  classic: { name: 'كلاسيك', icon: '🎲', hint: 'اللودو العادي' },
  night: { name: 'الليلي', icon: '🌙', hint: 'نفس اللعب بلوحة غامقة' },
  quick: { name: 'السريع', icon: '⚔️', hint: 'كل لاعب بقطعتين بس' },
  luck: { name: 'الحظ', icon: '⚡', hint: '⚡ دور زيادة و💀 ترجّعك البيت' },
}
export const LUCK_BONUS = [3, 16, 29, 42]
export const LUCK_SKULL = [6, 19, 32, 45]
export const COLOR_NAMES = ['red', 'green', 'yellow', 'blue']
export const COLOR_AR = ['أحمر', 'أخضر', 'أصفر', 'أزرق']
export const COLOR_HEX = ['#E5392F', '#2DB04B', '#F7C21B', '#2C7BE5']
export const colorsFor = (n) => (n === 2 ? [0, 26] : n === 3 ? [0, 13, 26] : [0, 13, 26, 39])
export const colorIdx = (off) => off / 13

// الطريق (٥٢ مربع) بإحداثيات اللوحة [صف، عمود] — بيبدأ من خانة خروج الأحمر
export const PATH = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
]
export const SAFE = [0, 8, 13, 21, 26, 34, 39, 47]
export const absOf = (rel, off) => (off + rel - 1) % 52

const QUAD = [[3, 3], [3, 12], [12, 12], [12, 3]]
const FINISH = [[7.5, 6.55], [6.55, 7.5], [7.5, 8.45], [8.45, 7.5]]
// مكان القطعة على الشاشة (مركز الخانة بوحدة المربعات)
export function spotOf(off, rel, piece) {
  const ci = colorIdx(off)
  if (rel === 0) {
    const [y, x] = QUAD[ci]
    return [y + (piece < 2 ? -0.95 : 0.95), x + (piece % 2 ? 0.95 : -0.95)]
  }
  if (rel <= 51) { const [r, c] = PATH[absOf(rel, off)]; return [r + 0.5, c + 0.5] }
  if (rel <= 56) {
    const k = rel - 51
    const rc = [[7, k], [k, 7], [7, 14 - k], [14 - k, 7]][ci]
    return [rc[0] + 0.5, rc[1] + 0.5]
  }
  return FINISH[ci]
}

export const canMove = (p, d) => (p === 0 && d === 6) || (p > 0 && p + d <= 57)
export const legalPieces = (pieces, d) => [0, 1, 2, 3].filter((i) => canMove(pieces[i], d))

export function nextSeat(t, from) {
  const n = t.seats.length
  for (let k = 1; k < n; k++) {
    const j = (from + k) % n
    if (!t.left?.[t.seats[j]]) return j
  }
  return (from + 1) % n
}

// ===== السلم والتعبان =====
// السلالم (بتطلّعك) والتعابين (بتنزّلك) — لازم تبقى زي اللي في قواعد الأمان بالظبط
export const LADDERS = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 }
export const SNAKES = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 99: 41 }
export const snJump = (n) => LADDERS[n] ?? SNAKES[n] ?? n
export const snTo = (o, d) => (o + d > 100 ? o : snJump(o + d))
// مكان الخانة على اللوحة (٠ = تحت يسار، والصفوف بتلف زي الثعبان)
export function snCell(n) {
  const r = Math.floor((n - 1) / 10)
  let c = (n - 1) % 10
  if (r % 2) c = 9 - c
  return [9 - r, c]
}
