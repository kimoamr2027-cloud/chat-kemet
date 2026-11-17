/// <reference path="../pb_data/types.d.ts" />
// الدخول للغرف، الكتم والطرد، والحظر من التطبيق

// "فلان دخل الغرفة": العضو بيكتب سجله هو بس، والاسم والوقت من السيرفر
onRecordCreateRequest((e) => {
  const me = e.auth
  if (!me) throw new UnauthorizedError()
  const r = e.record
  const room = r.getString("room")
  if (r.id !== room + "_" + me.id) throw new ForbiddenError()
  try { e.app.findRecordById("rooms", room) } catch (_) { throw new BadRequestError("room") }
  r.set("uid", me.id)
  r.set("name", me.getString("name"))
  r.set("at", new DateTime())
  e.next()
}, "joins")
onRecordUpdateRequest((e) => {
  const me = e.auth
  if (!me || e.record.getString("uid") !== me.id) throw new ForbiddenError()
  e.record.set("room", e.record.original().getString("room"))
  e.record.set("name", me.getString("name"))
  e.record.set("at", new DateTime())
  e.next()
}, "joins")

// الكتم والطرد: المشرف أو الأدمن، ومايقدرش يكتم أدمن أو مشرف زيه
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const me = e.auth && e.auth.id
  const r = e.record
  const room = r.getString("room")
  const target = r.getString("uid")
  if (r.id !== room + "_" + target) lib.fail("id")
  if (!lib.isMod(e.app, room, me) || me === target || lib.isAdmin(e.app, target)) lib.forbid()
  if (!lib.isAdmin(e.app, me) && lib.isMod(e.app, room, target)) lib.forbid()
  const until = new Date(r.getString("until").replace(" ", "T")).getTime()
  if (!(until > Date.now()) || until - Date.now() > 8 * 24 * 3600 * 1000) lib.fail("المدة غلط")
  r.set("by", me)
  r.set("byName", e.auth.getString("name"))
  e.next()
}, "restrict")
onRecordUpdateRequest((e) => {
  throw new ForbiddenError("امسح وكرّر")
}, "restrict")
onRecordDeleteRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const me = e.auth && e.auth.id
  const target = e.record.getString("uid")
  if (!lib.isMod(e.app, e.record.getString("room"), me)) lib.forbid()
  if (!lib.isAdmin(e.app, me) && lib.isMod(e.app, e.record.getString("room"), target)) lib.forbid()
  e.next()
}, "restrict")

// الحظر من التطبيق: الأدمن بس، ومايقدرش يحظر أدمن
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const me = e.auth && e.auth.id
  if (!lib.isAdmin(e.app, me) || lib.isAdmin(e.app, e.record.id)) lib.forbid()
  e.record.set("by", me)
  e.next()
}, "bans")
onRecordDeleteRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!e.hasSuperuserAuth() && !lib.isAdmin(e.app, e.auth && e.auth.id)) lib.forbid()
  e.next()
}, "bans")
