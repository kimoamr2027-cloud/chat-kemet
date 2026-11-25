/// <reference path="../pb_data/types.d.ts" />
// 🎙 حفلات الأعضاء + 🎉 الغرف الحية + 🏆 لوحة الشرف + البانرات (الحسابات في partylib.js)

// افتح حفلتك: غرفة صوتية باسمك وانت صاحبها (واحدة بس لكل عضو)
routerAdd("POST", "/api/kemet/party/open", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const L = require(`${__hooks}/partylib.js`)
  const me = e.auth
  if (me.getBool("guest")) lib.forbid("سجّل حسابك الأول علشان تفتح حفلة 🎙")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  const name = String((e.requestInfo().body || {}).name || "").replace(/\s+/g, " ").trim()
  if (!lib.str(name, 2, 30)) lib.fail("اسم الحفلة من ٢ لـ ٣٠ حرف")
  if (!lib.clean(e.app, name)) lib.fail("الاسم فيه كلمة ممنوعة")
  const admin = lib.isAdmin(e.app, me.id)
  let vip = 0
  try { const x = e.app.findRecordById("vips", me.id); if (x.getInt("until") > Date.now()) vip = x.getInt("level") } catch (_) {}
  const age = Date.now() - new Date(me.getString("created").replace(" ", "T")).getTime()
  if (!admin && !vip && age < L.PARTY_MIN_DAYS * 86400000) lib.forbid("الحفلات للأعضاء اللي حسابهم عدّى " + L.PARTY_MIN_DAYS + " أيام (أو VIP) 👑")
  const mine = e.app.findRecordsByFilter("voice", "owner = {:u}", "", 1, 0, { u: me.id })
  if (mine.length) return e.json(200, { id: mine[0].id, existed: true })
  if (e.app.countRecords("voice", $dbx.exp("owner != ''")) >= L.PARTY_MAX) lib.fail("فيه حفلات كتير مفتوحة دلوقتي، جرب كمان شوية")
  const r = new Record(e.app.findCollectionByNameOrId("voice"))
  r.set("name", name); r.set("topic", ""); r.set("owner", me.id); r.set("ownerName", me.getString("name")); r.set("lastAt", Date.now())
  r.set("seats", { center: [{ uid: me.id, name: me.getString("name"), at: Date.now() }, null, null], ring: [null, null, null, null, null, null, null, null], locked: [] })
  r.set("muted", {}); r.set("hands", {}); r.set("here", 0)
  e.app.save(r)
  return e.json(200, { id: r.id })
}, $apis.requireAuth("users"))

// اقفل الحفلة: صاحبها أو الأدمن
routerAdd("POST", "/api/kemet/party/close", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const vl = require(`${__hooks}/voicelib.js`)
  const id = String((e.requestInfo().body || {}).id || "")
  let r = null
  try { r = e.app.findRecordById("voice", id) } catch (_) { lib.fail("الحفلة مش موجودة") }
  if (!r.getString("owner")) lib.forbid("دي غرفة الشات الرسمية")
  if (r.getString("owner") !== e.auth.id && !lib.isAdmin(e.app, e.auth.id)) lib.forbid()
  try { vl.call("DeleteRoom", { room: r.id }) } catch (_) {}
  e.app.delete(r)
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// مين في كل غرفة كتابة دلوقتي
routerAdd("GET", "/api/kemet/rooms/live", (e) => {
  return e.json(200, require(`${__hooks}/partylib.js`).liveRooms(e.app))
}, $apis.requireAuth("users"))

// 🏆 لوحة الشرف (النهارده / الأسبوع ده)
routerAdd("GET", "/api/kemet/honor", (e) => {
  const p = e.request.url.query().get("p") === "week" ? "week" : "day"
  return e.json(200, require(`${__hooks}/partylib.js`).honor(e.app, p))
}, $apis.requireAuth("users"))

// 🎉 البانرات: للكل (الشغالة بس)، والأدمن بيشوف الكل ويعدّل
routerAdd("GET", "/api/kemet/banners", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const L = require(`${__hooks}/partylib.js`)
  const all = L.banners(e.app)
  const admin = e.request.url.query().get("all") === "1" && lib.isAdmin(e.app, e.auth.id)
  return e.json(200, admin ? all : all.filter((b) => !b.until || b.until > Date.now()))
}, $apis.requireAuth("users"))
routerAdd("POST", "/api/kemet/banners", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const L = require(`${__hooks}/partylib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid()
  const list = (e.requestInfo().body || {}).list
  if (!Array.isArray(list) || list.length > 10) lib.fail("بانرات غلط (١٠ بالكتير)")
  const clean = list.map((x) => L.cleanBanner(e.app, x || {}))
  let rec = null
  try { rec = e.app.findRecordById("config", "banners") } catch (_) {}
  if (!rec) { rec = new Record(e.app.findCollectionByNameOrId("config")); rec.set("id", "banners") }
  rec.set("data", { list: clean })
  e.app.save(rec)
  return e.json(200, clean)
}, $apis.requireAuth("users"))

// 📺 الأكتر هدايا في اللايفات (آخر ساعة)
routerAdd("GET", "/api/kemet/live/top", (e) => {
  return e.json(200, require(`${__hooks}/partylib.js`).liveTop(e.app))
}, $apis.requireAuth("users"))

// كل ساعة: الحفلات اللي فضيت أيام بتتقفل
cronAdd("kemetPartyClean", "23 * * * *", () => {
  const L = require(`${__hooks}/partylib.js`)
  const cut = Date.now() - L.PARTY_IDLE_DAYS * 86400000
  for (const r of $app.findRecordsByFilter("voice", "owner != '' && here = 0 && lastAt < {:c}", "", 100, 0, { c: cut })) {
    try { $app.delete(r) } catch (err) { console.log("party clean: " + err) }
  }
})
