// التحدي (PK) والدعم
const lib = require(`${__hooks}/lib.js`)
const INVITE_MS = 30000
const ROSE_MAX = 20 // ورد ببلاش: ٢٠ وردة بالكتير لكل داعم في التحدي، وحدة كل ثانيتين
const iso = (ms) => new Date(ms).toISOString().replace("T", " ")
const TIERS = [[50000, 4], [20000, 3], [5000, 2], [1000, 1]] // ماسي، دهب، فضة، برونز (في الشهر)

// التحدي الشغال في الغرفة (دعوة لسه ماخلصتش أو لايف)
function active(app, room) {
  const now = Date.now()
  const list = app.findRecordsByFilter("pks", "room = {:r} && (status = 'invite' || status = 'live')", "-created", 5, 0, { r: room })
  for (const p of list) {
    if (p.getString("status") === "invite" && now > p.getInt("endAt")) { p.set("status", "off"); app.save(p); continue }
    return p
  }
  return null
}
// تحدي لايف شغال للايف ده (هو اللي بدأ أو اللي اتحدى)
function activeLive(app, liveId) {
  const now = Date.now()
  const list = app.findRecordsByFilter("pks", "(liveA = {:l} || liveB = {:l}) && (status = 'invite' || status = 'live')", "-created", 5, 0, { l: liveId })
  for (const p of list) {
    if (p.getString("status") === "invite" && now > p.getInt("endAt")) { p.set("status", "off"); app.save(p); continue }
    return p
  }
  return null
}
const DOUBLE_MS = 60000 // آخر دقيقة: كل النقط ×٢
// نقط لواحد من الاتنين (هدية أو وردة) في الغرفة الصوتية
function addPoints(app, room, to, from, fromName, pts) {
  try { return addToPk(app, active(app, room), to, from, fromName, pts) } catch (_) { return false }
}
// نقط في تحدي لايف (الهدية في لايف للمضيف بتاعه)
function addLivePoints(app, liveId, to, from, fromName, pts) {
  try { return addToPk(app, activeLive(app, liveId), to, from, fromName, pts) } catch (_) { return false }
}
function addToPk(app, p, to, from, fromName, pts) {
  try {
    if (!p || p.getString("status") !== "live" || Date.now() > p.getInt("endAt")) return false
    if (p.getInt("endAt") - Date.now() <= DOUBLE_MS) pts *= 2
    const side = p.getString("a") === to ? "A" : p.getString("b") === to ? "B" : ""
    if (!side) return false
    p.set("score" + side, p.getInt("score" + side) + pts)
    const sup = lib.readJSON(p, "sup" + side) || {}
    const s = sup[from] || { n: 0, name: fromName }
    s.n += pts; s.name = fromName
    sup[from] = s
    p.set("sup" + side, sup)
    app.save(p)
    return true
  } catch (_) { return false }
}
// خلّص التحدي: الكسبان (أو تعادل)
function finish(app, p) {
  if (p.getString("status") !== "live") return p
  const a = p.getInt("scoreA"), b = p.getInt("scoreB")
  p.set("status", "done")
  p.set("winner", a > b ? p.getString("a") : b > a ? p.getString("b") : "draw")
  p.set("endAt", Math.min(p.getInt("endAt"), Date.now()))
  app.save(p)
  return p
}

// ===== الدعم =====
function monthStart() { const t = new Date(Date.now() + 7200000); return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1) - 7200000 }
function weekStart() { return require(`${__hooks}/starlib.js`).weekStart() }
function tierOf(n) { for (const [min, t] of TIERS) if (n >= min) return t; return 0 }
// كل الداعمين اللي وصلوا لمستوى الشهر ده: { uid: tier }
function supporters(app) {
  const rows = arrayOf(new DynamicModel({ uid: "", n: 0 }))
  app.db().newQuery("SELECT [[from]] AS uid, SUM(price) AS n FROM gifts WHERE created >= {:m} GROUP BY [[from]] HAVING SUM(price) >= 1000").bind({ m: iso(monthStart()) }).all(rows)
  const admins = lib.roles(app).admins
  const out = {}
  for (const r of rows) if (admins.indexOf(r.uid) < 0) out[r.uid] = tierOf(r.n)
  return out
}
// أكبر ٣ داعمين لعضو الشهر ده
function supportersOf(app, uid) {
  const rows = arrayOf(new DynamicModel({ uid: "", name: "", n: 0 }))
  app.db().newQuery("SELECT [[from]] AS uid, MAX(fromName) AS name, SUM(price) AS n FROM gifts WHERE [[to]] = {:u} AND created >= {:m} GROUP BY [[from]] ORDER BY n DESC LIMIT 3").bind({ u: uid, m: iso(monthStart()) }).all(rows)
  return rows.map((r) => ({ uid: r.uid, name: r.name, n: r.n }))
}
// لوحة الأسبوع: أكبر الداعمين وأكتر ناس اتدعموا
function board(app) {
  const q = (col, name) => {
    const rows = arrayOf(new DynamicModel({ uid: "", name: "", n: 0 }))
    app.db().newQuery("SELECT [[" + col + "]] AS uid, MAX(" + name + ") AS name, SUM(price) AS n FROM gifts WHERE created >= {:w} GROUP BY [[" + col + "]] ORDER BY n DESC LIMIT 10").bind({ w: iso(weekStart()) }).all(rows)
    return rows.map((r) => ({ uid: r.uid, name: r.name, n: r.n }))
  }
  return { givers: q("from", "fromName"), takers: q("to", "toName") }
}

module.exports = { INVITE_MS, ROSE_MAX, TIERS, DOUBLE_MS, active, activeLive, addPoints, addLivePoints, addToPk, finish, supporters, supportersOf, board, tierOf }
