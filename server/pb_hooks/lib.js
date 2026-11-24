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
  if (r.admins.indexOf(uid) >= 0 || (r.mods[room] || []).indexOf(uid) >= 0) return true
  // صاحب غرفة الأعضاء مشرفها
  try { return !!room && app.findRecordById("rooms", room).getString("owner") === uid } catch (_) { return false }
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


// محتوى الرسالة (غرف وخاص): كلام، ستيكر، صورة، فويس، دعوة لعبة
// scope = { room } أو { chat }: الصورة/الفويس لازم يكونوا مرفوعين من نفس العضو لنفس المكان
function content(app, r, scope) {
  const kind = r.getString("kind")
  const text = r.getString("text")
  const mediaOk = (type) => {
    let m
    try { m = app.findRecordById("media", r.getString("media")) } catch (_) { fail("الملف مش موجود") }
    if (m.getString("type") !== type || m.getString("owner") !== r.getString("uid")) forbid("الملف مش بتاعك")
    if (scope.room ? m.getString("room") !== scope.room : m.getString("chat") !== scope.chat) forbid("الملف من مكان تاني")
  }
  if (kind === "text") {
    if (!str(text.trim(), 1, 1000)) fail("الرسالة فاضية أو طويلة")
    if (!clean(app, text)) fail("الرسالة فيها كلمة ممنوعة")
    for (const f of ["media", "thumb", "table"]) r.set(f, "")
  } else if (kind === "sticker") {
    const s = r.getInt("sticker")
    if (s < 0 || s > 5) fail("ستيكر غلط")
    for (const f of ["text", "media", "thumb", "table"]) r.set(f, "")
  } else if (kind === "image") {
    const w = r.getInt("w"), h = r.getInt("h")
    if (w < 1 || h < 1 || w > 4000 || h > 4000) fail("مقاس الصورة غلط")
    const th = r.getString("thumb")
    if (th && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(th)) fail("الصورة الصغيرة غلط")
    mediaOk("image")
    for (const f of ["text", "table"]) r.set(f, "")
  } else if (kind === "voice") {
    const d = r.getInt("dur")
    if (d < 1 || d > 60) fail("مدة الفويس غلط")
    mediaOk("voice")
    for (const f of ["text", "thumb", "table"]) r.set(f, "")
  } else if (kind === "ludo" || kind === "snakes" || kind === "domino") {
    if (!str(text, 1, 200) || !/^[A-Za-z0-9_-]{1,40}$/.test(r.getString("table"))) fail("دعوة اللعبة غلط")
    for (const f of ["media", "thumb"]) r.set(f, "")
  } else {
    fail("نوع غلط")
  }
}
// المعاينة في قايمة الرسايل
function preview(r) {
  const k = r.getString("kind")
  if (k === "sticker") return "ستيكر"
  if (k === "image") return "📷 صورة"
  if (k === "voice") return "🎤 رسالة صوتية"
  return r.getString("text").slice(0, 100)
}

// إعدادات الخصوصية لأي عضو (لو مش موجودة: الافتراضي)
function settingsOf(app, uid) {
  try {
    const s = app.findRecordById("settings", uid)
    return { blocked: readJSON(s, "blocked") || {}, dmWho: s.getString("dmWho") || "rooms", notif: readJSON(s, "notif") || {} }
  } catch (_) { return { blocked: {}, dmWho: "rooms", notif: {} } }
}
function arr(rec, f) { const v = readJSON(rec, f); return Array.isArray(v) ? v : [] }
// أقدر أبعت خاص للعضو ده؟ (مش حاظرني + "مين يقدر يبعتلك" يسمح، أو هو بعتلي قبل كده)
function canMessage(app, me, other, chat) {
  const st = settingsOf(app, other)
  if (st.blocked[me]) return false
  if (chat && (readJSON(chat, "active") || {})[other]) return true
  if (st.dmWho === "all") return true
  if (st.dmWho === "none") return false
  // الزائر: يقدر يبعت «طلب رسايل» لأي حد (والتاني يوافق أو يرفض) — إلا لو قافل الخاص على المسجّلين بس
  let guest = false
  try { guest = app.findRecordById("users", me).getBool("guest") } catch (_) {}
  if (guest) return st.dmWho !== "members"
  if (st.dmWho === "members") return true
  try {
    const mine = arr(app.findRecordById("users", me), "rooms")
    return arr(app.findRecordById("users", other), "rooms").some((x) => mine.indexOf(x) >= 0)
  } catch (_) { return false }
}
// المحادثة بتاعتي؟ رجّع العضو التاني
function chatOther(chatId, me) {
  const p = String(chatId || "").split("_")
  if (p.length !== 2 || !(p[0] < p[1]) || p.indexOf(me) < 0) forbid()
  return p[0] === me ? p[1] : p[0]
}

// إعدادات الخصوصية: صاحبها بس، وبشكل مظبوط
function checkSettings(e) {
  if (e.hasSuperuserAuth()) return e.next()
  if (!e.auth || e.record.id !== e.auth.id) forbid()
  const bl = readJSON(e.record, "blocked")
  if (bl !== null && (typeof bl !== "object" || Array.isArray(bl) || Object.keys(bl).length > 1000)) fail("قايمة الحظر غلط")
  const n = readJSON(e.record, "notif")
  if (n !== null) {
    if (typeof n !== "object" || Object.keys(n).some((k) => k !== "dms" && k !== "mentions" || typeof n[k] !== "boolean")) fail("إعدادات الإشعارات غلط")
  }
  e.next()
}

// الأدمن: اسمه في الشات «الأدمن» ومن غير نوع ولا سن (وبيتغيّر في الرسايل القديمة كمان)
const ADMIN_NAME = "الأدمن"
function adminize(app, uid) {
  try {
    const u = app.findRecordById("users", uid)
    if (u.getString("name") !== ADMIN_NAME || u.getString("gender") || u.getInt("age")) {
      u.set("name", ADMIN_NAME); u.set("gender", ""); u.set("age", 0)
      app.saveNoValidate(u)
    }
    const db = app.db()
    db.newQuery("UPDATE messages SET name = {:n}, gender = '' WHERE uid = {:u}").bind({ n: ADMIN_NAME, u: uid }).execute()
    db.newQuery("UPDATE presence SET name = {:n} WHERE id = {:u}").bind({ n: ADMIN_NAME, u: uid }).execute()
    db.newQuery("UPDATE notifications SET fromName = {:n} WHERE [[from]] = {:u}").bind({ n: ADMIN_NAME, u: uid }).execute()
    db.newQuery("UPDATE gifts SET fromName = {:n} WHERE [[from]] = {:u}").bind({ n: ADMIN_NAME, u: uid }).execute()
    db.newQuery("UPDATE gifts SET toName = {:n} WHERE [[to]] = {:u}").bind({ n: ADMIN_NAME, u: uid }).execute()
  } catch (err) { console.log("adminize " + uid + " failed: " + err) }
}

// ===== المشرف الأوتوماتيك (رسايل الغرف) =====
// - لينكات وأرقام تليفونات: ممنوعة في الغرف (للأعضاء، مش للمشرفين)
// - تكرار نفس الرسالة: أول مرة تحذير، وتالت مرة في دقيقتين = كتم ١٠ دقايق
// - رسايل كتير ورا بعض (٦ في ١٠ ثواني): كتم ١٠ دقايق
const AUTOMUTE_MIN = 10
function autoMute(app, room, me, why) {
  const id = room + "_" + me.id
  try { app.delete(app.findRecordById("restrict", id)) } catch (_) {}
  const r = new Record(app.findCollectionByNameOrId("restrict"))
  r.set("id", id); r.set("room", room); r.set("uid", me.id); r.set("type", "mute")
  r.set("until", new Date(Date.now() + AUTOMUTE_MIN * 60000).toISOString().replace("T", " "))
  r.set("name", me.getString("name").slice(0, 30)); r.set("by", "automod"); r.set("byName", "🛡 المشرف الأوتوماتيك")
  app.save(r)
  forbid("🛡 اتكتمت " + AUTOMUTE_MIN + " دقايق: " + why)
}
function automod(app, room, me, rec) {
  if (isMod(app, room, me.id)) return
  const since = (ms) => new Date(Date.now() - ms).toISOString().replace("T", " ")
  if (app.countRecords("messages", $dbx.exp("room = {:r} AND uid = {:u} AND created >= {:t}", { r: room, u: me.id, t: since(10000) })) >= 5) autoMute(app, room, me, "بتبعت رسايل كتير ورا بعض")
  if (rec.getString("kind") !== "text") return
  const text = rec.getString("text")
  const t = text.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/(\d)[\s\-.()]+(?=\d)/g, "$1")
  if (/(?:\+?20|0)1[0125]\d{8}/.test(t) || /\d{9,}/.test(t)) fail("🛡 أرقام التليفونات ممنوعة في الغرف — اتكلموا خاص")
  const noOwn = text.toLowerCase().replace(/chatkemet\.pages\.dev/g, "")
  if (/(https?:\/\/|www\.|wa\.me|t\.me|bit\.ly|\b[a-z0-9-]+\.(com|net|org|me|io|ly|app|link|xyz|site|online|info|eg|tv|gg)\b)/i.test(noOwn)) fail("🛡 اللينكات ممنوعة في الغرف")
  const norm = text.replace(/\s+/g, " ").trim()
  const recent = app.findRecordsByFilter("messages", "room = {:r} && uid = {:u} && created >= {:t} && kind = 'text'", "-created", 5, 0, { r: room, u: me.id, t: since(120000) })
  const same = recent.filter((m) => m.getString("text").replace(/\s+/g, " ").trim() === norm).length
  if (same >= 2) autoMute(app, room, me, "بتكرر نفس الرسالة")
  if (same === 1) fail("🛡 بلاش تكرار نفس الرسالة")
}

module.exports = { automod, ADMIN_NAME, adminize, checkSettings, REACTIONS, readJSON, roles, isAdmin, isMod, clean, appBanned, restricted, str, fail, forbid, content, preview, settingsOf, canMessage, chatOther }
