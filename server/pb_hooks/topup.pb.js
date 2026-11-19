// شحن الكوينز بفودافون كاش (يدوي): العضو بيحوّل ويبعت الطلب، والأدمن بيتأكد من فودافون كاش ويوافق
// الباقات (١٠٠ كوين بجنيه + هدية على الباقات الكبيرة) — نفس اللي في src/topup.js

// رقم فودافون كاش + الباقات (لأي عضو)
routerAdd("GET", "/api/kemet/pay", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  let d = {}
  try { d = lib.readJSON(e.app.findRecordById("config", "pay"), "data") || {} } catch (_) {}
  return e.json(200, { vodafone: d.vodafone || "", packs: [[10, 1000], [25, 2750], [50, 5750], [100, 12000], [200, 25000]] })
}, $apis.requireAuth("users"))

// الأدمن بيغيّر الرقم
routerAdd("POST", "/api/kemet/pay", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  const num = String((e.requestInfo().body || {}).vodafone || "").replace(/[^0-9]/g, "")
  if (num && !/^01[0125][0-9]{8}$/.test(num)) lib.fail("الرقم غلط")
  let r
  try { r = e.app.findRecordById("config", "pay") } catch (_) { r = new Record(e.app.findCollectionByNameOrId("config")); r.set("id", "pay") }
  r.set("data", { vodafone: num })
  e.app.save(r)
  return e.json(200, { vodafone: num })
}, $apis.requireAuth("users"))

// العضو بيبعت طلب شحن
routerAdd("POST", "/api/kemet/topup", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const PACKS = [[10, 1000], [25, 2750], [50, 5750], [100, 12000], [200, 25000]]
  const me = e.auth
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  const b = e.requestInfo().body || {}
  const p = PACKS[parseInt(b.pack, 10)]
  if (!p) lib.fail("باقة غلط")
  const sender = String(b.sender || "").replace(/[^0-9]/g, "")
  if (!/^01[0125][0-9]{8}$/.test(sender)) lib.fail("اكتب رقم فودافون كاش اللي حوّلت منه صح (١١ رقم)")
  const proof = String(b.proof || "")
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(proof) || proof.length > 450000) lib.fail("ارفع صورة رسالة التحويل")
  const pending = e.app.findRecordsByFilter("topups", "owner = {:me} && status = 'pending'", "", 10, 0, { me: me.id })
  if (pending.length >= 3) lib.fail("عندك ٣ طلبات مستنية — استنى الأدمن يراجعهم")
  const r = new Record(e.app.findCollectionByNameOrId("topups"))
  r.set("owner", me.id); r.set("name", me.getString("name")); r.set("egp", p[0]); r.set("coins", p[1])
  r.set("sender", sender); r.set("proof", proof); r.set("status", "pending")
  e.app.save(r)
  // إشعار للأدمن
  const push = require(`${__hooks}/pushlib.js`)
  for (const a of lib.roles(e.app).admins) {
    try { push.send(e.app, a, { title: "💳 طلب شحن جديد", body: me.getString("name") + " حوّل " + p[0] + " جنيه (" + p[1] + " كوين)", url: "#/admin", tag: "topup" }) } catch (_) {}
  }
  return e.json(200, { id: r.id })
}, $apis.requireAuth("users"))

// الأدمن: الطلبات (المستنية بصورها + آخر اللي اتراجعوا)
routerAdd("GET", "/api/kemet/topups", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  const row = (r, withProof) => ({ id: r.id, owner: r.getString("owner"), name: r.getString("name"), egp: r.getInt("egp"), coins: r.getInt("coins"), sender: r.getString("sender"),
    status: r.getString("status"), note: r.getString("note"), created: r.getString("created"), decided: r.getInt("decided"), proof: withProof ? r.getString("proof") : "" })
  const pending = e.app.findRecordsByFilter("topups", "status = 'pending'", "created", 100, 0).map((r) => row(r, true))
  const done = e.app.findRecordsByFilter("topups", "status != 'pending'", "-decided", 30, 0).map((r) => row(r, false))
  return e.json(200, { pending, done })
}, $apis.requireAuth("users"))

// الأدمن بيوافق أو يرفض
routerAdd("POST", "/api/kemet/topup/decide", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  const b = e.requestInfo().body || {}
  const ok = !!b.ok
  let r
  e.app.runInTransaction((tx) => {
    try { r = tx.findRecordById("topups", String(b.id || "")) } catch (_) { lib.fail("الطلب مش موجود") }
    if (r.getString("status") !== "pending") lib.fail("الطلب ده اتراجع قبل كده")
    r.set("status", ok ? "approved" : "rejected"); r.set("decided", Date.now()); r.set("note", String(b.note || "").slice(0, 120))
    r.set("proof", "") // الصورة مش محتاجينها بعد المراجعة
    tx.save(r)
    if (ok) g.addCoins(tx, r.getString("owner"), r.getInt("coins"), "topup", "شحن " + r.getInt("egp") + " جنيه بفودافون كاش")
  })
  const push = require(`${__hooks}/pushlib.js`)
  try {
    push.send(e.app, r.getString("owner"), ok
      ? { title: "✅ الكوينز نزلت!", body: "اتشحنلك " + r.getInt("coins") + " كوين — استمتع 👑", url: "#/games", tag: "topup" }
      : { title: "❌ طلب الشحن اترفض", body: r.getString("note") || "التحويل ماوصلش — كلّم الأدمن", url: "#/games", tag: "topup" })
  } catch (_) {}
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))
