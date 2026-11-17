// قواعد الدومينو المشتركة: ٢٨ حتة (دبل ٦). الحتة رقمها x = صغير×٧ + كبير
export const X = (a, b) => Math.min(a, b) * 7 + Math.max(a, b)
export const lo = (x) => Math.floor(x / 7)
export const hi = (x) => x % 7
export const pips = (x) => lo(x) + hi(x)
export const ALL = []
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) ALL.push(X(a, b))

export const ends = (chain) => (chain?.length ? [lo(chain[0]), hi(chain[chain.length - 1])] : null)
// الحتة دي تنفع تتلعب فين؟ ['L'] أو ['R'] أو الاتنين (أو [] مش نافعة)
export function sidesFor(x, chain) {
  const e = ends(chain)
  if (!e) return ['R']
  const out = []
  if (lo(x) === e[0] || hi(x) === e[0]) out.push('L')
  if (lo(x) === e[1] || hi(x) === e[1]) out.push('R')
  if (out.length === 2 && e[0] === e[1]) return ['R']
  return out
}
// اتجاه الحتة على الترابيزة
export function orient(x, chain, side) {
  const e = ends(chain)
  if (!e) return lo(x) * 7 + hi(x)
  const a = lo(x); const b = hi(x)
  if (side === 'L') { const other = a === e[0] ? b : a; return other * 7 + e[0] }
  const other = a === e[1] ? b : a
  return e[1] * 7 + other
}
