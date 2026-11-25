// حاجات للمتعة: صندوق الكنز، الهرم اللي بنبنيه سوا، ملك الغرفة، الخريطة الحية
const iso = (ms) => new Date(ms).toISOString().replace("T", " ")
const BOTS = ["kemetbot", "nefertari"]

// ===== صندوق الكنز =====
const CHEST_MS = 30000 // بيفضل ٣٠ ثانية
const CHEST_DAY = 40 // أقصى عدد في اليوم
function rand(n) { return Math.floor(Math.random() * n) }
// كل دقيقة: فرصة ١ من ٢٠ إن صندوق يظهر في غرفة فيها ٢ على الأقل (ومفيش صندوق تاني مفتوح)
function maybeChest(app, force) {
  const now = Date.now()
  if (app.countRecords("chests", $dbx.exp("until > {:n} AND winner = ''", { n: now })) > 0) return null
  if (app.countRecords("chests", $dbx.exp("created >= {:d}", { d: iso(now - 86400000) })) >= CHEST_DAY) return null
  if (!force && rand(20) !== 0) return null
  const rows = arrayOf(new DynamicModel({ room: "", n: 0 }))
  app.db().newQuery("SELECT room, COUNT(*) AS n FROM presence WHERE room != '' AND roomAt >= {:c} AND id NOT IN ('kemetbot', 'nefertari') GROUP BY room HAVING COUNT(*) >= 2 ORDER BY n DESC LIMIT 10")
    .bind({ c: iso(now - 5 * 60000) }).all(rows)
  const ok = []
  for (const r of rows) { try { if (!app.findRecordById("rooms", r.room).getBool("hidden")) ok.push(r.room) } catch (_) {} }
  if (!ok.length) return null
  const room = ok[rand(ok.length)]
  // ٢٠ لـ ٢٠٠ كوين (الكبير نادر)
  const roll = rand(100)
  const coins = roll < 60 ? 20 + rand(31) : roll < 90 ? 50 + rand(51) : 100 + rand(101)
  const c = new Record(app.findCollectionByNameOrId("chests"))
  c.set("room", room); c.set("coins", coins); c.set("until", now + CHEST_MS); c.set("winner", ""); c.set("winnerName", "")
  app.save(c)
  return c
}
// رسالة من «نفرتاري 🤖» في الغرفة
function roomNote(app, room, text) {
  try {
    const m = new Record(app.findCollectionByNameOrId("messages"))
    m.set("room", room); m.set("uid", "nefertari"); m.set("name", "نفرتاري 🤖"); m.set("gender", "female")
    m.set("kind", "text"); m.set("text", text); m.set("reactions", {}); m.set("edited", false)
    app.save(m)
  } catch (_) {}
}

// ===== الهرم: هدف واحد لكل الشات كل أسبوع =====
// الحجارة: رسالة في الغرف = ١ (٢٠٠ في اليوم بالكتير لكل عضو) + لعبة خلصت = ٥ + دعوة = ٢٠
const PYRAMID_COINS = 50 // لكل واحد ساهم بـ ٥ رسايل على الأقل لما الهرم يكمل
const PYRAMID_MIN = 5
function stones(app, start, end) {
  const one = (sql) => { const r = arrayOf(new DynamicModel({ n: 0 })); app.db().newQuery(sql).bind({ a: iso(start), b: iso(end) }).all(r); return r.length ? r[0].n : 0 }
  return one("SELECT COALESCE(SUM(MIN(n, 200)), 0) AS n FROM (SELECT uid, substr(created, 1, 10) AS d, COUNT(*) AS n FROM messages WHERE created >= {:a} AND created < {:b} AND uid NOT IN ('kemetbot', 'nefertari') GROUP BY uid, d)")
    + 5 * one("SELECT COUNT(*) AS n FROM coinlog WHERE kind IN ('played', 'win') AND created >= {:a} AND created < {:b}")
    + 20 * one("SELECT COUNT(*) AS n FROM users WHERE invitedBy != '' AND created >= {:a} AND created < {:b}")
}
// حالة الأسبوع ده (والهدف بيتحدد أول مرة في الأسبوع: حجارة الأسبوع اللي فات + ١٠٪، و٣٠٠ على الأقل)
function pyramid(app) {
  const S = require(`${__hooks}/starlib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  const lib = require(`${__hooks}/lib.js`)
  const start = S.weekStart()
  const week = g.weekKey(start + 3 * 86400000)
  let rec = null
  try { rec = app.findRecordById("config", "pyramid") } catch (_) {}
  let d = rec ? lib.readJSON(rec, "data") || {} : {}
  if (d.week !== week) {
    const last = stones(app, start - 7 * 86400000, start)
    d = { week, goal: Math.max(300, Math.round(last * 1.1 / 50) * 50), done: false, paid: 0 }
    if (!rec) { rec = new Record(app.findCollectionByNameOrId("config")); rec.set("id", "pyramid") }
    rec.set("data", d); app.save(rec)
  }
  return { rec, d, start, n: stones(app, start, Date.now() + 60000) }
}
// كل ساعة: لو الهرم كمل، كل اللي ساهموا ياخدوا كوينز (مرة واحدة في الأسبوع)
function checkPyramid(app) {
  const g = require(`${__hooks}/gamelib.js`)
  const lib = require(`${__hooks}/lib.js`)
  const p = pyramid(app)
  if (p.d.done || p.n < p.d.goal) return null
  const rows = arrayOf(new DynamicModel({ uid: "", n: 0 }))
  app.db().newQuery("SELECT uid, COUNT(*) AS n FROM messages WHERE created >= {:a} AND uid NOT IN ('kemetbot', 'nefertari') GROUP BY uid HAVING COUNT(*) >= {:k}")
    .bind({ a: iso(p.start), k: PYRAMID_MIN }).all(rows)
  const push = require(`${__hooks}/pushlib.js`)
  let paid = 0
  for (const r of rows) {
    if (lib.appBanned(app, r.uid)) continue
    try {
      app.runInTransaction((tx) => { g.addCoins(tx, r.uid, PYRAMID_COINS, "pyramid", "🔺 الهرم كمل! هدية كل اللي ساعدوا") })
      paid++
      try { push.send(app, r.uid, { title: "🔺 الهرم كمل!", body: "بنينا الهرم سوا الأسبوع ده — خدت " + PYRAMID_COINS + " كوين علشان ساعدت 👏", url: "#/rooms", tag: "pyramid" }) } catch (_) {}
    } catch (_) {}
  }
  p.d.done = true; p.d.paid = paid; p.d.doneAt = Date.now()
  p.rec.set("data", p.d); app.save(p.rec)
  return p.d
}

// ===== ملك الغرفة: أنشط واحد في الساعة دي (٥ رسايل على الأقل) =====
function roomKing(app, room) {
  const now = new Date()
  const hourStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours())
  const rows = arrayOf(new DynamicModel({ uid: "", n: 0 }))
  app.db().newQuery("SELECT uid, COUNT(*) AS n FROM messages WHERE room = {:r} AND created >= {:a} AND uid NOT IN ('kemetbot', 'nefertari') GROUP BY uid ORDER BY n DESC, MIN(created) ASC LIMIT 1")
    .bind({ r: room, a: iso(hourStart) }).all(rows)
  if (!rows.length || rows[0].n < 5) return null
  let name = ""
  try { name = app.findRecordById("users", rows[0].uid).getString("name") } catch (_) { return null }
  return { uid: rows[0].uid, name, n: rows[0].n, until: hourStart + 3600000 }
}

// ===== الخريطة الحية: المتصلين دلوقتي من كل قبيلة =====
function liveMap(app) {
  const rows = arrayOf(new DynamicModel({ t: "", n: 0 }))
  app.db().newQuery("SELECT u.tribe AS t, COUNT(*) AS n FROM presence p JOIN users u ON u.id = p.id WHERE p.at >= {:c} AND u.tribe != '' GROUP BY u.tribe")
    .bind({ c: iso(Date.now() - 5 * 60000) }).all(rows)
  const out = {}
  for (const r of rows) out[r.t] = r.n
  const all = app.countRecords("presence", $dbx.exp("at >= {:c} AND id NOT IN ('kemetbot', 'nefertari')", { c: iso(Date.now() - 5 * 60000) }))
  return { tribes: out, online: all }
}

// ===== هدية كل دقيقة =====
const DAYCHEST_MAX = 5
const DAYCHEST_MS = 60000
function dayChestCoins() { const r = rand(100); return r < 70 ? 5 + rand(11) : r < 95 ? 15 + rand(16) : 50 }
// فاضل كام النهارده، ولسه قد إيه على الجاية
function dayChestState(app, uid) {
  const dayStart = Math.floor((Date.now() + 7200000) / 86400000) * 86400000 - 7200000
  const list = app.findRecordsByFilter("coinlog", "owner = {:u} && kind = 'daychest' && created >= {:d}", "-created", DAYCHEST_MAX, 0, { u: uid, d: iso(dayStart) })
  const last = list.length ? new Date(list[0].getString("created").replace(" ", "T")).getTime() : 0
  return { left: Math.max(0, DAYCHEST_MAX - list.length), wait: Math.max(0, last + DAYCHEST_MS - Date.now()), max: DAYCHEST_MAX }
}

module.exports = { DAYCHEST_MAX, DAYCHEST_MS, dayChestCoins, dayChestState, BOTS, CHEST_MS, maybeChest, roomNote, PYRAMID_COINS, PYRAMID_MIN, pyramid, checkPyramid, roomKing, liveMap }
