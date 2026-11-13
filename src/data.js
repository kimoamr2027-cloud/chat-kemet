// بيانات تجريبية — هتتشال لما نربط Firebase

// أول حرف من اسم الغرفة من غير "غرفة" و"ال" (الأهرامات ← أ)
export const roomInitial = (name) => name.replace(/^غرفة /, '').replace(/^ال/, '').charAt(0)

export const notifications = [
  { id: 1, type: 'reply', cat: 'mentions', who: 'سارة', action: 'ردّت على رسالتك في غرفة الأهرامات', quote: 'أنا كمان جاية!', time: 'من دقيقتين', to: '/rooms/pyramids', t: 1, unread: true },
  { id: 2, type: 'dm', cat: 'dms', who: 'أحمد', action: 'بعتلك رسالة خاصة', quote: 'تمام، نتقابل الجمعة', time: 'من ١٠ دقايق', to: '/messages', t: 0, unread: true },
  { id: 3, type: 'mention', cat: 'mentions', who: 'يوسف', action: 'ذكر اسمك في شباب كيمت', quote: 'يا جماعة اسألوا صاحبنا ده', time: 'من نص ساعة', to: '/rooms/youth', t: 4, unread: true },
  { id: 4, type: 'react', cat: 'mentions', who: 'منى', action: 'تفاعلت بقلب على رسالتك', quote: 'كل ما نكتر أحلى', time: 'من ساعة', to: '/rooms/pyramids', t: 2, unread: false },
  { id: 5, type: 'mod', cat: 'rooms', who: 'أحمد', action: 'خلّاك مشرف في غرفة الأهرامات', quote: '', time: 'النهارده ٨:٠٠', to: '/rooms/pyramids', t: 0, unread: false },
  { id: 6, type: 'dm', cat: 'dms', who: 'نور', action: 'بعتتلك ستيكر', quote: 'صباح الفل', time: 'أمس', to: '/messages', t: 3, unread: false },
  { id: 7, type: 'room', cat: 'rooms', who: 'تاريخ مصر القديمة', action: 'فيها نقاش جديد عن الفراعنة', quote: '', time: 'أمس', to: '/rooms/history', t: 2, unread: false },
]
