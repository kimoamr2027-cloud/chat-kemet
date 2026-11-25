// 🎙 الحفلات + 🎉 الغرف الحية + 🏆 لوحة الشرف + البانرات
const iso = (ms) => new Date(ms).toISOString().replace("T", " ")
const BOTS = ["kemetbot", "nefertari"]
const PARTY_MAX = 40 // أقصى عدد حفلات مفتوحة في نفس الوقت
const PARTY_IDLE_DAYS = 3 // الحفلة اللي فضيت ٣ أيام بتتقفل لوحدها
const PARTY_MIN_DAYS = 3 // عمر الحساب علشان تفتح حفلة (إلا لو VIP)
const BANNER_COLORS = ["gold", "purple", "blue", "green", "red", "night"]

// بداية اليوم بتوقيت مصر
function dayStart() { const d = new Date(Date.now() + 7200000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 7200000 }
function since(period) { return period === "week" ? require(`${__hooks}/starlib.js`).weekStart() : dayStart() }

// مين موجود في كل غرفة كتابة دلوقتي (العدد + أحدث ٤)
function liveRooms(app) {
  const rows = arrayOf(new DynamicModel({ id: "", room: "", name: "" }))
  app.db().newQuery("SELECT p.id AS id, p.room AS room, COALESCE(u.name, '') AS name FROM presence p LEFT JOIN users u ON u.id = p.id WHERE p.room != '' AND p.roomAt >= {:c} AND p.id NOT IN ('kemetbot', 'nefertari') ORDER BY p.roomAt DESC LIMIT 2000")
    .bind({ c: iso(Date.now() - 5 * 60000) }).all(rows)
  const out = {}
  for (const r of rows) {
    const x = out[r.room] || (out[r.room] = { n: 0, faces: [] })
    x.n++
    if (x.faces.length < 4 && r.name) x.faces.push({ uid: r.id, name: r.name })
  }
  return out
}

// لوحة الشرف: الأغنى (بعتوا هدايا) + النجوم (استلموا) + أنشط الغرف
function honor(app, period) {
  const a = iso(since(period))
  const q = (sql, model) => { const rows = arrayOf(new DynamicModel(model)); app.db().newQuery(sql).bind({ a }).all(rows); return rows }
  const givers = q("SELECT [[from]] AS uid, MAX(fromName) AS name, SUM(price) AS n FROM gifts WHERE created >= {:a} AND [[from]] != '' GROUP BY [[from]] ORDER BY n DESC LIMIT 20", { uid: "", name: "", n: 0 })
  const takers = q("SELECT [[to]] AS uid, MAX(toName) AS name, SUM(price) AS n FROM gifts WHERE created >= {:a} AND [[to]] != '' GROUP BY [[to]] ORDER BY n DESC LIMIT 20", { uid: "", name: "", n: 0 })
  const rooms = q("SELECT m.room AS id, r.name AS name, r.photo AS photo, COUNT(*) AS n FROM messages m JOIN rooms r ON r.id = m.room WHERE m.created >= {:a} AND m.uid NOT IN ('kemetbot', 'nefertari') AND r.hidden = 0 GROUP BY m.room ORDER BY n DESC LIMIT 10", { id: "", name: "", photo: "", n: 0 })
  const voice = q("SELECT g.room AS id, v.name AS name, '' AS photo, SUM(g.price) AS n FROM gifts g JOIN voice v ON v.id = g.room WHERE g.created >= {:a} GROUP BY g.room ORDER BY n DESC LIMIT 10", { id: "", name: "", photo: "", n: 0 })
  const plain = (rs) => rs.map((r) => Object.assign({}, r))
  return { givers: plain(givers), takers: plain(takers), rooms: plain(rooms), voice: plain(voice) }
}

function banners(app) {
  try { return (require(`${__hooks}/lib.js`).readJSON(app.findRecordById("config", "banners"), "data") || {}).list || [] } catch (_) { return [] }
}
function cleanBanner(app, x) {
  const lib = require(`${__hooks}/lib.js`)
  const s = (v, n) => String(v || "").trim().slice(0, n)
  const b = { id: s(x.id, 20) || String(Date.now()), title: s(x.title, 40), sub: s(x.sub, 90), e: s(x.e, 8), color: BANNER_COLORS.indexOf(x.color) >= 0 ? x.color : "gold", link: s(x.link, 80), until: parseInt(x.until, 10) || 0 }
  if (!b.title) lib.fail("اكتب عنوان البانر")
  if (b.link && !/^\/[\w\/-]*$/.test(b.link)) lib.fail("اللينك لازم يبدأ بـ / (صفحة جوه الشات)")
  if (!lib.clean(app, b.title + " " + b.sub)) lib.fail("فيه كلمة ممنوعة")
  return b
}

// الأكتر هدايا في اللايفات الشغالة في آخر ساعة
function liveTop(app) {
  const rows = arrayOf(new DynamicModel({ id: "", n: 0 }))
  app.db().newQuery("SELECT g.room AS id, SUM(g.price) AS n FROM gifts g JOIN lives l ON l.id = g.room WHERE l.status = 'live' AND g.created >= {:a} GROUP BY g.room ORDER BY n DESC LIMIT 10")
    .bind({ a: iso(Date.now() - 3600000) }).all(rows)
  const out = {}
  for (const r of rows) out[r.id] = r.n
  return out
}

module.exports = { iso, BOTS, PARTY_MAX, PARTY_IDLE_DAYS, PARTY_MIN_DAYS, BANNER_COLORS, dayStart, since, liveRooms, honor, banners, cleanBanner, liveTop }
