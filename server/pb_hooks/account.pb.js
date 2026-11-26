/// <reference path="../pb_data/types.d.ts" />
// 🗑 «امسح حسابي»: العضو بيمسح حسابه وكل بياناته بنفسه (جوجل بلاي بيطلبها)
// بيتمسح: البروفايل والصور والرسايل (الغرف والخاص) والبوستات والكومنتات واللايكات والأصحاب والمحفظة والإشعارات والحفلة...
// بيفضل (من غير اسمه): الهدايا اللي اتبعتت (علشان رصيد التانيين ولوحة الشرف)، والبلاغات والحظر (علشان أمان الشات)
routerAdd("POST", "/api/kemet/account/delete", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const me = e.auth
  const uid = me.id
  if ((e.requestInfo().body || {}).confirm !== "امسح") lib.fail("اكتب «امسح» علشان تأكد")
  if (lib.isAdmin(e.app, uid)) lib.forbid("حساب الأدمن مايتمسحش من هنا")
  const GONE = "عضو محذوف"
  const db = (sql) => e.app.db().newQuery(sql).bind({ u: uid, n: GONE }).execute()
  // الحاجات اللي فيها ملفات: بنمسحها واحدة واحدة علشان الملف يتمسح من السيرفر كمان
  const each = (col, filter) => {
    for (let i = 0; i < 50; i++) {
      const list = e.app.findRecordsByFilter(col, filter, "", 200, 0, { u: uid })
      if (!list.length) break
      for (const r of list) { try { e.app.delete(r) } catch (_) {} }
    }
  }
  try {
    // الحفلة بتاعته + اللايف الشغال
    try { const vl = require(`${__hooks}/voicelib.js`); for (const v of e.app.findRecordsByFilter("voice", "owner = {:u}", "", 5, 0, { u: uid })) { try { vl.call("DeleteRoom", { room: v.id }) } catch (_) {} } } catch (_) {}
    db("UPDATE lives SET status = 'ended', endedBy = 'deleted', hostName = {:n} WHERE host = {:u}")
    // البوستات (بصورها) واللي عليها
    const posts = e.app.findRecordsByFilter("posts", "uid = {:u}", "", 2000, 0, { u: uid }).map((p) => p.id)
    for (const p of posts) { db("DELETE FROM postlikes WHERE post = '" + p.replace(/[^a-z0-9]/g, "") + "'"); db("DELETE FROM postcomments WHERE post = '" + p.replace(/[^a-z0-9]/g, "") + "'") }
    each("posts", "uid = {:u}")
    // لايكاته وكومنتاته على بوستات التانيين (والعدّاد بيتظبط)
    const touched = arrayOf(new DynamicModel({ post: "" }))
    e.app.db().newQuery("SELECT DISTINCT post FROM postlikes WHERE uid = {:u} UNION SELECT DISTINCT post FROM postcomments WHERE uid = {:u}").bind({ u: uid }).all(touched)
    db("DELETE FROM postlikes WHERE uid = {:u}")
    db("DELETE FROM postcomments WHERE uid = {:u}")
    for (const t of touched) {
      e.app.db().newQuery("UPDATE posts SET likes = (SELECT COUNT(*) FROM postlikes WHERE post = {:p}), comments = (SELECT COUNT(*) FROM postcomments WHERE post = {:p}) WHERE id = {:p}").bind({ p: t.post }).execute()
    }
    // الصور والفويس (ملفات) + رسايله في الغرف + محادثاته الخاصة كلها
    each("media", "owner = {:u}")
    db("DELETE FROM messages WHERE uid = {:u}")
    each("media", "a = {:u} || b = {:u}")
    db("DELETE FROM dms WHERE a = {:u} OR b = {:u}")
    db("DELETE FROM chats WHERE a = {:u} OR b = {:u}")
    // الباقي
    for (const sql of [
      "DELETE FROM voice WHERE owner = {:u}",
      "UPDATE rooms SET hidden = 1, hiddenBy = 'deleted', ownerName = {:n} WHERE owner = {:u}",
      "DELETE FROM notifications WHERE owner = {:u} OR [[from]] = {:u}",
      "DELETE FROM photos WHERE owner = {:u}",
      "DELETE FROM pushsubs WHERE owner = {:u}",
      "DELETE FROM coinlog WHERE owner = {:u}",
      "DELETE FROM topups WHERE owner = {:u}",
      "DELETE FROM visits WHERE owner = {:u} OR visitor = {:u}",
      "DELETE FROM friends WHERE a = {:u} OR b = {:u}",
      "DELETE FROM joins WHERE uid = {:u}",
      "DELETE FROM tablechat WHERE uid = {:u}",
      "DELETE FROM scores WHERE uid = {:u}",
      "DELETE FROM hands WHERE owner = {:u}",
      "DELETE FROM restrict WHERE uid = {:u}",
      "DELETE FROM diag WHERE uid = {:u}",
      "DELETE FROM presence WHERE id = {:u}",
      "DELETE FROM settings WHERE id = {:u}",
      "DELETE FROM wallets WHERE id = {:u}",
      "DELETE FROM vips WHERE id = {:u}",
      "DELETE FROM perks WHERE id = {:u}",
      "UPDATE perks SET partner = '', partnerName = '' WHERE partner = {:u}",
      "DELETE FROM pkstats WHERE id = {:u}",
      "UPDATE gifts SET fromName = {:n} WHERE [[from]] = {:u}",
      "UPDATE gifts SET toName = {:n} WHERE [[to]] = {:u}",
      "UPDATE users SET invitedBy = '' WHERE invitedBy = {:u}",
    ]) { try { db(sql) } catch (err) { console.log("account delete step: " + err) } }
    e.app.delete(e.app.findRecordById("users", uid))
  } catch (err) {
    console.log("account delete failed " + uid + ": " + err)
    lib.fail("حصلت مشكلة وإحنا بنمسح الحساب، جرب تاني")
  }
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))
