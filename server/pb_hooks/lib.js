// أدوات مشتركة بين ملفات الـ hooks (بتتحمّل بـ require جوه كل handler)
const REACTIONS = ["❤️", "😂", "👍", "😮", "😢"]

function readJSON(rec, field) {
  try { return JSON.parse(rec.getString(field) || "null") } catch (_) { return null }
}
function roles(app) {
  try {
    const d = readJSON(app.findRecordById("config", "roles"), "data") || {}
    return { admins: d.admins || [], mods: d.mods || {} }
  } catch (_) { return { admins: [], mods: {} } }
}
function isAdmin(app, uid) { return !!uid && roles(app).admins.indexOf(uid) >= 0 }
function isMod(app, room, uid) {
  if (!uid) return false
  const r = roles(app)
  return r.admins.indexOf(uid) >= 0 || (r.mods[room] || []).indexOf(uid) >= 0
}
// فلتر الشتايم: النمط بيتعمل في التطبيق ويتحفظ في config/filter
function clean(app, text) {
  try {
    const d = readJSON(app.findRecordById("config", "filter"), "data") || {}
    if (!d.pattern) return true
    return !new RegExp(d.pattern).test(String(text).toLowerCase())
  } catch (_) { return true }
}
// محظور من التطبيق؟ مكتوم أو مطرود من الغرفة؟
function appBanned(app, uid) {
  try { app.findRecordById("bans", uid); return true } catch (_) { return false }
}
function restricted(app, room, uid) {
  try {
    const r = app.findRecordById("restrict", room + "_" + uid)
    return new Date(r.getString("until").replace(" ", "T")).getTime() > Date.now() ? r.getString("type") : null
  } catch (_) { return null }
}
function str(v, min, max) { return typeof v === "string" && v.length >= min && v.length <= max }
function fail(msg) { throw new BadRequestError(msg) }
function forbid(msg) { throw new ForbiddenError(msg || "مش مسموح") }

module.exports = { REACTIONS, readJSON, roles, isAdmin, isMod, clean, appBanned, restricted, str, fail, forbid }
