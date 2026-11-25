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
    const tA = lib.readJSON(p, "teamA") || [], tB = lib.readJSON(p, "teamB") || []
    const side = p.getString("a") === to || tA.indexOf(to) >= 0 ? "A" : p.getString("b") === to || tB.indexOf(to) >= 0 ? "B" : ""
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
  try { recordStats(app, p) } catch (err) { console.log("pk stats failed: " + err) }
  return p
}
// 🔥 سلسلة الانتصارات وانتصارات الأسبوع (في الفرق: لكل واحد في الفريق)
function recordStats(app, p) {
  const w = p.getString("winner")
  if (!w || w === "draw") return
  const g = require(`${__hooks}/gamelib.js`)
  const week = g.weekKey()
  const team = (k) => { const t = lib.readJSON(p, "team" + k) || []; return t.length ? t : [p.getString(k.toLowerCase())] }
  const aWon = w === p.getString("a")
  const winners = aWon ? team("A") : team("B"), losers = aWon ? team("B") : team("A")
  const upd = (uid, won) => {
    if (!uid || uid.indexOf("team") === 0) return
    let s
    try { s = app.findRecordById("pkstats", uid) } catch (_) {
      s = new Record(app.findCollectionByNameOrId("pkstats")); s.set("id", uid)
      for (const f of ["wins", "losses", "streak", "best", "weekWins"]) s.set(f, 0)
    }
    try { s.set("name", app.findRecordById("users", uid).getString("name")) } catch (_) {}
    if (s.getString("week") !== week) { s.set("week", week); s.set("weekWins", 0) }
    if (won) {
      s.set("wins", s.getInt("wins") + 1); s.set("streak", s.getInt("streak") + 1); s.set("weekWins", s.getInt("weekWins") + 1)
      if (s.getInt("streak") > s.getInt("best")) s.set("best", s.getInt("streak"))
    } else { s.set("losses", s.getInt("losses") + 1); s.set("streak", 0) }
    app.save(s)
  }
  for (const u of winners) upd(u, true)
  for (const u of losers) upd(u, false)
}
// ⚔️ ترتيب الأسبوع، واللي عندهم سلسلة (٢ وفوق) علشان الشارة
function pkBoard(app) {
  const g = require(`${__hooks}/gamelib.js`)
  return app.findRecordsByFilter("pkstats", "week = {:w} && weekWins > 0", "-weekWins,-best", 10, 0, { w: g.weekKey() })
    .map((s) => ({ uid: s.id, name: s.getString("name"), n: s.getInt("weekWins"), streak: s.getInt("streak") }))
}
function streaks(app) {
  const out = {}
  for (const s of app.findRecordsByFilter("pkstats", "streak >= 2", "-streak", 300, 0)) out[s.id] = s.getInt("streak")
  return out
}
const PK_PRIZES = [200, 100, 50]
// كل اتنين: أول ٣ في انتصارات الأسبوع اللي فات ياخدوا كوينز
function payPkWeek(app) {
  const g = require(`${__hooks}/gamelib.js`)
  const S = require(`${__hooks}/starlib.js`)
  const lastWeek = g.weekKey(S.weekStart() - 3 * 86400000)
  let cur = null
  try { cur = app.findRecordById("config", "pkweek") } catch (_) {}
  if (cur && (lib.readJSON(cur, "data") || {}).week === lastWeek) return null
  const top = app.findRecordsByFilter("pkstats", "week = {:w} && weekWins > 0", "-weekWins,-best", 3, 0, { w: lastWeek })
  const paid = []
  top.forEach((s, i) => {
    try {
      app.runInTransaction((tx) => { g.addCoins(tx, s.id, PK_PRIZES[i], "pkweek", "⚔️ المركز " + (i + 1) + " في أبطال التحديات") })
      paid.push({ uid: s.id, name: s.getString("name"), n: s.getInt("weekWins"), coins: PK_PRIZES[i] })
      try { require(`${__hooks}/pushlib.js`).send(app, s.id, { title: "⚔️ انت من أبطال التحديات!", body: "المركز " + (i + 1) + " الأسبوع اللي فات بـ " + s.getInt("weekWins") + " انتصار — خدت " + PK_PRIZES[i] + " كوين", url: "#/live", tag: "pkweek" }) } catch (_) {}
    } catch (_) {}
  })
  if (!cur) { cur = new Record(app.findCollectionByNameOrId("config")); cur.set("id", "pkweek") }
  cur.set("data", { week: lastWeek, top: paid }); app.save(cur)
  return paid
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

module.exports = { pkBoard, streaks, payPkWeek, PK_PRIZES, INVITE_MS, ROSE_MAX, TIERS, DOUBLE_MS, active, activeLive, addPoints, addLivePoints, addToPk, finish, supporters, supportersOf, board, tierOf }
