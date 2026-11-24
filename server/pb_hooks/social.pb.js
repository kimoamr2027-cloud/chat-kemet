/// <reference path="../pb_data/types.d.ts" />
// مين زار بروفايلك + الأصحاب

// ===== زيارة بروفايل =====
// سجل واحد لكل (صاحب البروفايل، الزائر)، وبيتحدّث مرة كل ١٠ دقايق بالكتير
// اللي قافل «يظهر إني متصل» (وضع الخفي) زياراته مابتتسجّلش
routerAdd("POST", "/api/kemet/visit", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const me = e.auth
  const to = String((e.requestInfo().body || {}).uid || "")
  if (!to || to === me.id || to === "nefertari" || to === "kemetbot" || !me.getString("name")) return e.json(200, { ok: false })
  try { e.app.findRecordById("users", to) } catch (_) { return e.json(200, { ok: false }) }
  try { if (e.app.findRecordById("settings", me.id).getBool("hideOnline")) return e.json(200, { ok: false }) } catch (_) {}
  if (lib.settingsOf(e.app, to).blocked[me.id]) return e.json(200, { ok: false })
  const id = to + "_" + me.id
  let v = null
  try { v = e.app.findRecordById("visits", id) } catch (_) {}
  if (v && Date.now() - new Date(v.getString("at").replace(" ", "T")).getTime() < 600000) return e.json(200, { ok: true })
  if (!v) { v = new Record(e.app.findCollectionByNameOrId("visits")); v.set("id", id); v.set("owner", to); v.set("visitor", me.id) }
  v.set("visitorName", me.getString("name")); v.set("n", v.getInt("n") + 1); v.set("at", new DateTime())
  e.app.save(v)
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

cronAdd("kemetVisitsClean", "51 3 * * *", () => {
  try {
    const old = new Date(Date.now() - 30 * 86400000).toISOString().replace("T", " ")
    $app.db().newQuery("DELETE FROM visits WHERE at < {:o}").bind({ o: old }).execute()
  } catch (err) { console.log("visits clean failed: " + err) }
})

// ===== الأصحاب =====
// action: add (طلب أو قبول لو هو كان طالب) / accept / remove (إلغاء الطلب أو الصداقة)
routerAdd("POST", "/api/kemet/friend", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const me = e.app.findRecordById("users", e.auth.id)
  const b = e.requestInfo().body || {}
  const other = String(b.uid || "")
  const action = String(b.action || "")
  if (!other || other === me.id || other === "nefertari" || other === "kemetbot") lib.fail("عضو غلط")
  let them
  try { them = e.app.findRecordById("users", other) } catch (_) { lib.fail("العضو مش موجود") }
  const [x, y] = me.id < other ? [me.id, other] : [other, me.id]
  const id = x + "_" + y
  let f = null
  try { f = e.app.findRecordById("friends", id) } catch (_) {}
  const notify = (text, push) => {
    try {
      let n = null
      const nid = "friend_" + me.id + "_" + other
      try { n = e.app.findRecordById("notifications", nid) } catch (_) {}
      if (!n) { n = new Record(e.app.findCollectionByNameOrId("notifications")); n.set("id", nid) }
      n.set("owner", other); n.set("type", "friend"); n.set("from", me.id); n.set("fromName", me.getString("name"))
      n.set("text", text); n.set("roomId", ""); n.set("roomName", ""); n.set("msgId", ""); n.set("emoji", ""); n.set("read", false); n.set("at", new DateTime())
      e.app.save(n)
      require(`${__hooks}/pushlib.js`).send(e.app, other, { title: me.getString("name"), body: push, url: "#/u/" + me.id, tag: "friend_" + me.id })
    } catch (_) {}
  }
  if (action === "remove") {
    if (f) e.app.delete(f)
    return e.json(200, { status: "" })
  }
  if (action !== "add" && action !== "accept") lib.fail("حركة غلط")
  if (me.getBool("guest")) lib.forbid("سجّل حسابك الأول علشان تضيف أصحاب")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  if (lib.settingsOf(e.app, other).blocked[me.id] || lib.settingsOf(e.app, me.id).blocked[other]) lib.forbid("مش هينفع")
  // هو كان باعتلي طلب: كده بقينا أصحاب
  if (f && f.getString("status") === "pending" && f.getString("from") === other) {
    f.set("status", "ok"); e.app.save(f)
    notify("ok", "قبل طلب الصداقة 🎉 بقيتوا أصحاب")
    return e.json(200, { status: "ok" })
  }
  if (action === "accept") lib.fail("مفيش طلب")
  if (f) return e.json(200, { status: f.getString("status"), from: f.getString("from") })
  if (them.getBool("guest")) lib.fail("الزائر لازم يسجّل الأول علشان يبقى صاحبك")
  const day = new Date(Date.now() - 86400000).toISOString().replace("T", " ")
  if (e.app.countRecords("friends", $dbx.exp("[[from]] = {:u} AND created >= {:d}", { u: me.id, d: day })) >= 30) lib.fail("بعت طلبات كتير النهارده، كمّل بكرة")
  if (e.app.countRecords("friends", $dbx.exp("(a = {:u} OR b = {:u}) AND status = 'ok'", { u: me.id })) >= 300) lib.fail("وصلت لأقصى عدد أصحاب (٣٠٠)")
  f = new Record(e.app.findCollectionByNameOrId("friends"))
  f.set("id", id); f.set("a", x); f.set("b", y); f.set("from", me.id); f.set("status", "pending"); f.set("alerts", {})
  e.app.save(f)
  notify("req", "بعتلك طلب صداقة 🤝")
  return e.json(200, { status: "pending", from: me.id })
}, $apis.requireAuth("users"))
