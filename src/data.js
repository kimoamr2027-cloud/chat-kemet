// بيانات تجريبية — هتتشال لما نربط Firebase
export const rooms = [
  { id: 'pyramids', name: 'غرفة الأهرامات', last: 'أحمد: مين جاي الرحلة الجمعة؟', time: '٩:١٥', online: 24, unread: 3, mine: true },
  { id: 'nile', name: 'نهر النيل', last: 'سارة: الصور طلعت تحفة', time: '٨:٥٠', online: 41, unread: 0, mine: false },
  { id: 'luxor', name: 'الأقصر وأسوان', last: 'محمد: حد يعرف فندق كويس؟', time: '٨:٢٠', online: 12, unread: 5, mine: true },
  { id: 'alex', name: 'إسكندرية', last: 'نور: البحر النهارده هادي', time: 'أمس', online: 18, unread: 0, mine: false },
  { id: 'youth', name: 'شباب كيمت', last: 'يوسف: يلا ماتش النهارده', time: 'أمس', online: 56, unread: 12, mine: true },
  { id: 'history', name: 'تاريخ مصر القديمة', last: 'منى: كتاب جديد عن الفراعنة', time: 'الإثنين', online: 9, unread: 0, mine: false },
]

// أول حرف من اسم الغرفة من غير "غرفة" و"ال" (الأهرامات ← أ)
export const roomInitial = (name) => name.replace(/^غرفة /, '').replace(/^ال/, '').charAt(0)

export const chats = [
  { id: 'ahmed', name: 'أحمد', last: 'تمام، نتقابل الجمعة', time: '٩:٢٠', unread: 2, online: true },
  { id: 'sara', name: 'سارة', last: 'ابعتلي الصور لما توصل', time: '٩:٠١', unread: 0, online: true },
  { id: 'mona', name: 'منى', last: 'أنت: شكرًا جدًا', time: '٨:٤٥', unread: 0, online: false },
  { id: 'youssef', name: 'يوسف', last: 'شفت الماتش؟', time: 'أمس', unread: 1, online: true },
  { id: 'nour', name: 'نور', last: 'أنت: هكلمك بكره', time: 'أمس', unread: 0, online: false },
  { id: 'mohamed', name: 'محمد', last: 'الفندق اسمه إيه؟', time: 'الإثنين', unread: 0, online: false },
]

// أعضاء الغرفة: c = رقم اللون
export const roomPeople = [
  { name: 'أحمد', mod: true, c: 0, dm: 'ahmed' },
  { name: 'سارة', c: 1, dm: 'sara' },
  { name: 'منى', c: 2, dm: 'mona' },
  { name: 'محمد', c: 3, dm: 'mohamed' },
  { name: 'نور', c: 4, dm: 'nour' },
]

export const roomMessages = [
  { id: 1, who: 'أحمد', kind: 'text', text: 'صباح الخير يا جماعة', time: '٩:٠٢', other: '❤️' },
  { id: 2, who: 'سارة', kind: 'text', text: 'صباح النور! حد رايح الأهرامات الجمعة؟', time: '٩:٠٥' },
  { id: 3, me: true, kind: 'text', text: 'أنا جاي إن شاء الله', time: '٩:٠٨', replyTo: { who: 'سارة', text: 'حد رايح الأهرامات الجمعة؟' } },
  { id: 4, who: 'أحمد', kind: 'voice', dur: '٠:٢٢', time: '٩:١٠' },
  { id: 5, who: 'منى', kind: 'sticker', sticker: 0, time: '٩:١٢', other: '😂' },
  { id: 6, me: true, kind: 'text', text: 'كل ما نكتر أحلى', time: '٩:١٥' },
]

export const dmMessages = (name) => [
  { id: 1, kind: 'text', text: 'أهلاً! شفتك في غرفة الأهرامات', time: '٩:١٢' },
  { id: 2, me: true, kind: 'text', text: `أهلاً يا ${name}، إزيك؟`, time: '٩:١٤', status: 'read' },
  { id: 3, kind: 'voice', dur: '٠:١٤', time: '٩:١٥' },
  { id: 4, me: true, kind: 'text', text: 'أيوه إن شاء الله، هجيب الكاميرا معايا', time: '٩:١٧', status: 'read', replyTo: { who: name, text: 'رسالة صوتية' }, other: '👍' },
  { id: 5, kind: 'sticker', sticker: 4, time: '٩:١٩' },
  { id: 6, kind: 'text', text: 'تمام، نتقابل الجمعة', time: '٩:٢٠', mine: '❤️' },
]

export const notifications = [
  { id: 1, type: 'reply', cat: 'mentions', who: 'سارة', action: 'ردّت على رسالتك في غرفة الأهرامات', quote: 'أنا كمان جاية!', time: 'من دقيقتين', to: '/rooms/pyramids', t: 1, unread: true },
  { id: 2, type: 'dm', cat: 'dms', who: 'أحمد', action: 'بعتلك رسالة خاصة', quote: 'تمام، نتقابل الجمعة', time: 'من ١٠ دقايق', to: '/dm/ahmed', t: 0, unread: true },
  { id: 3, type: 'mention', cat: 'mentions', who: 'يوسف', action: 'ذكر اسمك في شباب كيمت', quote: 'يا جماعة اسألوا صاحبنا ده', time: 'من نص ساعة', to: '/rooms/youth', t: 4, unread: true },
  { id: 4, type: 'react', cat: 'mentions', who: 'منى', action: 'تفاعلت بقلب على رسالتك', quote: 'كل ما نكتر أحلى', time: 'من ساعة', to: '/rooms/pyramids', t: 2, unread: false },
  { id: 5, type: 'mod', cat: 'rooms', who: 'أحمد', action: 'خلّاك مشرف في غرفة الأهرامات', quote: '', time: 'النهارده ٨:٠٠', to: '/rooms/pyramids', t: 0, unread: false },
  { id: 6, type: 'dm', cat: 'dms', who: 'نور', action: 'بعتتلك ستيكر', quote: 'صباح الفل', time: 'أمس', to: '/dm/nour', t: 3, unread: false },
  { id: 7, type: 'room', cat: 'rooms', who: 'تاريخ مصر القديمة', action: 'فيها نقاش جديد عن الفراعنة', quote: '', time: 'أمس', to: '/rooms/history', t: 2, unread: false },
]
