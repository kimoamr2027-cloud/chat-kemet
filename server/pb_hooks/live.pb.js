/// <reference path="../pb_data/types.d.ts" />
// 🔴 اللايف بالفيديو (LiveKit نفسه بتاع الغرفة الصوتية — غرفة LiveKit اسمها live_رقم اللايف)
// أي عضو مسجّل: سنه ١٨ أو أكتر + حسابه عدّى ٣ أيام + مش ممنوع من اللايف + وافق على القواعد. ٥ لايفات بالكتير في نفس الوقت
routerAdd("POST", "/api/kemet/live/start", (e) => {
  const KEMET_LIVE_MAX = 5
  const lib = require(`${__hooks}/lib.js`)
  const vl = require(`${__hooks}/voicelib.js`)
  const me = e.app.findRecordById("users", e.auth.id)
  const admin = lib.isAdmin(e.app, me.id)
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  if (!vl.secret() || !vl.publicUrl()) return e.json(503, { message: "اللايف لسه بيتجهّز على السيرفر" })
  if (!admin) {
    if (me.getBool("guest")) lib.forbid("سجّل حسابك الأول علشان تفتح لايف")
    if (!(me.getInt("age") >= 18)) lib.forbid("اللايف لـ ١٨ سنة وفوق (اكتب سنك في بياناتك من حسابي)")
    const days = Math.ceil((3 * 86400000 - (Date.now() - new Date(me.getString("created").replace(" ", "T")).getTime())) / 86400000)
    if (days > 0) lib.forbid("اللايف للحسابات اللي عدّى عليها ٣ أيام — فاضلك " + days + (days === 1 ? " يوم" : " أيام"))
    const ban = me.getFloat("liveBan")
    if (ban > Date.now()) lib.forbid(ban > Date.now() + 365 * 86400000 ? "انت ممنوع من اللايف" : "انت ممنوع من اللايف لحد " + new Date(ban + 7200000).toISOString().slice(11, 16) + " بسبب البلاغات")
    if (!me.getBool("livePledge")) {
      if (!(e.requestInfo().body || {}).pledge) lib.fail("لازم توافق على قواعد اللايف الأول")
      me.set("livePledge", true); e.app.saveNoValidate(me)
    }
  }
  const title = String((e.requestInfo().body || {}).title || "").trim().slice(0, 60)
  const CATS = ["chat", "music", "games", "talent", "other"]
  const cat = CATS.indexOf((e.requestInfo().body || {}).cat) >= 0 ? (e.requestInfo().body || {}).cat : "chat"
  if (title && !lib.clean(e.app, title)) lib.fail("العنوان فيه كلمة ممنوعة")
  let rec = null
  try { rec = e.app.findFirstRecordByFilter("lives", "host = {:u} && status = 'live'", { u: me.id }) } catch (_) {}
  if (!rec) {
    if (e.app.countRecords("lives", $dbx.hashExp({ status: "live" })) >= KEMET_LIVE_MAX) lib.fail("فيه " + KEMET_LIVE_MAX + " لايفات شغالين دلوقتي، استنى شوية")
    rec = new Record(e.app.findCollectionByNameOrId("lives"))
    rec.set("host", me.id); rec.set("hostName", me.getString("name")); rec.set("title", title || ("لايف " + me.getString("name")))
    rec.set("cat", cat); rec.set("fresh", e.app.countRecords("lives", $dbx.hashExp({ host: me.id })) < 3)
    rec.set("status", "live"); rec.set("viewers", 0); rec.set("startAt", Date.now()); rec.set("endAt", 0); rec.set("seenAt", Date.now())
    e.app.save(rec)
  }
  return e.json(200, { id: rec.id, url: vl.publicUrl(), token: vl.token(me.id, me.getString("name"), "live_" + rec.id, true) })
}, $apis.requireAuth("users"))

routerAdd("POST", "/api/kemet/live/join", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const vl = require(`${__hooks}/voicelib.js`)
  const me = e.auth
  if (!me.getString("name")) lib.forbid("كمّل بياناتك الأول")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  let rec
  try { rec = e.app.findRecordById("lives", String((e.requestInfo().body || {}).id || "")) } catch (_) { lib.fail("اللايف مش موجود") }
  if (rec.getString("status") !== "live") lib.fail("اللايف خلص")
  if (!vl.secret() || !vl.publicUrl()) return e.json(503, { message: "اللايف لسه بيتجهّز على السيرفر" })
  const host = rec.getString("host") === me.id
  const guest = (lib.readJSON(rec, "guests") || []).some((g) => g.uid === me.id)
  return e.json(200, { id: rec.id, host, guest, hostId: rec.getString("host"), url: vl.publicUrl(), token: vl.token(me.id, me.getString("name"), "live_" + rec.id, host || guest) })
}, $apis.requireAuth("users"))

// 🙋 ضيوف اللايف
// ask/cancel: المتفرج يطلب يطلع أو يلغي — accept/reject: المضيف — kick: المضيف أو الأدمن — leave: الضيف ينزل
routerAdd("POST", "/api/kemet/live/guest", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const vl = require(`${__hooks}/voicelib.js`)
  const GUESTS_MAX = 3
  const me = e.app.findRecordById("users", e.auth.id)
  const b = e.requestInfo().body || {}
  const action = String(b.action || "")
  let rec
  try { rec = e.app.findRecordById("lives", String(b.id || "")) } catch (_) { lib.fail("اللايف مش موجود") }
  if (rec.getString("status") !== "live") lib.fail("اللايف خلص")
  const host = rec.getString("host")
  const iHost = host === me.id
  const admin = lib.isAdmin(e.app, me.id)
  let guests = lib.readJSON(rec, "guests") || []
  const asks = lib.readJSON(rec, "asks") || {}
  const room = "live_" + rec.id
  const after = []
  if (action === "ask") {
    if (iHost) lib.fail("انت صاحب اللايف 😄")
    if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
    if (me.getBool("guest")) lib.forbid("سجّل حسابك الأول علشان تطلع لايف")
    if (!(me.getInt("age") >= 18)) lib.forbid("الطلوع في اللايف لـ ١٨ سنة وفوق (اكتب سنك في بياناتك من حسابي)")
    if (me.getFloat("liveBan") > Date.now()) lib.forbid("انت ممنوع من اللايف")
    if (guests.some((g) => g.uid === me.id)) lib.fail("انت طالع فعلًا")
    try { if (require(`${__hooks}/pklib.js`).activeLive(e.app, rec.id)) lib.fail("فيه تحدي شغال دلوقتي، اطلب بعد ما يخلص") } catch (err) { if (String(err).indexOf("تحدي") >= 0) throw err }
    if (guests.length >= GUESTS_MAX) lib.fail("الأماكن مليانة (" + GUESTS_MAX + " ضيوف) — استنى حد ينزل")
    if (Object.keys(asks).length >= 30 && !asks[me.id]) lib.fail("فيه طلبات كتير، جرب كمان شوية")
    asks[me.id] = { name: me.getString("name"), at: Date.now() }
  } else if (action === "cancel") {
    delete asks[me.id]
  } else if (action === "leave") {
    guests = guests.filter((g) => g.uid !== me.id)
    after.push([me.id, false])
  } else {
    const target = String(b.uid || "")
    if (action === "kick") {
      if (!iHost && !admin) lib.forbid()
      guests = guests.filter((g) => g.uid !== target)
      after.push([target, false])
    } else {
      if (!iHost) lib.forbid("للمضيف بس")
      if (action === "accept") {
        if (!asks[target]) lib.fail("الطلب ده اتلغى")
        if (guests.length >= GUESTS_MAX) lib.fail("عندك " + GUESTS_MAX + " ضيوف، نزّل حد الأول")
        try { if (require(`${__hooks}/pklib.js`).activeLive(e.app, rec.id)) lib.fail("فيه تحدي شغال دلوقتي") } catch (err) { if (String(err).indexOf("تحدي") >= 0) throw err }
        guests.push({ uid: target, name: asks[target].name, at: Date.now() })
        delete asks[target]
        after.push([target, true])
      } else if (action === "reject") {
        delete asks[target]
      } else lib.fail("حركة غلط")
    }
  }
  rec.set("guests", guests); rec.set("asks", asks)
  e.app.save(rec)
  for (const [uid, on] of after) { try { vl.setPublish(room, uid, on) } catch (_) {} }
  return e.json(200, { ok: true, guests, asks })
}, $apis.requireAuth("users"))

// قفل اللايف: صاحبه أو الأدمن (والأدمن بيقفله عند الكل على طول)
routerAdd("POST", "/api/kemet/live/end", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const vl = require(`${__hooks}/voicelib.js`)
  let rec
  try { rec = e.app.findRecordById("lives", String((e.requestInfo().body || {}).id || "")) } catch (_) { lib.fail("اللايف مش موجود") }
  const admin = lib.isAdmin(e.app, e.auth.id) || require(`${__hooks}/voicelib.js`).isRoyal(e.app, e.auth.id)
  if (rec.getString("host") !== e.auth.id && !admin) lib.forbid()
  if (rec.getString("status") === "live") {
    rec.set("status", "ended"); rec.set("endAt", Date.now()); rec.set("endedBy", e.auth.id)
    e.app.save(rec)
    vl.call("DeleteRoom", { room: "live_" + rec.id })
    // لو كان في تحدي: يخلص على طول
    try { const K = require(`${__hooks}/pklib.js`); const p = K.activeLive(e.app, rec.id); if (p) { if (p.getString("status") === "live") K.finish(e.app, p); else { p.set("status", "off"); e.app.save(p) } } } catch (_) {}
  }
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// الأدمن: يمنع عضو من اللايف (على طول) أو يرجّعهوله
routerAdd("POST", "/api/kemet/live/ban", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  const b = e.requestInfo().body || {}
  const u = e.app.findRecordById("users", String(b.uid || ""))
  u.set("liveBan", b.on ? 9e15 : 0); e.app.saveNoValidate(u)
  if (b.on) {
    try {
      const r = e.app.findFirstRecordByFilter("lives", "host = {:u} && status = 'live'", { u: u.id })
      r.set("status", "ended"); r.set("endAt", Date.now()); r.set("endedBy", e.auth.id); e.app.save(r)
      require(`${__hooks}/voicelib.js`).call("DeleteRoom", { room: "live_" + r.id })
    } catch (_) {}
  }
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))
// الممنوعين من اللايف دلوقتي
routerAdd("GET", "/api/kemet/live/banned", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  return e.json(200, e.app.findRecordsByFilter("users", "liveBan > {:n}", "name", 200, 0, { n: Date.now() }).map((u) => ({ uid: u.id, name: u.getString("name"), until: u.getFloat("liveBan") })))
}, $apis.requireAuth("users"))

// 🚩 بلاغ عن لايف: ٣ أعضاء مختلفين = اللايف يتقفل وصاحبه يتمنع من اللايف ٢٤ ساعة
routerAdd("POST", "/api/kemet/live/report", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const vl = require(`${__hooks}/voicelib.js`)
  const me = e.auth
  let rec
  try { rec = e.app.findRecordById("lives", String((e.requestInfo().body || {}).id || "")) } catch (_) { lib.fail("اللايف مش موجود") }
  const host = rec.getString("host")
  if (host === me.id) lib.fail("ده اللايف بتاعك 😄")
  const key = "live:" + rec.id
  if (e.app.countRecords("reports", $dbx.exp("reporter = {:u} AND chatId = {:k}", { u: me.id, k: key })) > 0) return e.json(200, { ok: true, ended: false })
  const r = new Record(e.app.findCollectionByNameOrId("reports"))
  r.set("reporter", me.id); r.set("reported", host); r.set("reportedName", rec.getString("hostName"))
  r.set("reason", "لايف مش لائق"); r.set("chatId", key)
  e.app.save(r)
  // البلاغات من الأعضاء المسجّلين بس هي اللي بتقفل اللايف
  const rows = arrayOf(new DynamicModel({ n: 0 }))
  e.app.db().newQuery("SELECT COUNT(DISTINCT r.reporter) AS n FROM reports r JOIN users u ON u.id = r.reporter WHERE r.chatId = {:k} AND u.guest = 0").bind({ k: key }).all(rows)
  let ended = false
  if (rows.length && rows[0].n >= 3 && rec.getString("status") === "live") {
    rec.set("status", "ended"); rec.set("endAt", Date.now()); rec.set("endedBy", "reports"); e.app.save(rec)
    try { vl.call("DeleteRoom", { room: "live_" + rec.id }) } catch (_) {}
    try { const K = require(`${__hooks}/pklib.js`); const p = K.activeLive(e.app, rec.id); if (p && p.getString("status") === "live") K.finish(e.app, p) } catch (_) {}
    try {
      const u = e.app.findRecordById("users", host)
      if (!lib.isAdmin(e.app, host) && u.getFloat("liveBan") < Date.now() + 86400000) { u.set("liveBan", Date.now() + 86400000); e.app.saveNoValidate(u) }
    } catch (_) {}
    ended = true
  }
  return e.json(200, { ok: true, ended })
}, $apis.requireAuth("users"))

// كل دقيقة: عدد المتفرجين، واللايف اللي صاحبه مشي من أكتر من دقيقتين بيتقفل
cronAdd("kemetLives", "* * * * *", () => {
  try {
    const vl = require(`${__hooks}/voicelib.js`)
    for (const r of $app.findRecordsByFilter("lives", "status = 'live'", "", 20, 0)) {
      const ids = vl.participants("live_" + r.id)
      if (ids === null) continue // LiveKit مش بيرد: نسيبه
      const hostIn = ids.indexOf(r.getString("host")) >= 0
      if (hostIn) r.set("seenAt", Date.now())
      r.set("viewers", Math.max(0, ids.length - (hostIn ? 1 : 0)))
      if (!hostIn && Date.now() - r.getInt("seenAt") > 2 * 60000) {
        r.set("status", "ended"); r.set("endAt", Date.now()); r.set("endedBy", "auto"); vl.call("DeleteRoom", { room: "live_" + r.id })
        try { const K = require(`${__hooks}/pklib.js`); const p = K.activeLive($app, r.id); if (p && p.getString("status") === "live") K.finish($app, p) } catch (_) {}
      }
      $app.save(r)
    }
  } catch (err) { console.log("lives cron failed: " + err) }
})
