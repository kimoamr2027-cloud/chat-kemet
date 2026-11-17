/// <reference path="../pb_data/types.d.ts" />
// المرحلة ٢: الخاص، الإشعارات، الخصوصية، البلاغات

// ===== رسالة خاصة جديدة =====
// العميل بيبعت {chat, kind, text...}، والسيرفر بيتأكد من الحظر والخصوصية ويحدّث المحادثة
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const me = e.auth
  if (!me) throw new UnauthorizedError()
  if (!me.getString("name")) lib.forbid("كمّل بياناتك الأول")
  const r = e.record
  const chatId = r.getString("chat")
  const other = lib.chatOther(chatId, me.id)
  if (other === me.id) lib.forbid()
  try { e.app.findRecordById("users", other) } catch (_) { lib.fail("العضو مش موجود") }
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  let chat = null
  try { chat = e.app.findRecordById("chats", chatId) } catch (_) {}
  if (!lib.canMessage(e.app, me.id, other, chat)) lib.forbid("العضو ده مش بيستقبل رسايل خاصة منك")

  const p = chatId.split("_")
  r.set("a", p[0]); r.set("b", p[1])
  r.set("uid", me.id)
  r.set("reactions", {})
  r.set("edited", false)
  lib.content(e.app, r, { chat: chatId })
  const rep = lib.readJSON(r, "replyTo")
  if (rep) {
    if (!lib.str(rep.name, 1, 30) || !lib.str(rep.text, 1, 200)) lib.fail("الرد غلط")
    r.set("replyTo", { name: rep.name, text: rep.text })
  }
  e.next()

  // المحادثة: آخر رسالة + غير المقروء عند التاني
  e.app.runInTransaction((tx) => {
    let c
    try { c = tx.findRecordById("chats", chatId) } catch (_) {
      c = new Record(tx.findCollectionByNameOrId("chats"))
      c.set("id", chatId); c.set("a", p[0]); c.set("b", p[1])
    }
    const unread = lib.readJSON(c, "unread") || {}
    unread[other] = (unread[other] || 0) + 1
    const active = lib.readJSON(c, "active") || {}
    active[me.id] = true
    const typing = lib.readJSON(c, "typing") || {}
    delete typing[me.id]
    c.set("unread", unread); c.set("active", active); c.set("typing", typing)
    c.set("last", { uid: me.id, text: lib.preview(r) || "…", at: new Date().toISOString(), id: r.id })
    c.set("updatedAt", new DateTime())
    tx.save(c)
  })
}, "dms")

// مسح رسالتي: لو كانت آخر رسالة، المعاينة تبقى "اتمسحت"
onRecordDeleteRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  e.next()
  try {
    const c = e.app.findRecordById("chats", e.record.getString("chat"))
    const last = lib.readJSON(c, "last") || {}
    if (last.id === e.record.id) { last.text = "🚫 رسالة اتمسحت"; c.set("last", last); e.app.save(c) }
  } catch (_) {}
}, "dms")

// ===== قريت المحادثة / بكتب دلوقتي =====
routerAdd("POST", "/api/kemet/dm/read", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const b = e.requestInfo().body || {}
  lib.chatOther(b.chat, e.auth.id)
  e.app.runInTransaction((tx) => {
    const c = tx.findRecordById("chats", String(b.chat))
    const unread = lib.readJSON(c, "unread") || {}
    unread[e.auth.id] = 0
    c.set("unread", unread)
    if (b.receipt) {
      const readAt = lib.readJSON(c, "readAt") || {}
      readAt[e.auth.id] = new Date().toISOString()
      c.set("readAt", readAt)
    }
    tx.save(c)
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

routerAdd("POST", "/api/kemet/dm/typing", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const b = e.requestInfo().body || {}
  lib.chatOther(b.chat, e.auth.id)
  if (lib.appBanned(e.app, e.auth.id)) return e.json(200, { ok: false })
  e.app.runInTransaction((tx) => {
    const c = tx.findRecordById("chats", String(b.chat))
    const typing = lib.readJSON(c, "typing") || {}
    typing[e.auth.id] = new Date().toISOString()
    c.set("typing", typing)
    tx.save(c)
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// تفاعل على رسالة خاصة
routerAdd("POST", "/api/kemet/dm/react", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const b = e.requestInfo().body || {}
  const emoji = b.emoji || null
  if (emoji !== null && lib.REACTIONS.indexOf(emoji) < 0) lib.fail("تفاعل غلط")
  e.app.runInTransaction((tx) => {
    const r = tx.findRecordById("dms", String(b.id || ""))
    lib.chatOther(r.getString("chat"), e.auth.id)
    const re = lib.readJSON(r, "reactions") || {}
    if (emoji) re[e.auth.id] = emoji
    else delete re[e.auth.id]
    r.set("reactions", re)
    tx.save(r)
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// تعديل رسالتي الخاصة (خلال ١٥ دقيقة)
routerAdd("POST", "/api/kemet/dm/edit", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const b = e.requestInfo().body || {}
  const text = String(b.text || "").trim()
  if (!lib.str(text, 1, 1000) || !lib.clean(e.app, text)) lib.fail("الرسالة غلط أو فيها كلمة ممنوعة")
  const r = e.app.findRecordById("dms", String(b.id || ""))
  if (r.getString("uid") !== e.auth.id || r.getString("kind") !== "text") lib.forbid()
  if (Date.now() - new Date(r.getString("created").replace(" ", "T")).getTime() > 15 * 60 * 1000) lib.forbid("التعديل خلال ١٥ دقيقة بس")
  r.set("text", text)
  r.set("edited", true)
  e.app.save(r)
  try {
    const c = e.app.findRecordById("chats", r.getString("chat"))
    const last = lib.readJSON(c, "last") || {}
    if (last.id === r.id) { last.text = text.slice(0, 100); c.set("last", last); e.app.save(c) }
  } catch (_) {}
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// ===== الإشعارات =====
// العضو بيطلب إشعار لعضو تاني، والسيرفر بيتأكد إن وراه حاجة حقيقية (رسالة/رد/ذكر/تفاعل/تعيين مشرف)
// ولو المستقبل حاظره أو قافل النوع ده: بنتجاهل من غير ما نقول
routerAdd("POST", "/api/kemet/notify", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const me = e.auth
  const b = e.requestInfo().body || {}
  const to = String(b.to || "")
  const type = String(b.type || "")
  const msgId = String(b.msgId || "")
  if (!to || to === me.id) lib.fail("مستقبل غلط")
  try { e.app.findRecordById("users", to) } catch (_) { lib.fail("العضو مش موجود") }
  const text = String(b.text || "").slice(0, 120)
  const st = lib.settingsOf(e.app, to)
  const skip = () => e.json(200, { ok: false })
  if (st.blocked[me.id]) return skip()

  let id = ""
  let roomId = ""
  let emoji = ""
  const roomMsg = () => {
    const m = e.app.findRecordById("messages", msgId)
    roomId = m.getString("room")
    return m
  }
  if (type === "dm") {
    if (st.notif.dms === false) return skip()
    const m = e.app.findRecordById("dms", msgId)
    if (m.getString("uid") !== me.id || m.getString("chat") !== [me.id, to].sort().join("_")) lib.forbid()
    id = "dm_" + me.id
  } else if (type === "reply" || type === "mention" || type === "react") {
    if (st.notif.mentions === false) return skip()
    const m = roomMsg()
    if (type === "reply") {
      if (m.getString("uid") !== me.id || (lib.readJSON(m, "replyTo") || {}).uid !== to) lib.forbid()
    } else if (type === "mention") {
      const toName = e.app.findRecordById("users", to).getString("name")
      if (m.getString("uid") !== me.id || !toName || m.getString("text").indexOf("@" + toName) < 0) lib.forbid()
    } else {
      emoji = String(b.emoji || "")
      if (m.getString("uid") !== to || (lib.readJSON(m, "reactions") || {})[me.id] !== emoji) lib.forbid()
      id = "react_" + msgId + "_" + me.id
    }
  } else if (type === "mod") {
    roomId = String(b.roomId || "")
    if (!lib.isAdmin(e.app, me.id) || (lib.roles(e.app).mods[roomId] || []).indexOf(to) < 0) lib.forbid()
  } else lib.fail("نوع غلط")

  let roomName = ""
  if (roomId) { try { roomName = e.app.findRecordById("rooms", roomId).getString("name") } catch (_) { lib.fail("الغرفة مش موجودة") } }
  let n = null
  if (id) { try { n = e.app.findRecordById("notifications", id) } catch (_) {} }
  if (!n) { n = new Record(e.app.findCollectionByNameOrId("notifications")); if (id) n.set("id", id) }
  n.set("owner", to); n.set("type", type); n.set("from", me.id); n.set("fromName", me.getString("name"))
  n.set("text", text); n.set("roomId", roomId); n.set("roomName", roomName); n.set("msgId", type === "mod" ? "" : msgId)
  n.set("emoji", emoji); n.set("read", false); n.set("at", new DateTime())
  e.app.save(n)
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// صاحب الإشعار يعلّم إنه قراه بس
onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const old = e.record.original()
  for (const f of ["owner", "type", "from", "fromName", "text", "roomId", "roomName", "msgId", "emoji", "at"]) {
    if (String(e.record.get(f)) !== String(old.get(f))) lib.forbid()
  }
  e.next()
}, "notifications")

routerAdd("POST", "/api/kemet/notifs/read-all", (e) => {
  const list = e.app.findRecordsByFilter("notifications", "owner = {:me} && read = false", "", 200, 0, { me: e.auth.id })
  e.app.runInTransaction((tx) => { for (const n of list) { n.set("read", true); tx.save(n) } })
  return e.json(200, { ok: true, n: list.length })
}, $apis.requireAuth("users"))

// ===== إعدادات الخصوصية =====
onRecordCreateRequest((e) => require(`${__hooks}/lib.js`).checkSettings(e), "settings")
onRecordUpdateRequest((e) => require(`${__hooks}/lib.js`).checkSettings(e), "settings")

// ===== البلاغات =====
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const REASONS = ["إزعاج أو رسائل كتير", "كلام أو صور مش لائقة", "تحرش أو تهديد", "حساب مزيف أو نصب", "حاجة تانية"]
  const r = e.record
  r.set("reporter", e.auth.id)
  if (!lib.str(r.getString("reported"), 1, 64) || r.getString("reported") === e.auth.id) lib.fail("بلاغ غلط")
  if (REASONS.indexOf(r.getString("reason")) < 0) lib.fail("سبب غلط")
  e.next()
}, "reports")

routerAdd("GET", "/api/kemet/reports", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid()
  const list = e.app.findRecordsByFilter("reports", "id != ''", "-created", 200, 0)
  return e.json(200, list.map((r) => ({
    id: r.id, reporter: r.getString("reporter"), reported: r.getString("reported"), reportedName: r.getString("reportedName"),
    reason: r.getString("reason"), chatId: r.getString("chatId"), created: r.getString("created"),
  })))
}, $apis.requireAuth("users"))

routerAdd("DELETE", "/api/kemet/reports/{id}", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid()
  e.app.delete(e.app.findRecordById("reports", e.request.pathValue("id")))
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))
