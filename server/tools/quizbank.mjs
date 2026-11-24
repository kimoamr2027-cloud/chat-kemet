// بيعمل بنك أسئلة المسابقة التلقائية للسيرفر (server/pb_hooks/quizbank.js) من بنك التطبيق src/gameBank.js
// بعد أي تعديل في الأسئلة: node server/tools/quizbank.mjs
// الإجابات بتتحفظ hashes بس (نفس اللي التطبيق بيحسبه)، علشان محدش يشوفها من السيرفر
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { BANK } from '../../src/gameBank.js'
import { variants } from '../../src/quizText.js'

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex')
const out = {}
for (const [t, list] of Object.entries(BANK)) {
  out[t] = list.map((q) => ({ p: q.p, h: q.h || '', x: variants(q.a).map(sha) }))
}
const file = new URL('../pb_hooks/quizbank.js', import.meta.url)
writeFileSync(file, '// اتعمل أوتوماتيك من src/gameBank.js بـ node server/tools/quizbank.mjs — ماتعدّلوش بإيدك\nmodule.exports = ' + JSON.stringify(out) + '\n')
console.log('quizbank:', Object.entries(out).map(([t, l]) => t + '=' + l.length).join(' '))
