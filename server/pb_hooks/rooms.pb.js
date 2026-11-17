/// <reference path="../pb_data/types.d.ts" />
// الغرف والرسايل والإعدادات والمتصلين: مين يقدر يعمل إيه

// ===== الغرف =====
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  if (!lib.isAdmin(e.app, e.auth && e.auth.id)) lib.forbid("الأدمن بس اللي يعمل غرف")
  if (!lib.str(e.record.getString("name").trim(), 1, 30)) lib.fail("اسم الغرفة غلط")
  e.next()
}, "rooms")

onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const uid = e.auth && e.auth.id
  const r = e.record
  const old = r.original()
  const changed = ["name", "order", "photo", "pinned"].filter((f) => JSON.stringify(r.get(f)) !== JSON.stringify(old.get(f)))
  if (!lib.isAdmin(e.app, uid)) {
    // المشرف: الإعلان المثبّت وصورة الغرفة بس
    if (!lib.isMod(e.app, r.id, uid) || changed.some((f) => f !== "pinned" && f !== "photo")) lib.forbid()
  }
  const photo = r.getString("photo")
  if (photo && changed.indexOf("photo") >= 0 && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo)) lib.fail("صورة غلط")
  if (changed.indexOf("pinned") >= 0) {
    const p = lib.readJSON(r, "pinned")
    if (p) {
      if (!lib.str(p.text, 1, 300) || !lib.clean(e.app, p.text)) lib.fail("الإعلان غلط")
      const me = e.app.findRecordById("users", uid)
      r.set("pinned", { text: p.text, by: uid, byName: me.getString("name"), at: new Date().toISOString() })
    }
  }
  e.next()
}, "rooms")

onRecordDeleteRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!e.hasSuperuserAuth() && !lib.isAdmin(e.app, e.auth && e.auth.id)) lib.forbid()
  e.next()
}, "rooms")

// ===== رسايل الغرف =====
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const me = e.auth
  if (!me) throw new UnauthorizedError()
  const name = me.getString("name")
  if (!name) lib.forbid("كمّل بياناتك الأول")
  const r = e.record
  try { e.app.findRecordById("rooms", r.getString("room")) } catch (_) { lib.fail("الغرفة مش موجودة") }
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  if (lib.restricted(e.app, r.getString("room"), me.id)) lib.forbid("انت مكتوم أو مطرود من الغرفة دي")

  // الاسم والنوع من بيانات العضو نفسه (محدش يكتب باسم حد تاني)
  r.set("uid", me.id)
  r.set("name", name)
  r.set("gender", me.getString("gender"))
  r.set("reactions", {})
  r.set("edited", false)

  lib.content(e.app, r, { room: r.getString("room") })

  const rep = lib.readJSON(r, "replyTo")
  if (rep) {
    if (!lib.str(rep.name, 1, 30) || !lib.str(rep.text, 1, 200)) lib.fail("الرد غلط")
    r.set("replyTo", { name: rep.name, text: rep.text, uid: lib.str(rep.uid, 1, 64) ? rep.uid : "" })
  }
  e.next()
}, "messages")

onRecordDeleteRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const uid = e.auth && e.auth.id
  const r = e.record
  if (r.getString("uid") !== uid && !lib.isMod(e.app, r.getString("room"), uid)) lib.forbid()
  e.next()
}, "messages")

// التفاعل: كل عضو بيغيّر تفاعله هو بس
routerAdd("POST", "/api/kemet/react", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const uid = e.auth.id
  const b = e.requestInfo().body || {}
  const emoji = b.emoji || null
  if (emoji !== null && lib.REACTIONS.indexOf(emoji) < 0) lib.fail("تفاعل غلط")
  if (lib.appBanned(e.app, uid)) lib.forbid("حسابك محظور")
  e.app.runInTransaction((tx) => {
    const r = tx.findRecordById("messages", String(b.id || ""))
    const re = lib.readJSON(r, "reactions") || {}
    if (emoji) re[uid] = emoji
    else delete re[uid]
    r.set("reactions", re)
    tx.save(r)
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// تعديل رسالة: صاحبها بس، خلال ١٥ دقيقة، والكلام بس
routerAdd("POST", "/api/kemet/edit", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const b = e.requestInfo().body || {}
  const text = String(b.text || "").trim()
  if (!lib.str(text, 1, 1000) || !lib.clean(e.app, text)) lib.fail("الرسالة غلط أو فيها كلمة ممنوعة")
  const r = e.app.findRecordById("messages", String(b.id || ""))
  if (r.getString("uid") !== e.auth.id || r.getString("kind") !== "text") lib.forbid()
  if (Date.now() - new Date(r.getString("created").replace(" ", "T")).getTime() > 15 * 60 * 1000) lib.forbid("التعديل خلال ١٥ دقيقة بس")
  r.set("text", text)
  r.set("edited", true)
  e.app.save(r)
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// ===== الإعدادات (الأدوار والكلمات الممنوعة): الأدمن بس =====
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) throw new ForbiddenError()
  e.next()
}, "config")
onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  if (!lib.isAdmin(e.app, e.auth && e.auth.id)) lib.forbid()
  const d = lib.readJSON(e.record, "data") || {}
  if (e.record.id === "roles") {
    // الأدمن مايقدرش يشيل نفسه بالغلط، ولا يضيف أدمن جديد (ده من السيرفر بس)
    const old = lib.readJSON(e.record.original(), "data") || {}
    if (JSON.stringify(d.admins || []) !== JSON.stringify(old.admins || [])) lib.forbid("الأدمنز بيتغيّروا من السيرفر بس")
    if (typeof d.mods !== "object" || Array.isArray(d.mods)) lib.fail("mods غلط")
  } else if (e.record.id === "filter") {
    if (!Array.isArray(d.words) || d.words.length > 500 || typeof d.pattern !== "string" || d.pattern.length > 100000) lib.fail("filter غلط")
    try { new RegExp(d.pattern) } catch (_) { lib.fail("pattern غلط") }
  }
  e.next()
}, "config")

// ===== المتصلين: الوقت من السيرفر، والاسم من بيانات العضو =====
// جوه غرفة التطبيق بيبعت {room}، وبرّه بيبعت {} (فاتح التطبيق بس)
onRecordCreateRequest((e) => {
  if (!e.auth) throw new UnauthorizedError()
  const now = new DateTime()
  e.record.set("at", now)
  if (e.record.getString("room")) e.record.set("roomAt", now)
  e.record.set("name", e.auth.getString("name"))
  e.next()
}, "presence")
onRecordUpdateRequest((e) => {
  if (!e.auth) throw new UnauthorizedError()
  const now = new DateTime()
  const body = e.requestInfo().body || {}
  e.record.set("at", now)
  if (body.room) e.record.set("roomAt", now)
  e.record.set("name", e.auth.getString("name"))
  e.next()
}, "presence")
