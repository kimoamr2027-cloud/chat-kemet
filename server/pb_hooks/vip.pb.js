// VIP كيمت: شراء بالكوينز (٣٠ يوم) + الأدمن يدّي أو يشيل VIP
routerAdd("POST", "/api/kemet/vip/buy", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  const V = require(`${__hooks}/viplib.js`)
  const me = e.auth
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  const lv = parseInt((e.requestInfo().body || {}).level, 10)
  if (!(lv >= 1 && lv <= 6)) lib.fail("مستوى غلط")
  const admin = lib.isAdmin(e.app, me.id)
  let out = {}
  e.app.runInTransaction((tx) => {
    let r
    try { r = tx.findRecordById("vips", me.id) } catch (_) { r = new Record(tx.findCollectionByNameOrId("vips")); r.set("id", me.id) }
    const now = Date.now()
    const curLv = r.getInt("until") > now ? r.getInt("level") : 0
    if (curLv > lv) lib.fail("عندك مستوى أعلى لسه شغال")
    // نفس المستوى: بيتجدّد ٣٠ يوم زيادة. مستوى أعلى: بيبدأ ٣٠ يوم من النهارده
    const from = curLv === lv ? Math.max(now, r.getInt("until")) : now
    if (!admin) g.addCoins(tx, me.id, -V.VIP_PRICES[lv - 1], "vip", "VIP " + V.VIP_NAMES[lv - 1] + " (٣٠ يوم)")
    r.set("level", lv); r.set("until", from + V.VIP_DAYS * V.DAY); r.set("name", me.getString("name"))
    tx.save(r)
    out = { level: lv, until: r.getInt("until") }
  })
  return e.json(200, out)
}, $apis.requireAuth("users"))

routerAdd("POST", "/api/kemet/vip/grant", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const V = require(`${__hooks}/viplib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  const b = e.requestInfo().body || {}
  const uid = String(b.uid || "")
  const lv = parseInt(b.level, 10)
  const days = parseInt(b.days || 30, 10)
  if (!(lv >= 0 && lv <= 6) || !(days >= 1 && days <= 3650)) lib.fail("بيانات غلط")
  let name = ""
  try { name = e.app.findRecordById("users", uid).getString("name") } catch (_) { lib.fail("العضو مش موجود") }
  let r
  try { r = e.app.findRecordById("vips", uid) } catch (_) { r = new Record(e.app.findCollectionByNameOrId("vips")); r.set("id", uid) }
  r.set("level", lv); r.set("until", lv ? Date.now() + days * V.DAY : 0); r.set("name", name)
  e.app.save(r)
  return e.json(200, { level: lv, until: r.getInt("until") })
}, $apis.requireAuth("users"))

// كل ساعة: إشعار قبل ما الـ VIP يخلص بـ ٣ أيام، وإشعار يوم ما يخلص
cronAdd("kemetVipNotes", "7 * * * *", () => {
  const V = require(`${__hooks}/viplib.js`)
  const push = require(`${__hooks}/pushlib.js`)
  const now = Date.now()
  const soon = $app.findRecordsByFilter("vips", "until > {:now} && until <= {:soon} && level > 0", "", 500, 0, { now, soon: now + 3 * V.DAY })
  for (const r of soon) {
    if (r.getInt("warned") === r.getInt("until")) continue
    const days = Math.max(1, Math.ceil((r.getInt("until") - now) / V.DAY))
    try { push.send($app, r.id, { title: "👑 الـ VIP بتاعك هيخلص قريب", body: "فاضل " + days + " يوم على VIP " + V.VIP_NAMES[r.getInt("level") - 1] + " — جدّد علشان ماتخسرش مميزاتك", url: "#/games", tag: "vip" }) } catch (_) {}
    r.set("warned", r.getInt("until")); $app.save(r)
  }
  const gone = $app.findRecordsByFilter("vips", "until <= {:now} && until > {:old} && level > 0", "", 500, 0, { now, old: now - 2 * V.DAY })
  for (const r of gone) {
    if (r.getInt("ended") === r.getInt("until")) continue
    try { push.send($app, r.id, { title: "👑 الـ VIP بتاعك خلص", body: "تقدر تجدد VIP " + V.VIP_NAMES[r.getInt("level") - 1] + " من المحفظة في أي وقت", url: "#/games", tag: "vip" }) } catch (_) {}
    r.set("ended", r.getInt("until")); $app.save(r)
  }
})
