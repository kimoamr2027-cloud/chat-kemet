// تحويل الأرقام لأرقام عربية (٠١٢٣...) زي الديزين
export const ar = (n) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])
export const dur = (s) => ar(Math.floor(s / 60)) + ':' + ar(String(s % 60).padStart(2, '0'))

// ألوان الأفاتار (خلفية، لون الحرف)
export const TINTS = [
  ['#F1E6D3', '#7A4E14'],
  ['#DCEBF2', '#1F5A75'],
  ['#EFE3F3', '#6A3A7E'],
  ['#E3EEDF', '#2F6B3A'],
  ['#F6E2DA', '#8A3B1E'],
  ['#E6E4F5', '#3E3A8A'],
]
export const tint = (i) => TINTS[i % TINTS.length]

export const STICKERS = ['هههههه', 'إيه ده؟!', 'يا قمر', 'تصبحوا على خير', 'صباح الفل', 'ماشي يا باشا']
export const REACTIONS = [['❤️', 'قلب'], ['😂', 'ضحك'], ['👍', 'تمام'], ['😮', 'مندهش'], ['😢', 'زعلان']]
