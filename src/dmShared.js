// حاجات الخاص المشتركة بين Firebase وسيرفر PocketBase
// رقم المحادثة = رقمين العضوين مترتبين
export const chatIdFor = (a, b) => [a, b].sort().join('_')
export const otherOf = (chat, me) => chat.members.find((m) => m !== me)
export const REPORT_REASONS = ['إزعاج أو رسائل كتير', 'كلام أو صور مش لائقة', 'تحرش أو تهديد', 'حساب مزيف أو نصب', 'حاجة تانية']
