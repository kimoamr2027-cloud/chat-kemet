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
  // 🔴🔵 تحدي فرق (المشرف): كراسي ١–٤ ضد ٥–٨
  if (action === "teams") {
    if (!royal) lib.forbid("المشرفين بس")
    if (cur) lib.fail("فيه تحدي شغال دلوقتي، استنى لما يخلص")
    const half = Math.ceil(v.seats.ring.length / 2)
    const tA = v.seats.ring.slice(0, half).filter(Boolean).map((s) => s.uid)
    const tB = v.seats.ring.slice(half).filter(Boolean).map((s) => s.uid)
    if (!tA.length || !tB.length) lib.fail("لازم حد قاعد في الناحيتين (كراسي ١–" + half + " وكراسي " + (half + 1) + "–" + v.seats.ring.length + ")")
    const p = new Record(e.app.findCollectionByNameOrId("pks"))
    p.set("room", room); p.set("a", "teamA"); p.set("aName", "🔴 الفريق الأحمر"); p.set("b", "teamB"); p.set("bName", "🔵 الفريق الأزرق"); p.set("from", me.id)
    p.set("teamA", tA); p.set("teamB", tB); p.set("mins", mins); p.set("status", "live"); p.set("startAt", now); p.set("endAt", now + mins * 60000)
    p.set("scoreA", 0); p.set("scoreB", 0); p.set("supA", {}); p.set("supB", {}); p.set("roses", {}); p.set("winner", "")
    e.app.save(p)
    return e.json(200, { id: p.id })
  }
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
  const inTeam = (lib.readJSON(p, "teamA") || []).concat(lib.readJSON(p, "teamB") || []).indexOf(to) >= 0
  if (p.getString("status") !== "live" || Date.now() > p.getInt("endAt") || to === me.id || (to !== p.getString("a") && to !== p.getString("b") && !inTeam)) return e.json(200, { ok: false })
  if (lib.appBanned(e.app, me.id)) return e.json(200, { ok: false })
  const roses = lib.readJSON(p, "roses") || {}
  const r = roses[me.id] || { n: 0, at: 0 }
  if (r.n >= K.ROSE_MAX || Date.now() - r.at < 2000) return e.json(200, { ok: false, left: K.ROSE_MAX - r.n })
  r.n++; r.at = Date.now(); roses[me.id] = r
  p.set("roses", roses); e.app.save(p)
  K.addToPk(e.app, p, to, me.id, me.getString("name"), 1)
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

// ⚔️ تحدي لايف: مضيف عنده لايف شغال بيتحدى مضيف تاني عنده لايف شغال
routerAdd("POST", "/api/kemet/live/pk", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const K = require(`${__hooks}/pklib.js`)
  const me = e.auth
  const b = e.requestInfo().body || {}
  let action = String(b.action || "")
  const admin = lib.isAdmin(e.app, me.id)
  const liveOf = (id) => {
    let r = null
    try { r = e.app.findRecordById("lives", String(id || "")) } catch (_) {}
    if (!r) lib.fail("اللايف مش موجود")
    if (r.getString("status") !== "live") lib.fail("اللايف خلص")
    return r
  }
  const now = Date.now()
  // 🎲 دوّرلي على منافس: لايف تاني شغال ومش في تحدي
  if (action === "random") {
    const mine = liveOf(b.live)
    if (mine.getString("host") !== me.id) lib.forbid("انت مش صاحب اللايف ده")
    const others = e.app.findRecordsByFilter("lives", "status = 'live' && id != {:m}", "", 20, 0, { m: mine.id }).filter((l) => !K.activeLive(e.app, l.id))
    if (!others.length) lib.fail("مفيش مضيف فاضي دلوقتي، جرب كمان شوية")
    b.to = others[Math.floor(Math.random() * others.length)].id
    action = "invite"
  }
  if (action === "invite") {
    const mine = liveOf(b.live), other = liveOf(b.to)
    if (mine.getString("host") !== me.id) lib.forbid("انت مش صاحب اللايف ده")
    if (mine.id === other.id) lib.fail("اختار لايف تاني")
    if (K.activeLive(e.app, mine.id) || K.activeLive(e.app, other.id)) lib.fail("فيه تحدي شغال، استنى لما يخلص")
    const mins = [3, 5, 10].indexOf(parseInt(b.mins, 10)) >= 0 ? parseInt(b.mins, 10) : 5
    const p = new Record(e.app.findCollectionByNameOrId("pks"))
    p.set("room", "live"); p.set("liveA", mine.id); p.set("liveB", other.id)
    p.set("a", me.id); p.set("aName", me.getString("name")); p.set("b", other.getString("host")); p.set("bName", other.getString("hostName"))
    p.set("from", me.id); p.set("mins", mins); p.set("status", "invite"); p.set("startAt", 0); p.set("endAt", now + K.INVITE_MS)
    p.set("scoreA", 0); p.set("scoreB", 0); p.set("supA", {}); p.set("supB", {}); p.set("roses", {}); p.set("winner", "")
    e.app.save(p)
    return e.json(200, { id: p.id })
  }
  let p
  try { p = e.app.findRecordById("pks", String(b.id || "")) } catch (_) { lib.fail("التحدي مش موجود") }
  if (!p.getString("liveA")) lib.fail("ده مش تحدي لايف")
  if (action === "accept") {
    if (p.getString("status") !== "invite" || p.getString("b") !== me.id || now > p.getInt("endAt")) lib.fail("الدعوة خلصت")
    liveOf(p.getString("liveA")); liveOf(p.getString("liveB"))
    p.set("status", "live"); p.set("startAt", now); p.set("endAt", now + p.getInt("mins") * 60000); e.app.save(p)
  } else if (action === "decline") {
    if (p.getString("status") !== "invite" || (p.getString("a") !== me.id && p.getString("b") !== me.id && !admin)) lib.forbid()
    p.set("status", "off"); e.app.save(p)
  } else if (action === "end") {
    if (p.getString("status") === "live" && now >= p.getInt("endAt")) K.finish(e.app, p)
  } else if (action === "stop") {
    if (!admin && p.getString("a") !== me.id && p.getString("b") !== me.id) lib.forbid()
    K.finish(e.app, p)
  } else lib.fail("حركة غلط")
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// ⚔️ أبطال التحديات: ترتيب الأسبوع + السلاسل (للشارة 🔥)
routerAdd("GET", "/api/kemet/pk/board", (e) => e.json(200, require(`${__hooks}/pklib.js`).pkBoard(e.app)), $apis.requireAuth("users"))
routerAdd("GET", "/api/kemet/pk/streaks", (e) => e.json(200, require(`${__hooks}/pklib.js`).streaks(e.app)), $apis.requireAuth("users"))
cronAdd("kemetPkWeek", "27 22 * * 0", () => {
  try { const p = require(`${__hooks}/pklib.js`).payPkWeek($app); if (p) console.log("pk week paid: " + p.length) } catch (err) { console.log("pk week failed: " + err) }
})

// 🎁 حائط الهدايا في البروفايل: كل الهدايا اللي جات للعضو (نوعها وعددها)، ومين بعت كل نوع
routerAdd("GET", "/api/kemet/giftwall", (e) => {
  const uid = String(e.request.url.query().get("uid") || "")
  const rows = arrayOf(new DynamicModel({ gift: "", n: 0, total: 0 }))
  e.app.db().newQuery("SELECT gift, COUNT(*) AS n, SUM(price) AS total FROM gifts WHERE [[to]] = {:u} GROUP BY gift ORDER BY n DESC, total DESC").bind({ u: uid }).all(rows)
  return e.json(200, rows.map((r) => ({ gift: r.gift, n: r.n, total: r.total })))
}, $apis.requireAuth("users"))
routerAdd("GET", "/api/kemet/giftwall/from", (e) => {
  const q = e.request.url.query()
  const rows = arrayOf(new DynamicModel({ uid: "", name: "", n: 0 }))
  e.app.db().newQuery("SELECT [[from]] AS uid, MAX(fromName) AS name, COUNT(*) AS n FROM gifts WHERE [[to]] = {:u} AND gift = {:g} GROUP BY [[from]] ORDER BY n DESC LIMIT 10")
    .bind({ u: String(q.get("uid") || ""), g: String(q.get("gift") || "") }).all(rows)
  return e.json(200, rows.map((r) => ({ uid: r.uid, name: r.name, n: r.n })))
}, $apis.requireAuth("users"))
