/// <reference path="../pb_data/types.d.ts" />
// المرحلة ٣: رفع الصور والفويس، وصوري في البروفايل

// رفع ملف لغرفة {room} أو لخاص {chat}
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const me = e.auth
  if (!me) throw new UnauthorizedError()
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  const r = e.record
  r.set("owner", me.id)
  const room = r.getString("room")
  const chat = r.getString("chat")
  if (room) {
    try { e.app.findRecordById("rooms", room) } catch (_) { lib.fail("الغرفة مش موجودة") }
    if (lib.restricted(e.app, room, me.id)) lib.forbid("انت مكتوم أو مطرود من الغرفة دي")
    r.set("chat", ""); r.set("a", ""); r.set("b", "")
  } else if (chat) {
    lib.chatOther(chat, me.id)
    const p = chat.split("_")
    r.set("a", p[0]); r.set("b", p[1])
  } else lib.fail("لازم غرفة أو محادثة")
  e.next()
}, "media")

// رسالة اتمسحت: نمسح الملف بتاعها كمان
onRecordAfterDeleteSuccess((e) => {
  const id = e.record.getString("media")
  if (id) { try { e.app.delete(e.app.findRecordById("media", id)) } catch (_) {} }
  e.next()
}, "messages", "dms")

// صوري: id = uid_slot، والصورة jpeg صغيرة (نفس الفحص للإضافة والتغيير)
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const r = e.record
  const slot = r.getInt("slot")
  if (r.getString("owner") !== e.auth.id || slot < 0 || slot > 5 || r.id !== e.auth.id + "_" + slot) lib.forbid()
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.getString("data"))) lib.fail("صورة غلط")
  e.next()
}, "photos")
onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const r = e.record
  const old = r.original()
  if (r.getString("owner") !== old.getString("owner") || r.getInt("slot") !== old.getInt("slot")) lib.forbid()
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.getString("data"))) lib.fail("صورة غلط")
  e.next()
}, "photos")
