/// <reference path="../pb_data/types.d.ts" />
// 🏛 الميدان: بوستات الأعضاء + لايكات + كومنتات + تحدي الأسبوع

// بوست جديد: عضو مسجّل بس، ٥ في اليوم، والكلام بيعدّي على الفلتر
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  const Q = require(`${__hooks}/squarelib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const me = e.auth
  if (!me) throw new UnauthorizedError()
  if (me.getBool("guest")) lib.forbid("سجّل حسابك الأول علشان تنزّل بوستات")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  const r = e.record
  const text = r.getString("text").trim()
  // الصورة اللي لسه بتترفع بتبقى object مش اسم ملف
  const iv = r.get("image")
  const hasImg = !!iv && (typeof iv === "object" ? !!iv.name : String(iv) !== "")
  if (!text && !hasImg) lib.fail("اكتب حاجة أو اختار صورة")
  if (text.length > 600) lib.fail("الكلام طويل أوي")
  if (text && !lib.clean(e.app, text)) lib.fail("الكلام فيه كلمة ممنوعة")
  const t = text.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/(\d)[\s\-.()]+(?=\d)/g, "$1")
  if (/(?:\+?20|0)1[0125]\d{8}/.test(t) || /\d{9,}/.test(t)) lib.fail("🛡 أرقام التليفونات ممنوعة في الميدان")
  const admin = lib.isAdmin(e.app, me.id)
  if (!admin && /(https?:\/\/|www\.|wa\.me|t\.me|bit\.ly)/i.test(text.toLowerCase().replace(/chatkemet\.pages\.dev/g, ""))) lib.fail("🛡 اللينكات ممنوعة في الميدان")
  if (!admin && e.app.countRecords("posts", $dbx.exp("uid = {:u} AND created >= {:t}", { u: me.id, t: Q.iso(Date.now() - Q.DAY) })) >= Q.POSTS_DAY) lib.fail("نزّلت " + Q.POSTS_DAY + " بوستات النهارده، كمّل بكرة 🙏")
  // التحدي: لازم صورة، ومرة واحدة في الأسبوع
  const c = Q.current()
  let tag = ""
  if (r.getString("tag")) {
    if (r.getString("tag") !== c.key) lib.fail("التحدي ده خلص")
    if (!hasImg) lib.fail("التحدي محتاج صورة 📷")
    if (e.app.countRecords("posts", $dbx.exp("uid = {:u} AND tag = {:k} AND hidden = 0", { u: me.id, k: c.key })) > 0) lib.fail("انت مشترك في تحدي الأسبوع ده قبل كده")
    tag = c.key
  }
  r.set("uid", me.id); r.set("name", me.getString("name")); r.set("text", text); r.set("tag", tag)
  r.set("likes", 0); r.set("comments", 0); r.set("hidden", false)
  const w = r.getInt("w"), h = r.getInt("h")
  if (w < 0 || w > 4000 || h < 0 || h > 4000) { r.set("w", 0); r.set("h", 0) }
  e.next()
}, "posts")

// تحدي الأسبوع + فايزين الأسبوع اللي فات
routerAdd("GET", "/api/kemet/square/challenge", (e) => {
  const Q = require(`${__hooks}/squarelib.js`)
  const c = Q.current()
  let mine = false
  try { mine = e.app.countRecords("posts", $dbx.exp("uid = {:u} AND tag = {:k} AND hidden = 0", { u: e.auth.id, k: c.key })) > 0 } catch (_) {}
  const n = e.app.countRecords("posts", $dbx.exp("tag = {:k} AND hidden = 0", { k: c.key }))
  return e.json(200, { key: c.key, title: c.title, e: c.e, tag: c.tag, end: c.end, prizes: Q.PRIZES, minLikes: Q.MIN_LIKES, n, mine, top: Q.leaders(e.app, c.key, 3), last: Q.lastWinners(e.app) })
}, $apis.requireAuth("users"))

// لايك / شيل اللايك
routerAdd("POST", "/api/kemet/square/like", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const Q = require(`${__hooks}/squarelib.js`)
  const me = e.auth
  if (me.getBool("guest")) lib.forbid("سجّل حسابك الأول علشان تعمل لايك ❤️")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  const b = e.requestInfo().body || {}
  const p = require(`${__hooks}/squarelib.js`).post(e.app, b.id)
  const lid = p.id + "_" + me.id
  let liked = false, likes = 0
  e.app.runInTransaction((tx) => {
    const post = tx.findRecordById("posts", p.id)
    let old = null
    try { old = tx.findRecordById("postlikes", lid) } catch (_) {}
    if (old) { tx.delete(old); liked = false }
    else {
      const l = new Record(tx.findCollectionByNameOrId("postlikes"))
      l.set("id", lid); l.set("post", p.id); l.set("uid", me.id)
      tx.save(l); liked = true
    }
    likes = tx.countRecords("postlikes", $dbx.exp("post = {:p}", { p: p.id }))
    post.set("likes", likes)
    tx.save(post)
  })
  const owner = p.getString("uid")
  if (liked && owner !== me.id) {
    const milestone = [1, 5, 10, 25, 50, 100, 250, 500].indexOf(likes) >= 0
    Q.notify(e.app, owner, "plike", me.id, me.getString("name"), p.id, likes > 1 ? "و" + (likes - 1) + " تانيين" : "", "plike_" + p.id,
      milestone ? { title: "❤️ " + me.getString("name"), body: likes > 1 ? "وصل بوستك لـ " + likes + " لايك 🎉" : "عمل لايك على بوستك في الميدان" } : null)
  }
  return e.json(200, { liked, likes })
}, $apis.requireAuth("users"))

// كومنت
routerAdd("POST", "/api/kemet/square/comment", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const Q = require(`${__hooks}/squarelib.js`)
  const me = e.auth
  if (me.getBool("guest")) lib.forbid("سجّل حسابك الأول علشان تكتب كومنت")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  const b = e.requestInfo().body || {}
  const text = String(b.text || "").replace(/\s+/g, " ").trim()
  if (!lib.str(text, 1, 300)) lib.fail("الكومنت فاضي أو طويل")
  if (!lib.clean(e.app, text)) lib.fail("الكومنت فيه كلمة ممنوعة")
  const t = text.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/(\d)[\s\-.()]+(?=\d)/g, "$1")
  if (/(?:\+?20|0)1[0125]\d{8}/.test(t) || /\d{9,}/.test(t)) lib.fail("🛡 أرقام التليفونات ممنوعة")
  if (/(https?:\/\/|www\.|wa\.me|t\.me|bit\.ly)/i.test(text)) lib.fail("🛡 اللينكات ممنوعة")
  const p = require(`${__hooks}/squarelib.js`).post(e.app, b.id)
  if (lib.settingsOf(e.app, p.getString("uid")).blocked[me.id]) lib.forbid("مش مسموح")
  if (e.app.countRecords("postcomments", $dbx.exp("uid = {:u} AND created >= {:t}", { u: me.id, t: Q.iso(Date.now() - 60000) })) >= 6) lib.fail("بتكتب كومنتات كتير، استنى دقيقة")
  let c = null
  e.app.runInTransaction((tx) => {
    c = new Record(tx.findCollectionByNameOrId("postcomments"))
    c.set("post", p.id); c.set("uid", me.id); c.set("name", me.getString("name")); c.set("text", text)
    tx.save(c)
    const post = tx.findRecordById("posts", p.id)
    post.set("comments", tx.countRecords("postcomments", $dbx.exp("post = {:p}", { p: p.id })))
    tx.save(post)
  })
  const owner = p.getString("uid")
  if (owner !== me.id) Q.notify(e.app, owner, "pcomment", me.id, me.getString("name"), p.id, text, "pcom_" + p.id + "_" + me.id,
    { title: "💬 " + me.getString("name"), body: "علّق على بوستك: " + (text.length > 70 ? text.slice(0, 70) + "…" : text) })
  return e.json(200, { id: c.id, post: p.id, uid: me.id, name: me.getString("name"), text, created: c.getString("created") })
}, $apis.requireAuth("users"))

// مسح بوست: صاحبه أو الأدمن
routerAdd("POST", "/api/kemet/square/delete", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const me = e.auth
  const b = e.requestInfo().body || {}
  const p = require(`${__hooks}/squarelib.js`).post(e.app, b.id)
  if (p.getString("uid") !== me.id && !lib.isAdmin(e.app, me.id)) lib.forbid()
  e.app.runInTransaction((tx) => {
    for (const c of tx.findRecordsByFilter("postcomments", "post = {:p}", "", 2000, 0, { p: p.id })) tx.delete(c)
    for (const l of tx.findRecordsByFilter("postlikes", "post = {:p}", "", 5000, 0, { p: p.id })) tx.delete(l)
    tx.delete(tx.findRecordById("posts", p.id))
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// مسح كومنت: صاحبه أو صاحب البوست أو الأدمن
routerAdd("POST", "/api/kemet/square/uncomment", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const me = e.auth
  const b = e.requestInfo().body || {}
  let c = null
  try { c = e.app.findRecordById("postcomments", String(b.id || "")) } catch (_) { lib.fail("الكومنت اتمسح") }
  let owner = ""
  try { owner = e.app.findRecordById("posts", c.getString("post")).getString("uid") } catch (_) {}
  if (c.getString("uid") !== me.id && owner !== me.id && !lib.isAdmin(e.app, me.id)) lib.forbid()
  e.app.runInTransaction((tx) => {
    tx.delete(tx.findRecordById("postcomments", c.id))
    try {
      const post = tx.findRecordById("posts", c.getString("post"))
      post.set("comments", tx.countRecords("postcomments", $dbx.exp("post = {:p}", { p: post.id })))
      tx.save(post)
    } catch (_) {}
  })
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// بلاغ عن بوست: بيروح لصفحة البلاغات عند الأدمن. ٣ بلاغات من ناس مختلفة = البوست بيستخبى لحد ما الأدمن يشوفه
routerAdd("POST", "/api/kemet/square/report", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const me = e.auth
  const b = e.requestInfo().body || {}
  const p = require(`${__hooks}/squarelib.js`).post(e.app, b.id)
  if (p.getString("uid") === me.id) lib.fail("ده بوستك 😄")
  const key = "post:" + p.id
  if (e.app.countRecords("reports", $dbx.exp("reporter = {:u} AND chatId = {:k}", { u: me.id, k: key })) > 0) return e.json(200, { ok: true })
  const r = new Record(e.app.findCollectionByNameOrId("reports"))
  r.set("reporter", me.id); r.set("reported", p.getString("uid")); r.set("reportedName", p.getString("name"))
  r.set("reason", "بوست في الميدان مش لائق"); r.set("chatId", key)
  e.app.save(r)
  if (!me.getBool("guest") && e.app.countRecords("reports", $dbx.exp("chatId = {:k}", { k: key })) >= 3) { p.set("hidden", true); e.app.save(p) }
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// بوست واحد (الأدمن يقدر يشوف المستخبي كمان علشان يراجع البلاغات)
routerAdd("GET", "/api/kemet/square/get", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const id = String(e.request.url.query().get("id") || "")
  let p = null
  try { p = e.app.findRecordById("posts", id) } catch (_) {}
  const admin = lib.isAdmin(e.app, e.auth.id)
  if (!p || (p.getBool("hidden") && !admin)) throw new NotFoundError("البوست ده اتمسح")
  let liked = false
  try { e.app.findRecordById("postlikes", p.id + "_" + e.auth.id); liked = true } catch (_) {}
  return e.json(200, { id: p.id, collectionId: p.collection().id, uid: p.getString("uid"), name: p.getString("name"), text: p.getString("text"), image: p.getString("image"),
    w: p.getInt("w"), h: p.getInt("h"), tag: p.getString("tag"), likes: p.getInt("likes"), comments: p.getInt("comments"), hidden: p.getBool("hidden"), created: p.getString("created"), liked })
}, $apis.requireAuth("users"))

// الأدمن يرجّع بوست اتخبّى بسبب البلاغات
routerAdd("POST", "/api/kemet/square/restore", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid()
  const p = e.app.findRecordById("posts", String((e.requestInfo().body || {}).id || ""))
  p.set("hidden", false); e.app.save(p)
  for (const r of e.app.findRecordsByFilter("reports", "chatId = {:k}", "", 500, 0, { k: "post:" + p.id })) e.app.delete(r)
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// كل ساعة: لو الأسبوع خلص نوزّع جوايز التحدي
cronAdd("kemetSquarePay", "17 * * * *", () => {
  try { require(`${__hooks}/squarelib.js`).payPrevious($app) } catch (err) { console.log("square pay failed: " + err) }
})
