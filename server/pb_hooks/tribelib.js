// القبايل: حساب نقط الأسبوع والفايز
// النقط: رسالة في الغرف = ١ (٢٠٠ في اليوم بالكتير لكل عضو) + لعبة خلصت = ٥ + دعوة = ٢٠
const TRIBE_PRIZE = 50 // لكل عضو نشيط في القبيلة الفايزة
const ACTIVE_MSGS = 10 // أقل عدد رسايل في الأسبوع علشان تاخد الجايزة
const iso = (ms) => new Date(ms).toISOString().replace("T", " ")
function points(app, start, end) {
  const out = {}
  const add = (rows, k) => { for (const r of rows) if (r.t) out[r.t] = (out[r.t] || 0) + r.n * k }
  const q = (sql) => {
    const rows = arrayOf(new DynamicModel({ t: "", n: 0 }))
    app.db().newQuery(sql).bind({ a: iso(start), b: iso(end) }).all(rows)
    return rows
  }
  add(q("SELECT u.tribe AS t, SUM(MIN(m.n, 200)) AS n FROM (SELECT uid, substr(created, 1, 10) AS d, COUNT(*) AS n FROM messages WHERE created >= {:a} AND created < {:b} GROUP BY uid, d) m JOIN users u ON u.id = m.uid WHERE u.tribe != '' AND u.guest = FALSE GROUP BY u.tribe"), 1)
  add(q("SELECT u.tribe AS t, COUNT(*) AS n FROM coinlog c JOIN users u ON u.id = c.owner WHERE c.kind IN ('played', 'win') AND c.created >= {:a} AND c.created < {:b} AND u.tribe != '' AND u.guest = FALSE GROUP BY u.tribe"), 5)
  add(q("SELECT u.tribe AS t, COUNT(*) AS n FROM users n JOIN users u ON u.id = n.invitedBy WHERE n.invitedBy != '' AND n.created >= {:a} AND n.created < {:b} AND u.tribe != '' GROUP BY u.tribe"), 20)
  return out
}
function members(app) {
  const rows = arrayOf(new DynamicModel({ t: "", n: 0 }))
  app.db().newQuery("SELECT tribe AS t, COUNT(*) AS n FROM users WHERE tribe != '' AND guest = FALSE GROUP BY tribe").all(rows)
  const out = {}
  for (const r of rows) out[r.t] = r.n
  return out
}
// كل اتنين: القبيلة الأولى في الأسبوع اللي فات، وكل عضو نشيط فيها ياخد ١٠٠ كوين
function pickWinner(app) {
  const S = require(`${__hooks}/starlib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  const lib = require(`${__hooks}/lib.js`)
  const end = S.weekStart()
  const start = end - 7 * 86400000
  const week = g.weekKey(start + 3 * 86400000)
  let cur = null
  try { cur = app.findRecordById("config", "tribewin") } catch (_) {}
  if (cur && (lib.readJSON(cur, "data") || {}).week === week) return null
  const pts = points(app, start, end)
  let best = "", n = 0
  for (const [t, p] of Object.entries(pts)) if (p > n) { best = t; n = p }
  let win = { tribe: "", name: "", icon: "", points: 0, week, paid: 0 }
  if (best) {
    let tr = null
    try { tr = app.findRecordById("tribes", best) } catch (_) {}
    if (tr) {
      win = { tribe: best, name: tr.getString("name"), icon: tr.getString("icon"), points: n, week, paid: 0 }
      const rows = arrayOf(new DynamicModel({ uid: "", n: 0 }))
      app.db().newQuery("SELECT m.uid AS uid, COUNT(*) AS n FROM messages m JOIN users u ON u.id = m.uid WHERE u.tribe = {:t} AND u.guest = FALSE AND m.created >= {:a} AND m.created < {:b} GROUP BY m.uid HAVING COUNT(*) >= {:k}")
        .bind({ t: best, a: iso(start), b: iso(end), k: ACTIVE_MSGS }).all(rows)
      const push = require(`${__hooks}/pushlib.js`)
      for (const r of rows) {
        if (lib.appBanned(app, r.uid)) continue
        try {
          app.runInTransaction((tx) => { g.addCoins(tx, r.uid, TRIBE_PRIZE, "tribe", "🏺 قبيلة " + win.name + " كسبت الأسبوع") })
          win.paid++
          try { push.send(app, r.uid, { title: "🏆 قبيلتك كسبت الأسبوع!", body: win.icon + " " + win.name + " الأولى بـ " + n + " نقطة — خدت " + TRIBE_PRIZE + " كوين", url: "#/tribes", tag: "tribe" }) } catch (_) {}
        } catch (_) {}
      }
    }
  }
  if (!cur) { cur = new Record(app.findCollectionByNameOrId("config")); cur.set("id", "tribewin") }
  cur.set("data", win)
  app.save(cur)
  return win
}
module.exports = { TRIBE_PRIZE, ACTIVE_MSGS, points, members, pickWinner }
