/// <reference path="../pb_data/types.d.ts" />
// ⚔️ التحدي (PK) في الغرفة الصوتية + 💪 الدعم (الحسابات في pklib.js)
routerAdd("POST", "/api/kemet/pk", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const vl = require(`${__hooks}/voicelib.js`)
  const K = require(`${__hooks}/pklib.js`)
  const me = e.auth
  const b = e.requestInfo().body || {}
  const action = String(b.action || "")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  const v = vl.readRoom(e.app, b.room)
  const room = v.rec.id
  const royal = vl.isRoyal(e.app, me.id)
  const seated = (uid) => !!vl.seatOf(v.seats, uid)
  const nameOf = (uid) => { try { return e.app.findRecordById("users", uid).getString("name") } catch (_) { lib.fail("العضو مش موجود") } }
  const cur = K.active(e.app, room)
  const now = Date.now()
  const newPk = (a, bb, mins, status) => {
    const p = new Record(e.app.findCollectionByNameOrId("pks"))
    p.set("room", room); p.set("a", a); p.set("aName", nameOf(a)); p.set("b", bb); p.set("bName", nameOf(bb)); p.set("from", me.id)
    p.set("mins", mins); p.set("status", status); p.set("scoreA", 0); p.set("scoreB", 0); p.set("supA", {}); p.set("supB", {}); p.set("roses", {}); p.set("winner", "")
    if (status === "live") { p.set("startAt", now); p.set("endAt", now + mins * 60000) } else { p.set("startAt", 0); p.set("endAt", now + K.INVITE_MS) }
    e.app.save(p)
    return p
  }
  const mins = [3, 5, 10].indexOf(parseInt(b.mins, 10)) >= 0 ? parseInt(b.mins, 10) : 5
  if (action === "invite" || action === "start") {
    const a = action === "invite" ? me.id : String(b.a || "")
    const bb = String(b.to || b.b || "")
    if (!a || !bb || a === bb) lib.fail("اختار اتنين مختلفين")
    if (action === "start" && !royal) lib.forbid("المشرفين بس")
    if (!seated(a) || !seated(bb)) lib.fail("الاتنين لازم يكونوا قاعدين على كراسي")
    if (cur) lib.fail("فيه تحدي شغال دلوقتي، استنى لما يخلص")
    const p = newPk(a, bb, mins, action === "invite" ? "invite" : "live")
    return e.json(200, { id: p.id })
  }
  if (!cur || cur.id !== String(b.id || "")) lib.fail("التحدي ده خلص")
  if (action === "accept") {
    if (cur.getString("status") !== "invite" || cur.getString("b") !== me.id) lib.forbid()
    if (!seated(cur.getString("a")) || !seated(me.id)) lib.fail("الاتنين لازم يكونوا قاعدين على كراسي")
    cur.set("status", "live"); cur.set("startAt", now); cur.set("endAt", now + cur.getInt("mins") * 60000)
    e.app.save(cur)
  } else if (action === "decline") {
    if (cur.getString("status") !== "invite" || (cur.getString("b") !== me.id && cur.getString("a") !== me.id && !royal)) lib.forbid()
    cur.set("status", "off"); e.app.save(cur)
  } else if (action === "end") {
    if (cur.getString("status") === "live" && now >= cur.getInt("endAt")) K.finish(e.app, cur)
  } else if (action === "stop") {
    if (!royal) lib.forbid("المشرفين بس")
    K.finish(e.app, cur)
  } else lib.fail("حركة غلط")
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// وردة ببلاش في التحدي = نقطة (٢٠ بالكتير لكل داعم، وحدة كل ثانيتين)
routerAdd("POST", "/api/kemet/pk/rose", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const K = require(`${__hooks}/pklib.js`)
  const me = e.auth
  const b = e.requestInfo().body || {}
  let p
  try { p = e.app.findRecordById("pks", String(b.id || "")) } catch (_) { return e.json(200, { ok: false }) }
  const to = String(b.to || "")
  if (p.getString("status") !== "live" || Date.now() > p.getInt("endAt") || to === me.id || (to !== p.getString("a") && to !== p.getString("b"))) return e.json(200, { ok: false })
  if (lib.appBanned(e.app, me.id)) return e.json(200, { ok: false })
  const roses = lib.readJSON(p, "roses") || {}
  const r = roses[me.id] || { n: 0, at: 0 }
  if (r.n >= K.ROSE_MAX || Date.now() - r.at < 2000) return e.json(200, { ok: false, left: K.ROSE_MAX - r.n })
  r.n++; r.at = Date.now(); roses[me.id] = r
  p.set("roses", roses); e.app.save(p)
  K.addPoints(e.app, p.getString("room"), to, me.id, me.getString("name"), 1)
  return e.json(200, { ok: true, left: K.ROSE_MAX - r.n })
}, $apis.requireAuth("users"))

// كل دقيقة: التحديات اللي وقتها خلص (لو محدش في الغرفة خلّصها)
cronAdd("kemetPk", "* * * * *", () => {
  try {
    const K = require(`${__hooks}/pklib.js`)
    for (const p of $app.findRecordsByFilter("pks", "status = 'live' && endAt < {:n}", "", 50, 0, { n: Date.now() })) K.finish($app, p)
    for (const p of $app.findRecordsByFilter("pks", "status = 'invite' && endAt < {:n}", "", 50, 0, { n: Date.now() })) { p.set("status", "off"); $app.save(p) }
  } catch (err) { console.log("pk cron failed: " + err) }
})

// 💪 الداعمين
routerAdd("GET", "/api/kemet/supporters", (e) => e.json(200, require(`${__hooks}/pklib.js`).supporters(e.app)), $apis.requireAuth("users"))
routerAdd("GET", "/api/kemet/supporters/of", (e) => e.json(200, require(`${__hooks}/pklib.js`).supportersOf(e.app, String(e.request.url.query().get("uid") || ""))), $apis.requireAuth("users"))
routerAdd("GET", "/api/kemet/support/board", (e) => e.json(200, require(`${__hooks}/pklib.js`).board(e.app)), $apis.requireAuth("users"))
