// إحصائيات الأدمن من سيرفر PocketBase (نفس شكل src/stats.js)
import { pb, q, pbTime } from './client.js'

const DAY = 86400000
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const count = (col, filter) => pb.collection(col).getList(1, 1, { filter, fields: 'id' }).then((r) => r.totalItems).catch(() => null)

export async function loadStats(rooms) {
  const today = startOfDay()
  const days = Array.from({ length: 7 }, (_, i) => new Date(today.getTime() - (6 - i) * DAY))
  const since = (d) => q(pbTime(d))

  const [members, newToday, newWeek, online, reports, bans] = await Promise.all([
    count('users', "name!=''"),
    count('users', `name!='' && created>=${since(today)}`),
    count('users', `name!='' && created>=${since(days[0])}`),
    count('presence', `at>=${since(new Date(Date.now() - 5 * 60000))}`),
    pb.send('/api/kemet/reports', { method: 'GET' }).then((r) => r.length).catch(() => null),
    count('bans', ''),
  ])

  // رسايل كل غرفة في كل يوم من آخر ٧ أيام
  const perRoom = await Promise.all(rooms.map(async (r) => {
    const daily = await Promise.all(days.map((d) =>
      count('messages', `room=${q(r.id)} && created>=${since(d)} && created<${since(new Date(d.getTime() + DAY))}`)))
    return { id: r.id, name: r.name, daily: daily.map((n) => n || 0) }
  }))
  const daily = days.map((d, i) => ({ day: d, count: perRoom.reduce((n, r) => n + r.daily[i], 0) }))

  // أنشط الأعضاء النهارده (من رسايل الغرف)
  const tally = new Map()
  const todays = await pb.collection('messages').getList(1, 500, { filter: `created>=${since(today)}`, fields: 'uid,name', skipTotal: true }).catch(() => ({ items: [] }))
  for (const m of todays.items) {
    const t = tally.get(m.uid) || { uid: m.uid, name: m.name, count: 0 }
    t.count++; t.name = m.name
    tally.set(m.uid, t)
  }

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
