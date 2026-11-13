// بيانات تجريبية — هتتشال لما نربط Firestore
export const rooms = [
  { id: 'nile', name: 'ضفاف النيل', icon: '🌊', description: 'دردشة عامة لكل الناس', members: 128, online: 23, lastMessage: 'صباح الفل يا جماعة ☀️', lastTime: '9:40 ص', unread: 3 },
  { id: 'pyramids', name: 'ساحة الأهرامات', icon: '🔺', description: 'نقاشات وأفكار', members: 86, online: 11, lastMessage: 'مين شاف الماتش امبارح؟', lastTime: '8:15 ص', unread: 0 },
  { id: 'karnak', name: 'معبد الكرنك', icon: '🏛️', description: 'تاريخ وحضارة مصرية', members: 54, online: 7, lastMessage: 'معلومة النهارده عن رمسيس التاني', lastTime: 'امبارح', unread: 12 },
  { id: 'papyrus', name: 'بردية الشعر', icon: '📜', description: 'شعر وخواطر وكتابة', members: 41, online: 4, lastMessage: 'يا ليل يا عين…', lastTime: 'امبارح', unread: 0 },
  { id: 'sun', name: 'مركب الشمس', icon: '☀️', description: 'سفر ورحلات', members: 33, online: 2, lastMessage: 'حد راح الأقصر قريب؟', lastTime: 'الأحد', unread: 1 },
]

export const demoMessages = {
  default: [
    { id: 1, from: 'نفرتاري', gender: 'female', text: 'أهلاً بيكم في الغرفة 🌸', time: '9:30 ص' },
    { id: 2, from: 'أحمس', gender: 'male', text: 'منورين يا جماعة', time: '9:32 ص' },
    { id: 3, from: 'me', text: 'الله ينور بيكم 👋', time: '9:35 ص' },
    { id: 4, from: 'حتشبسوت', gender: 'female', text: 'صباح الفل يا جماعة ☀️', time: '9:40 ص' },
  ],
}
