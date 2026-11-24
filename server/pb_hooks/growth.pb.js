/// <reference path="../pb_data/types.d.ts" />
// جذب الأعضاء: لينك الدعوة + إشعار «وحشتنا» للي بقاله يومين مادخلش

// ===== لينك الدعوة =====
// كل عضو مسجّل ليه لينك (chatkemet.pages.dev/?ref=رقمه). صاحبه لما يسجّل (حساب جديد، في أول ٧ أيام)
// الاتنين بياخدوا ٢٠٠ كوين — مرة واحدة لكل حساب، وبحد أقصى ١٠ دعوات في اليوم لكل عضو
routerAdd("GET", "/api/kemet/invite", (e) => {
  const n = e.app.countRecords("users", $dbx.hashExp({ invitedBy: e.auth.id }))
  return e.json(200, { count: n, reward: 200 })
}, $apis.requireAuth("users"))

routerAdd("POST", "/api/kemet/invite", (e) => {
  const g = require(`${__hooks}/gamelib.js`)
  const lib = require(`${__hooks}/lib.js`)
  const REWARD = 200, DAILY_CAP = 10, NEW_DAYS = 7, DAY = 86400000
  const ref = String((e.requestInfo().body || {}).ref || "")
  const me = e.app.findRecordById("users", e.auth.id)
  if (me.getBool("guest")) lib.forbid("سجّل حسابك الأول علشان تاخد هدية الدعوة")
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(ref) || ref === me.id) lib.fail("لينك الدعوة غلط")
  if (me.getString("invitedBy")) lib.fail("خدت هدية الدعوة قبل كده")
  const created = new Date(me.getString("created").replace(" ", "T")).getTime()
  if (!(Date.now() - created < NEW_DAYS * DAY)) lib.fail("هدية الدعوة للحسابات الجديدة بس")
  let inviter
  try { inviter = e.app.findRecordById("users", ref) } catch (_) { lib.fail("لينك الدعوة غلط") }
  if (inviter.getBool("guest") || !inviter.getString("name")) lib.fail("لينك الدعوة غلط")
  if (lib.appBanned(e.app, ref) || lib.appBanned(e.app, me.id)) lib.forbid()
  // حد أقصى في اليوم (بتوقيت مصر)
  const dayStart = new Date(g.dayNum() * DAY - 7200000).toISOString().replace("T", " ")
  const today = e.app.countRecords("coinlog", $dbx.exp("owner = {:u} AND kind = 'invite' AND created >= {:d}", { u: ref, d: dayStart }))
  const capped = today >= DAILY_CAP
  e.app.runInTransaction((tx) => {
    const u = tx.findRecordById("users", me.id)
    if (u.getString("invitedBy")) lib.fail("خدت هدية الدعوة قبل كده")
    u.set("invitedBy", ref)
    tx.saveNoValidate(u)
    g.addCoins(tx, me.id, REWARD, "invite", "هدية الدعوة من " + inviter.getString("name"))
    if (!capped) g.addCoins(tx, ref, REWARD, "invite", "صاحبك " + me.getString("name") + " سجّل بلينكك")
  })
  if (!capped) {
    try { require(`${__hooks}/pushlib.js`).send(e.app, ref, { title: "🎉 صاحبك سجّل بلينكك!", body: me.getString("name") + " دخل كيمت، وخدت " + REWARD + " كوين", url: "#/games", tag: "invite" }) } catch (_) {}
  }
  return e.json(200, { reward: REWARD })
}, $apis.requireAuth("users"))

// ===== «وحشتنا» =====
// كل يوم الساعة ٧:١٣ بالليل (مصر): إشعار للي آخر مرة دخل من ٢ لـ ١٤ يوم، ومرة كل ٣ أيام بالكتير
cronAdd("kemetNudge", "13 17 * * *", () => {
  try {
    const lib = require(`${__hooks}/lib.js`)
    const push = require(`${__hooks}/pushlib.js`)
    const DAY = 86400000, now = Date.now()
    const fmt = (ms) => new Date(ms).toISOString().replace("T", " ")
    const online = $app.countRecords("presence", $dbx.exp("at >= {:c}", { c: fmt(now - 5 * 60000) }))
    const list = $app.findRecordsByFilter("presence", "at <= {:a} && at >= {:b}", "-at", 300, 0, { a: fmt(now - 2 * DAY), b: fmt(now - 14 * DAY) })
    let sent = 0
    for (const p of list) {
      const uid = p.id
      let u
      try { u = $app.findRecordById("users", uid) } catch (_) { continue }
      if (!u.getString("name") || u.getInt("nudgedAt") > now - 3 * DAY || lib.appBanned($app, uid)) continue
      if (!$app.countRecords("pushsubs", $dbx.hashExp({ owner: uid }))) continue
      const unread = $app.countRecords("notifications", $dbx.hashExp({ owner: uid, read: false }))
      const payload = unread > 0
        ? { title: "📩 فيه حاجات مستنياك في كيمت", body: "عندك " + unread + " إشعار جديد — ادخل شوف مين كلّمك", url: "#/notifications", tag: "nudge" }
        : { title: "👋 وحشتنا يا " + u.getString("name"), body: online >= 3 ? online + " أعضاء أونلاين دلوقتي — تعالى دردش معاهم" : "الغرف مستنياك — ادخل دردش والعب واكسب كوينز", url: "#/rooms", tag: "nudge" }
      try { if (push.send($app, uid, payload).sent) sent++ } catch (_) {}
      u.set("nudgedAt", now)
      $app.saveNoValidate(u)
    }
    console.log("nudge: sent " + sent + " of " + list.length)
  } catch (err) { console.log("nudge failed: " + err) }
})

// ===== أرقام الأدمن: أعضاء وزوار ودعوات =====
routerAdd("GET", "/api/kemet/admin/growth", (e) => {
  const g = require(`${__hooks}/gamelib.js`)
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  const DAY = 86400000
  const today = new Date(g.dayNum() * DAY - 7200000).toISOString().replace("T", " ")
  const c = (coll, where, params) => e.app.countRecords(coll, $dbx.exp(where, params || {}))
  return e.json(200, {
    members: c("users", "name != '' AND guest = FALSE"),
    membersToday: c("users", "name != '' AND guest = FALSE AND created >= {:t}", { t: today }),
    guests: c("users", "name != '' AND guest = TRUE"),
    guestsToday: c("users", "name != '' AND guest = TRUE AND created >= {:t}", { t: today }),
    invites: c("users", "invitedBy != ''"),
    invitesToday: c("coinlog", "kind = 'invite' AND created >= {:t} AND note LIKE {:p}", { t: today, p: "هدية الدعوة%" }),
  })
}, $apis.requireAuth("users"))

// ===== «مين جديد النهارده» =====
// اللي عملوا حساب في آخر ٢٤ ساعة (آخر ٢٠)، ومعاهم: انا رحّبت بيه ولا لأ
routerAdd("GET", "/api/kemet/newcomers", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const me = e.auth.id
  const since = new Date(Date.now() - 86400000).toISOString().replace("T", " ")
  const list = e.app.findRecordsByFilter("users", "created >= {:s} && name != '' && id != {:me} && id != 'kemetbot' && id != 'nefertari'", "-created", 30, 0, { s: since, me })
  const out = []
  for (const u of list) {
    if (out.length >= 20) break
    if (lib.appBanned(e.app, u.id)) continue
    let welcomed = false
    try { e.app.findRecordById("notifications", "welcome_" + me + "_" + u.id); welcomed = true } catch (_) {}
    out.push({ uid: u.id, name: u.getString("name"), guest: u.getBool("guest"), welcomed })
  }
  return e.json(200, out)
}, $apis.requireAuth("users"))

// ===== مهام أول أسبوع =====
// كل مهمة بتتأكد من السيرفر، ومكافأتها مرة واحدة، وبس في أول ٧ أيام من عمل الحساب
routerAdd("GET", "/api/kemet/tasks", (e) => {
  const { KEMET_TASKS, kemetTaskState } = require(`${__hooks}/starlib.js`)
  const u = e.app.findRecordById("users", e.auth.id)
  const created = new Date(u.getString("created").replace(" ", "T")).getTime()
  const left = 7 * 86400000 - (Date.now() - created)
  if (left <= 0) return e.json(200, { expired: true, tasks: [] })
  let claimed = {}
  try { claimed = JSON.parse(u.getString("tasks") || "{}") || {} } catch (_) {}
  const done = kemetTaskState(e.app, u)
  const guest = u.getBool("guest")
  const tasks = [
    ...KEMET_TASKS.map((t) => ({ key: t.key, coins: t.coins, done: done[t.key], claimed: !!claimed[t.key], locked: !!(t.members && guest) })),
    { key: "invite", coins: 200, done: done.invite, claimed: done.invite, locked: guest },
  ]
  return e.json(200, { expired: false, daysLeft: Math.ceil(left / 86400000), tasks })
}, $apis.requireAuth("users"))

routerAdd("POST", "/api/kemet/tasks/claim", (e) => {
  const g = require(`${__hooks}/gamelib.js`)
  const lib = require(`${__hooks}/lib.js`)
  const { KEMET_TASKS, kemetTaskState } = require(`${__hooks}/starlib.js`)
  const key = String((e.requestInfo().body || {}).task || "")
  const t = KEMET_TASKS.find((x) => x.key === key)
  if (!t) lib.fail("مهمة غلط")
  const NAMES = { msg: "أول رسالة في غرفة", game: "أول لعبة", dm: "أول رسالة خاصة", avatar: "صورة البروفايل" }
  let coins = 0
  e.app.runInTransaction((tx) => {
    const u = tx.findRecordById("users", e.auth.id)
    if (Date.now() - new Date(u.getString("created").replace(" ", "T")).getTime() > 7 * 86400000) lib.fail("المهام خلصت (أول ٧ أيام بس)")
    if (t.members && u.getBool("guest")) lib.forbid("سجّل حسابك الأول")
    let claimed = {}
    try { claimed = JSON.parse(u.getString("tasks") || "{}") || {} } catch (_) {}
    if (claimed[key]) lib.fail("خدت المكافأة دي قبل كده")
    if (!kemetTaskState(tx, u)[key]) lib.fail("لسه ماعملتش المهمة دي")
    claimed[key] = Date.now()
    u.set("tasks", claimed)
    tx.saveNoValidate(u)
    coins = g.addCoins(tx, u.id, t.coins, "task", "🎯 مهمة: " + NAMES[key])
  })
  return e.json(200, { coins })
}, $apis.requireAuth("users"))

// ===== نجم الأسبوع: كل اتنين الساعة ١٢:٠٧ بالليل (مصر) =====
cronAdd("kemetStar", "7 22 * * 0", () => {
  try {
    const s = require(`${__hooks}/starlib.js`).pickStar($app)
    if (s) console.log("star of the week: " + s.name + " (" + s.n + ")")
  } catch (err) { console.log("star failed: " + err) }
})

// «نفرتاري 🤖» متصلة على طول (كل دقيقة)
cronAdd("kemetHostOnline", "* * * * *", () => {
  try {
    let p
    try { p = $app.findRecordById("presence", "nefertari") } catch (_) { p = new Record($app.findCollectionByNameOrId("presence")); p.set("id", "nefertari") }
    p.set("at", new DateTime()); p.set("name", "نفرتاري 🤖"); p.set("room", "")
    $app.save(p)
  } catch (err) { console.log("host presence failed: " + err) }
})
