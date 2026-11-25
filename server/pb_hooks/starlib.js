// نجم الأسبوع ومهام أول أسبوع
// نجم الأسبوع: أنشط عضو مسجّل في رسايل الغرف في الأسبوع اللي فات (من الاتنين للأحد بتوقيت مصر)
// بنعدّ ٢٠٠ رسالة في اليوم بالكتير لكل عضو (علشان التكرار والسبام مايكسبش)
// النتيجة في config/star، والنجم بياخد ٥٠٠ كوين وإشعار
const STAR_COINS = 500
const DAY = 86400000
const iso = (ms) => new Date(ms).toISOString().replace("T", " ")
// بداية الأسبوع ده (الاتنين ١٢ بالليل بتوقيت مصر) بالـ UTC
function weekStart(now) {
  const t = new Date((now || Date.now()) + 7200000)
  const dow = (t.getUTCDay() + 6) % 7
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - dow) - 7200000
}
function pickStar(app) {
  const lib = require(`${__hooks}/lib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  const end = weekStart()
  const start = end - 7 * DAY
  const week = g.weekKey(start + 3 * DAY)
  let cur = null
  try { cur = app.findRecordById("config", "star") } catch (_) {}
  if (cur && (lib.readJSON(cur, "data") || {}).week === week) return null
  const rows = arrayOf(new DynamicModel({ uid: "", n: 0 }))
  app.db().newQuery(
    "SELECT uid, SUM(MIN(n, 200)) AS n FROM (SELECT uid, substr(created, 1, 10) AS d, COUNT(*) AS n FROM messages " +
    "WHERE created >= {:a} AND created < {:b} AND uid != '' AND uid != 'kemetbot' AND uid != 'nefertari' GROUP BY uid, d) GROUP BY uid ORDER BY n DESC LIMIT 20"
  ).bind({ a: iso(start), b: iso(end) }).all(rows)
  const admins = lib.roles(app).admins
  let star = null
  for (const r of rows) {
    if (admins.indexOf(r.uid) >= 0 || lib.appBanned(app, r.uid)) continue
    let u
    try { u = app.findRecordById("users", r.uid) } catch (_) { continue }
    if (u.getBool("guest") || !u.getString("name")) continue
    star = { uid: r.uid, name: u.getString("name"), n: r.n, week, at: new Date().toISOString() }
    break
  }
  if (!cur) { cur = new Record(app.findCollectionByNameOrId("config")); cur.set("id", "star") }
  cur.set("data", star || { uid: "", name: "", n: 0, week, at: new Date().toISOString() })
  app.save(cur)
  if (star) {
    app.runInTransaction((tx) => { g.addCoins(tx, star.uid, STAR_COINS, "star", "🔥 نجم الأسبوع") })
    try { require(`${__hooks}/pushlib.js`).send(app, star.uid, { title: "🔥 انت نجم الأسبوع في كيمت!", body: "كنت أنشط واحد في الغرف الأسبوع اللي فات — خدت " + STAR_COINS + " كوين، والشارة جنب اسمك الأسبوع ده كله", url: "#/games", tag: "star" }) } catch (_) {}
  }
  return star
}
// ===== مهام أول أسبوع (بتتأكد من السيرفر) =====
const KEMET_TASKS = [
  { key: "msg", coins: 20 },
  { key: "game", coins: 30 },
  { key: "dm", coins: 20 },
  { key: "avatar", coins: 20, members: true },
]
function kemetTaskState(app, u) {
  const c = (coll, where, p) => app.countRecords(coll, $dbx.exp(where, p))
  const id = u.id
  return {
    msg: c("messages", "uid = {:u}", { u: id }) > 0,
    game: c("coinlog", "owner = {:u} AND kind IN ('played', 'win')", { u: id }) > 0,
    dm: c("dms", "uid = {:u}", { u: id }) > 0,
    avatar: !!u.getString("avatar"),
    invite: c("users", "invitedBy = {:u}", { u: id }) > 0,
  }
}

module.exports = { STAR_COINS, weekStart, pickStar, KEMET_TASKS, kemetTaskState }
