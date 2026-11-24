/// <reference path="../pb_data/types.d.ts" />
// القبايل: الترتيب، والانضمام، والفايز كل أسبوع (الحسابات في tribelib.js)

// الترتيب: نقط الأسبوع ده لحد دلوقتي + عدد الأعضاء + فايز الأسبوع اللي فات
routerAdd("GET", "/api/kemet/tribes", (e) => {
  const T = require(`${__hooks}/tribelib.js`)
  const S = require(`${__hooks}/starlib.js`)
  const lib = require(`${__hooks}/lib.js`)
  const pts = T.points(e.app, S.weekStart(), Date.now() + 60000)
  const mem = T.members(e.app)
  const list = e.app.findRecordsByFilter("tribes", "", "order", 50, 0).map((r) => ({
    id: r.id, name: r.getString("name"), icon: r.getString("icon"), desc: r.getString("desc"), members: mem[r.id] || 0, points: pts[r.id] || 0,
  })).sort((a, b) => b.points - a.points || b.members - a.members)
  let last = null
  try { last = lib.readJSON(e.app.findRecordById("config", "tribewin"), "data") } catch (_) {}
  const me = e.app.findRecordById("users", e.auth.id)
  return e.json(200, {
    tribes: list, last: last && last.tribe ? last : null, mine: me.getString("tribe"),
    canChange: !me.getInt("tribeAt") || Date.now() - me.getInt("tribeAt") > 14 * 86400000,
    prize: T.TRIBE_PRIZE, activeMsgs: T.ACTIVE_MSGS,
  })
}, $apis.requireAuth("users"))

// الانضمام لقبيلة (المسجّلين بس)، والتغيير مرة كل ١٤ يوم
routerAdd("POST", "/api/kemet/tribe/join", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const id = String((e.requestInfo().body || {}).tribe || "")
  try { e.app.findRecordById("tribes", id) } catch (_) { lib.fail("القبيلة مش موجودة") }
  const u = e.app.findRecordById("users", e.auth.id)
  if (u.getBool("guest")) lib.forbid("سجّل حسابك الأول علشان تنضم لقبيلة")
  if (u.getString("tribe") === id) return e.json(200, { ok: true })
  if (u.getString("tribe") && u.getInt("tribeAt") && Date.now() - u.getInt("tribeAt") < 14 * 86400000) lib.fail("تقدر تغيّر قبيلتك مرة كل ١٤ يوم")
  u.set("tribe", id); u.set("tribeAt", Date.now())
  e.app.saveNoValidate(u)
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// كل اتنين الساعة ١٢:١٧ بالليل (مصر): القبيلة الفايزة في الأسبوع اللي فات
cronAdd("kemetTribes", "17 22 * * 0", () => {
  try {
    const w = require(`${__hooks}/tribelib.js`).pickWinner($app)
    if (w) console.log("tribe of the week: " + (w.name || "none") + " (" + w.points + ", paid " + w.paid + ")")
  } catch (err) { console.log("tribes failed: " + err) }
})
