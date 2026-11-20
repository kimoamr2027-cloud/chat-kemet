/// <reference path="../pb_data/types.d.ts" />
// سجل الأخطاء: العضو بيبعت مكان الغلط ونوعه، والسيرفر بيحط اسمه ويحدد العدد (٤٠ في اليوم لكل عضو)
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  if (!e.auth) throw new UnauthorizedError()
  const r = e.record
  const since = new Date(Date.now() - 86400000).toISOString().replace("T", " ")
  const n = e.app.findRecordsByFilter("diag", "uid = {:u} && created > {:s}", "", 41, 0, { u: e.auth.id, s: since }).length
  if (n >= 40) throw new BadRequestError("كفاية")
  r.set("uid", e.auth.id)
  r.set("name", e.auth.getString("name").slice(0, 30))
  for (const [f, max] of [["where", 60], ["msg", 300], ["info", 300], ["ua", 200], ["ver", 40]]) r.set(f, r.getString(f).slice(0, max))
  e.next()
}, "diag")

// الأدمن: آخر الأخطاء
routerAdd("GET", "/api/kemet/diag", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  const list = e.app.findRecordsByFilter("diag", "id != ''", "-created", 100, 0).map((r) => ({
    id: r.id, uid: r.getString("uid"), name: r.getString("name"), where: r.getString("where"), msg: r.getString("msg"),
    info: r.getString("info"), ua: r.getString("ua"), ver: r.getString("ver"), created: r.getString("created"),
  }))
  return e.json(200, { list })
}, $apis.requireAuth("users"))

// الأدمن: مسح السجل
routerAdd("DELETE", "/api/kemet/diag", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  e.app.db().newQuery("DELETE FROM diag").execute()
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// كل يوم: الأخطاء الأقدم من ١٤ يوم بتتمسح
cronAdd("kemetDiagClean", "41 3 * * *", () => {
  const old = new Date(Date.now() - 14 * 86400000).toISOString().replace("T", " ")
  $app.db().newQuery("DELETE FROM diag WHERE created < {:o}").bind({ o: old }).execute()
})
