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
  const changed = ["name", "order", "photo", "pinned", "hidden", "owner", "ownerName", "hiddenBy", "boost"].filter((f) => JSON.stringify(r.get(f)) !== JSON.stringify(old.get(f)))
  const admin = lib.isAdmin(e.app, uid)
  const owner = !!old.getString("owner") && old.getString("owner") === uid
  if (!admin) {
    if (owner) {
      // صاحب الغرفة: الاسم والصورة والإعلان، ويقدر يقفلها (مايقدرش يفتحها تاني لو اتقفلت)
      if (changed.some((f) => ["name", "photo", "pinned", "hidden"].indexOf(f) < 0)) lib.forbid()
      if (changed.indexOf("hidden") >= 0 && !r.getBool("hidden")) lib.forbid("الغرفة اتقفلت، اعمل غرفة جديدة")
    } else if (!lib.isMod(e.app, r.id, uid) || changed.some((f) => f !== "pinned" && f !== "photo")) {
      // المشرف: الإعلان المثبّت وصورة الغرفة بس
      lib.forbid()
    }
  }
  if (changed.indexOf("owner") >= 0 || changed.indexOf("ownerName") >= 0 || changed.indexOf("boost") >= 0) lib.forbid()
  if (changed.indexOf("name") >= 0) {
    const n = r.getString("name").trim()
    if (!lib.str(n, 1, 30) || !lib.clean(e.app, n)) lib.fail("اسم الغرفة غلط أو فيه كلمة ممنوعة")
    // صاحب الغرفة (مش الأدمن): حرفين على الأقل، ومن غير الأسامي المحجوزة
    if (!admin) {
      if (n.length < 2) lib.fail("اسم الغرفة لازم من ٢ لـ ٣٠ حرف")
      const flat = n.toLowerCase().replace(/[أإآ]/g, "ا").replace(/[\sـ._-]+/g, "")
      if (["ادمن", "admin", "مشرف", "الادارة", "شاتكيمت", "kemet"].some((w) => flat.indexOf(w) >= 0)) lib.fail("الاسم ده محجوز، اختار اسم تاني")
    }
    r.set("name", n)
  }
  if (changed.indexOf("hidden") >= 0) r.set("hiddenBy", r.getBool("hidden") ? (admin ? "admin" : "owner") : "")
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

// الغرف مابتتمسحش نهائي من التطبيق: الأدمن بيخفيها (hidden) ويقدر يرجّعها. المسح النهائي من لوحة السيرفر بس
onRecordDeleteRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!e.hasSuperuserAuth()) lib.forbid("الغرفة بتتخفي بس، ومن صفحة الأدمن تقدر ترجّعها")
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
  let room
  try { room = e.app.findRecordById("rooms", r.getString("room")) } catch (_) { lib.fail("الغرفة مش موجودة") }
  if (room.getBool("hidden")) lib.fail("الغرفة دي اتقفلت")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  if (lib.restricted(e.app, r.getString("room"), me.id)) lib.forbid("انت مكتوم أو مطرود من الغرفة دي")

  // الاسم والنوع من بيانات العضو نفسه (محدش يكتب باسم حد تاني)
  r.set("uid", me.id)
  r.set("name", name)
  r.set("gender", me.getString("gender"))
  r.set("reactions", {})
  r.set("edited", false)

  lib.content(e.app, r, { room: r.getString("room") })
  lib.automod(e.app, r.getString("room"), me, r)

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
  // رجع متصل: أصحابه يعرفوا
  require(`${__hooks}/sociallib.js`).friendOnline(e.app, e.auth.id, e.auth.getString("name"))
}, "presence")
onRecordUpdateRequest((e) => {
  if (!e.auth) throw new UnauthorizedError()
  const now = new DateTime()
  const body = e.requestInfo().body || {}
  const was = new Date(e.record.original().getString("at").replace(" ", "T")).getTime() || 0
  e.record.set("at", now)
  if (body.room) e.record.set("roomAt", now)
  e.record.set("name", e.auth.getString("name"))
  e.next()
  // كان مش متصل أكتر من ربع ساعة ورجع: أصحابه يعرفوا
  if (Date.now() - was > 15 * 60000) require(`${__hooks}/sociallib.js`).friendOnline(e.app, e.auth.id, e.auth.getString("name"))
}, "presence")

// الأدمن: امسح كل رسايل الغرفة مرة واحدة (والصور والفويسات بتاعتها)
routerAdd("POST", "/api/kemet/room/clear", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  const room = String((e.requestInfo().body || {}).room || "")
  try { e.app.findRecordById("rooms", room) } catch (_) { lib.fail("الغرفة مش موجودة") }
  let n = 0
  // بنمسح واحدة واحدة علشان الموبايلات المفتوحة تشيلها على طول (وملفات الصور تتمسح من السيرفر)
  for (let round = 0; round < 40; round++) {
    const list = e.app.findRecordsByFilter("messages", "room = {:r}", "", 500, 0, { r: room })
    if (!list.length) break
    for (const m of list) { try { e.app.delete(m); n++ } catch (_) {} }
  }
  for (let round = 0; round < 20; round++) {
    const list = e.app.findRecordsByFilter("media", "room = {:r}", "", 500, 0, { r: room })
    if (!list.length) break
    for (const m of list) { try { e.app.delete(m) } catch (_) {} }
  }
  return e.json(200, { deleted: n })
}, $apis.requireAuth("users"))

// ===== ارفع رسالتك في الغرفة ١٠ دقايق (١٠٠ كوين) — رسالة واحدة مرفوعة في الغرفة في نفس الوقت =====
routerAdd("POST", "/api/kemet/boost", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  const PRICE = 100, MS = 10 * 60000
  const b = e.requestInfo().body || {}
  const me = e.auth
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  let m
  try { m = e.app.findRecordById("messages", String(b.msg || "")) } catch (_) { lib.fail("الرسالة مش موجودة") }
  if (m.getString("uid") !== me.id || m.getString("kind") !== "text") lib.forbid("ترفع رسايلك المكتوبة بس")
  const roomId = m.getString("room")
  if (lib.restricted(e.app, roomId, me.id)) lib.forbid()
  let out = {}
  e.app.runInTransaction((tx) => {
    const room = tx.findRecordById("rooms", roomId)
    if (room.getBool("hidden")) lib.fail("الغرفة مقفولة")
    const cur = lib.readJSON(room, "boost")
    if (cur && cur.until > Date.now()) lib.fail("فيه رسالة مرفوعة دلوقتي، استنى " + Math.ceil((cur.until - Date.now()) / 60000) + " دقيقة")
    g.addCoins(tx, me.id, -PRICE, "boost", "📣 رفعت رسالتك في " + room.getString("name"))
    const boost = { msg: m.id, uid: me.id, name: me.getString("name"), text: m.getString("text").slice(0, 300), until: Date.now() + MS }
    room.set("boost", boost)
    tx.save(room)
    out = boost
  })
  return e.json(200, out)
}, $apis.requireAuth("users"))
