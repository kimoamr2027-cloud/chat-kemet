/// <reference path="../pb_data/types.d.ts" />
// 🔴 اللايف بالفيديو (LiveKit نفسه بتاع الغرفة الصوتية — غرفة LiveKit اسمها live_رقم اللايف)
// المضيف لازم: معتمد من الأدمن + سنه ١٨ أو أكتر + مسجّل من أسبوع. ٣ لايفات بالكتير في نفس الوقت
routerAdd("POST", "/api/kemet/live/start", (e) => {
  const KEMET_LIVE_MAX = 3
  const lib = require(`${__hooks}/lib.js`)
  const vl = require(`${__hooks}/voicelib.js`)
  const me = e.app.findRecordById("users", e.auth.id)
  const admin = lib.isAdmin(e.app, me.id)
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  if (!vl.secret() || !vl.publicUrl()) return e.json(503, { message: "اللايف لسه بيتجهّز على السيرفر" })
  if (!admin) {
    if (!me.getBool("liveHost")) lib.forbid("اللايف للمضيفين المعتمدين بس — كلّم الأدمن")
    if (me.getBool("guest") || !(me.getInt("age") >= 18)) lib.forbid("اللايف لـ ١٨ سنة وفوق (اكتب سنك في بياناتك)")
    if (Date.now() - new Date(me.getString("created").replace(" ", "T")).getTime() < 7 * 86400000) lib.forbid("اللايف للحسابات اللي عمرها أسبوع على الأقل")
  }
  const title = String((e.requestInfo().body || {}).title || "").trim().slice(0, 60)
  if (title && !lib.clean(e.app, title)) lib.fail("العنوان فيه كلمة ممنوعة")
  let rec = null
  try { rec = e.app.findFirstRecordByFilter("lives", "host = {:u} && status = 'live'", { u: me.id }) } catch (_) {}
  if (!rec) {
    if (e.app.countRecords("lives", $dbx.hashExp({ status: "live" })) >= KEMET_LIVE_MAX) lib.fail("فيه " + KEMET_LIVE_MAX + " لايفات شغالين دلوقتي، استنى شوية")
    rec = new Record(e.app.findCollectionByNameOrId("lives"))
    rec.set("host", me.id); rec.set("hostName", me.getString("name")); rec.set("title", title || ("لايف " + me.getString("name")))
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
  return e.json(200, { id: rec.id, host, url: vl.publicUrl(), token: vl.token(me.id, me.getString("name"), "live_" + rec.id, host) })
}, $apis.requireAuth("users"))

// قفل اللايف: صاحبه أو الأدمن (والأدمن بيقفله عند الكل على طول)
routerAdd("POST", "/api/kemet/live/end", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const vl = require(`${__hooks}/voicelib.js`)
  let rec
  try { rec = e.app.findRecordById("lives", String((e.requestInfo().body || {}).id || "")) } catch (_) { lib.fail("اللايف مش موجود") }
  const admin = lib.isAdmin(e.app, e.auth.id)
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

// الأدمن: يعتمد أو يشيل مضيف لايف
routerAdd("POST", "/api/kemet/live/host", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  const b = e.requestInfo().body || {}
  const u = e.app.findRecordById("users", String(b.uid || ""))
  u.set("liveHost", !!b.on); e.app.saveNoValidate(u)
  if (!b.on) {
    try {
      const r = e.app.findFirstRecordByFilter("lives", "host = {:u} && status = 'live'", { u: u.id })
      r.set("status", "ended"); r.set("endAt", Date.now()); r.set("endedBy", e.auth.id); e.app.save(r)
      require(`${__hooks}/voicelib.js`).call("DeleteRoom", { room: "live_" + r.id })
    } catch (_) {}
  }
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))
routerAdd("GET", "/api/kemet/live/hosts", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  return e.json(200, e.app.findRecordsByFilter("users", "liveHost = true", "name", 200, 0).map((u) => ({ uid: u.id, name: u.getString("name"), age: u.getInt("age") })))
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
