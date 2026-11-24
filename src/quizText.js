// تنضيف إجابات المسابقة (مشترك بين التطبيق وسكريبت بنك أسئلة السيرفر server/tools/quizbank.mjs)
// نوحّد الكتابة: أ/إ/آ = ا، ة = ه، ى = ي، من غير تشكيل ولا مسافات ولا علامات
export function normalize(s) {
  return String(s || '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[^\p{L}\p{N}]/gu, '')
}


// كل الأشكال المقبولة للإجابة (بـ "ال" ومن غيرها)
export function variants(answers) {
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

