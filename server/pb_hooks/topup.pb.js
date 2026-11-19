// شحن الكوينز بفودافون كاش (يدوي): العضو بيحوّل ويبعت الطلب، والأدمن بيتأكد من فودافون كاش ويوافق
// الباقات (٥٠ كوين بجنيه + هدية على الباقات الكبيرة) — نفس اللي في src/topup.js

// رقم فودافون كاش + الباقات (لأي عضو)
routerAdd("GET", "/api/kemet/pay", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  let d = {}
  try { d = lib.readJSON(e.app.findRecordById("config", "pay"), "data") || {} } catch (_) {}
  return e.json(200, { vodafone: d.vodafone || "", packs: [[10, 500], [25, 1375], [50, 2875], [100, 6000], [200, 12500]] })
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
  const PACKS = [[10, 500], [25, 1375], [50, 2875], [100, 6000], [200, 12500]]
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

// الأدمن: مكسب الشات (من الشحن) + الناس بتصرف الكوينز على إيه
routerAdd("GET", "/api/kemet/earnings", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  const DAY = 86400000, OFF = 7200000 // توقيت مصر
  const today = Math.floor((Date.now() + OFF) / DAY) * DAY - OFF
  const d = new Date(today + OFF)
  const week = today - ((d.getUTCDay() + 1) % 7) * DAY // الأسبوع بيبدأ السبت
  const month = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - OFF
  const sumSince = (since) => {
    const r = new DynamicModel({ egp: 0, n: 0, payers: 0 })
    e.app.db().newQuery("SELECT COALESCE(SUM(egp),0) AS egp, COUNT(*) AS n, COUNT(DISTINCT owner) AS payers FROM topups WHERE status = 'approved' AND decided >= {:s}").bind({ s: since }).one(r)
    return { egp: r.egp, n: r.n, payers: r.payers }
  }
  // آخر ٧ أيام (بالجنيه)
  const days = []
  for (let i = 6; i >= 0; i--) {
    const from = today - i * DAY
    const r = new DynamicModel({ egp: 0 })
    e.app.db().newQuery("SELECT COALESCE(SUM(egp),0) AS egp FROM topups WHERE status = 'approved' AND decided >= {:a} AND decided < {:b}").bind({ a: from, b: from + DAY }).one(r)
    days.push({ at: from, egp: r.egp })
  }
  // الكوينز اتصرفت على إيه الشهر ده
  const iso = new Date(month).toISOString().replace("T", " ")
  const rows = arrayOf(new DynamicModel({ kind: "", coins: 0 }))
  e.app.db().newQuery("SELECT kind, COALESCE(SUM(-amount),0) AS coins FROM coinlog WHERE amount < 0 AND created >= {:s} GROUP BY kind").bind({ s: iso }).all(rows)
  const spent = {}
  for (const r of rows) spent[r.kind] = r.coins
  const pending = new DynamicModel({ n: 0, egp: 0 })
  e.app.db().newQuery("SELECT COUNT(*) AS n, COALESCE(SUM(egp),0) AS egp FROM topups WHERE status = 'pending'").bind({}).one(pending)
  return e.json(200, { today: sumSince(today), week: sumSince(week), month: sumSince(month), all: sumSince(0), days, spent, pending: { n: pending.n, egp: pending.egp } })
}, $apis.requireAuth("users"))
