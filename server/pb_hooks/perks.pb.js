/// <reference path="../pb_data/types.d.ts" />
// فقاعات الرسايل (٣٠ يوم بالكوينز) والارتباط بالخواتم

// ===== شراء فقاعة =====
routerAdd("POST", "/api/kemet/bubble/buy", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  const P = require(`${__hooks}/perkslib.js`)
  const me = e.auth
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  const style = String((e.requestInfo().body || {}).style || "")
  const price = P.BUBBLES[style]
  if (!price) lib.fail("شكل غلط")
  const admin = lib.isAdmin(e.app, me.id)
  let out = {}
  e.app.runInTransaction((tx) => {
    const r = P.rec(tx, me.id)
    const now = Date.now()
    // نفس الشكل: بيتجدّد ٣٠ يوم زيادة. شكل تاني: بيبدأ ٣٠ يوم من النهارده
    const same = r.getString("bubble") === style && r.getInt("bubbleUntil") > now
    const from = same ? r.getInt("bubbleUntil") : now
    if (!admin) g.addCoins(tx, me.id, -price, "bubble", "فقاعة " + P.BUBBLE_NAMES[style] + " (٣٠ يوم)")
    r.set("bubble", style); r.set("bubbleUntil", from + P.BUBBLE_DAYS * P.DAY)
    tx.save(r)
    out = { bubble: style, until: r.getInt("bubbleUntil") }
  })
  return e.json(200, out)
}, $apis.requireAuth("users"))

// ===== طلب ارتباط =====
routerAdd("POST", "/api/kemet/ring/propose", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  const P = require(`${__hooks}/perkslib.js`)
  const me = e.auth
  const b = e.requestInfo().body || {}
  const to = String(b.to || "")
  const ring = parseInt(b.ring, 10)
  if (!(ring >= 1 && ring <= 3)) lib.fail("خاتم غلط")
  if (!to || to === me.id) lib.fail("اختار حد")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  let toName = ""
  try { toName = e.app.findRecordById("users", to).getString("name") } catch (_) { lib.fail("العضو مش موجود") }
  if (lib.settingsOf(e.app, to).blocked[me.id]) lib.forbid("مينفعش تبعتله")
  const admin = lib.isAdmin(e.app, me.id)
  const price = P.RINGS[ring - 1]
  let id = ""
  e.app.runInTransaction((tx) => {
    if (P.partnerOf(tx, me.id)) lib.fail("انت مرتبط بالفعل")
    if (P.partnerOf(tx, to)) lib.fail(toName + " مرتبط بالفعل")
    const mine = tx.findRecordsByFilter("proposals", "asker = {:u} && status = 'pending'", "", 1, 0, { u: me.id })
    if (mine.length) lib.fail("عندك طلب لسه مستني رد — ألغيه الأول")
    if (!admin) g.addCoins(tx, me.id, -price, "ring", P.RING_NAMES[ring - 1] + " لـ " + toName)
    const r = new Record(tx.findCollectionByNameOrId("proposals"))
    r.set("asker", me.id); r.set("askerName", me.getString("name")); r.set("target", to); r.set("targetName", toName)
    r.set("ring", ring); r.set("paid", admin ? 0 : price); r.set("status", "pending")
    tx.save(r)
    id = r.id
  })
  try { require(`${__hooks}/pushlib.js`).send(e.app, to, { title: "💍 طلب ارتباط", body: me.getString("name") + " عايز يرتبط بيك ب" + P.RING_NAMES[ring - 1], url: "#/u/" + me.id, tag: "ring" }) } catch (_) {}
  return e.json(200, { ok: true, id })
}, $apis.requireAuth("users"))

// ===== الرد على الطلب (موافقة أو رفض) =====
routerAdd("POST", "/api/kemet/ring/answer", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  const P = require(`${__hooks}/perkslib.js`)
  const me = e.auth
  const b = e.requestInfo().body || {}
  const ok = !!b.ok
  let asker = "", askerName = "", ring = 0, taken = false
  e.app.runInTransaction((tx) => {
    let p
    try { p = tx.findRecordById("proposals", String(b.id || "")) } catch (_) { lib.fail("الطلب مش موجود") }
    if (p.getString("target") !== me.id) lib.forbid()
    if (p.getString("status") !== "pending") lib.fail("الطلب ده خلص")
    asker = p.getString("asker"); askerName = p.getString("askerName"); ring = p.getInt("ring")
    const refund = (x, why) => {
      if (x.getInt("paid") > 0) g.addCoins(tx, x.getString("asker"), x.getInt("paid"), "ring-back", why)
      x.set("status", "no"); tx.save(x)
    }
    if (!ok) { refund(p, "رجوع " + P.RING_NAMES[ring - 1] + " (" + me.getString("name") + " رفض)"); return }
    if (P.partnerOf(tx, me.id)) lib.fail("انت مرتبط بالفعل")
    if (P.partnerOf(tx, asker)) { refund(p, "رجوع " + P.RING_NAMES[ring - 1]); taken = true; return }
    const now = Date.now()
    const a = P.rec(tx, asker), m = P.rec(tx, me.id)
    a.set("partner", me.id); a.set("partnerName", me.getString("name")); a.set("ring", ring); a.set("since", now)
    m.set("partner", asker); m.set("partnerName", askerName); m.set("ring", ring); m.set("since", now)
    tx.save(a); tx.save(m)
    p.set("status", "ok"); tx.save(p)
    // أي طلبات تانية مستنية للاتنين بتتلغى وفلوسها ترجع
    const others = tx.findRecordsByFilter("proposals", "status = 'pending' && (asker = {:a} || asker = {:b} || target = {:a} || target = {:b})", "", 50, 0, { a: asker, b: me.id })
    for (const x of others) refund(x, "رجوع " + P.RING_NAMES[x.getInt("ring") - 1] + " (الطلب اتلغى)")
    // الدهب والألماظ: إعلان لكل الناس
    if (ring >= 2) {
      const ev = new Record(tx.findCollectionByNameOrId("events"))
      ev.set("kind", "couple"); ev.set("a", asker); ev.set("aName", askerName); ev.set("b", me.id); ev.set("bName", me.getString("name")); ev.set("ring", ring)
      tx.save(ev)
    }
  })
  if (taken) lib.fail(askerName + " ارتبط بحد تاني")
  try {
    require(`${__hooks}/pushlib.js`).send(e.app, asker, ok
      ? { title: "💞 مبروك!", body: me.getString("name") + " وافق على الارتباط", url: "#/u/" + me.id, tag: "ring" }
      : { title: "💍 طلب الارتباط", body: me.getString("name") + " رفض الطلب، والكوينز رجعتلك", url: "#/games", tag: "ring" })
  } catch (_) {}
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// ===== إلغاء طلبي =====
routerAdd("POST", "/api/kemet/ring/cancel", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  const P = require(`${__hooks}/perkslib.js`)
  const me = e.auth
  e.app.runInTransaction((tx) => {
    let p
    try { p = tx.findRecordById("proposals", String((e.requestInfo().body || {}).id || "")) } catch (_) { lib.fail("الطلب مش موجود") }
    if (p.getString("asker") !== me.id) lib.forbid()
    if (p.getString("status") !== "pending") lib.fail("الطلب ده خلص")
    if (p.getInt("paid") > 0) g.addCoins(tx, me.id, p.getInt("paid"), "ring-back", "رجوع " + P.RING_NAMES[p.getInt("ring") - 1] + " (لغيت الطلب)")
    p.set("status", "cancel"); tx.save(p)
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// ===== فك الارتباط =====
routerAdd("POST", "/api/kemet/ring/break", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const P = require(`${__hooks}/perkslib.js`)
  const me = e.auth
  let other = ""
  e.app.runInTransaction((tx) => {
    other = P.partnerOf(tx, me.id)
    if (!other) lib.fail("انت مش مرتبط")
    for (const uid of [me.id, other]) {
      const r = P.rec(tx, uid)
      if (uid === other && r.getString("partner") !== me.id) continue
      r.set("partner", ""); r.set("partnerName", ""); r.set("ring", 0); r.set("since", 0)
      tx.save(r)
    }
  })
  try { require(`${__hooks}/pushlib.js`).send(e.app, other, { title: "💔 الارتباط اتفك", body: me.getString("name") + " فك الارتباط", url: "#/profile", tag: "ring" }) } catch (_) {}
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// كل ساعة: الطلبات اللي عدّى عليها يومين من غير رد بتتلغى والكوينز بترجع، والإعلانات القديمة بتتمسح
cronAdd("kemetRings", "23 * * * *", () => {
  const g = require(`${__hooks}/gamelib.js`)
  const P = require(`${__hooks}/perkslib.js`)
  const old = new Date(Date.now() - P.PROPOSAL_MS).toISOString().replace("T", " ")
  const list = $app.findRecordsByFilter("proposals", "status = 'pending' && created < {:old}", "", 200, 0, { old })
  for (const p of list) {
    try {
      $app.runInTransaction((tx) => {
        const x = tx.findRecordById("proposals", p.id)
        if (x.getString("status") !== "pending") return
        if (x.getInt("paid") > 0) g.addCoins(tx, x.getString("asker"), x.getInt("paid"), "ring-back", "رجوع " + P.RING_NAMES[x.getInt("ring") - 1] + " (محدش رد)")
        x.set("status", "expired"); tx.save(x)
      })
    } catch (_) {}
  }
  const evOld = new Date(Date.now() - 7 * P.DAY).toISOString().replace("T", " ")
  for (const ev of $app.findRecordsByFilter("events", "created < {:o}", "", 200, 0, { o: evOld })) { try { $app.delete(ev) } catch (_) {} }
})
