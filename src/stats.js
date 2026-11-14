// إحصائيات الأدمن (بتتحسب لما الأدمن يفتح التاب)
import {
  collection, query, where, getCountFromServer, getDocs, limit, Timestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'

const DAY = 86400000
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const ts = (d) => Timestamp.fromDate(d)
const count = (q) => getCountFromServer(q).then((s) => s.data().count).catch(() => null)

export async function loadStats(rooms) {
  const today = startOfDay()
  const days = Array.from({ length: 7 }, (_, i) => new Date(today.getTime() - (6 - i) * DAY))

  const users = collection(db, 'users')
  const [members, newToday, newWeek, online, reports, bans] = await Promise.all([
    count(users),
    count(query(users, where('createdAt', '>=', ts(today)))),
    count(query(users, where('createdAt', '>=', ts(days[0])))),
    count(query(collection(db, 'presence'), where('at', '>=', ts(new Date(Date.now() - 5 * 60000))))),
    count(collection(db, 'reports')),
    count(collection(db, 'bans')),
  ])

  // رسايل كل غرفة في كل يوم من آخر ٧ أيام
  const perRoom = await Promise.all(rooms.map(async (r) => {
    const msgs = collection(db, 'rooms', r.id, 'messages')
    const daily = await Promise.all(days.map((d) => count(query(msgs,
      where('createdAt', '>=', ts(d)), where('createdAt', '<', ts(new Date(d.getTime() + DAY)))))))
    return { id: r.id, name: r.name, daily: daily.map((n) => n || 0) }
  }))
  const daily = days.map((d, i) => ({ day: d, count: perRoom.reduce((n, r) => n + r.daily[i], 0) }))

  // أنشط الأعضاء النهارده (من رسايل الغرف)
  const tally = new Map()
  await Promise.all(rooms.map(async (r) => {
    const snap = await getDocs(query(collection(db, 'rooms', r.id, 'messages'), where('createdAt', '>=', ts(today)), limit(500))).catch(() => null)
    snap?.docs.forEach((d) => {
      const m = d.data()
      const t = tally.get(m.uid) || { uid: m.uid, name: m.name, count: 0 }
      t.count++; t.name = m.name
      tally.set(m.uid, t)
    })
  }))

  return {
    members, newToday, newWeek, online, reports, bans,
    today: daily[6].count,
    daily,
    rooms: perRoom.map((r) => ({ ...r, today: r.daily[6], week: r.daily.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.today - a.today || b.week - a.week),
    topMembers: [...tally.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    at: new Date(),
  }
}
