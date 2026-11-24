/// <reference path="../pb_data/types.d.ts" />
// غرف الأعضاء: أي عضو مسجّل يعمل غرفة واحدة باسمه وهو مشرفها
// - غرفة واحدة مفتوحة لكل عضو
// - لو الأدمن قفل غرفته، مايقدرش يعمل غيرها قبل ٣٠ يوم
// - الغرفة اللي محدش كتب فيها أسبوع بتتقفل لوحدها
routerAdd("POST", "/api/kemet/myroom", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const me = e.app.findRecordById("users", e.auth.id)
  if (me.getBool("guest")) lib.forbid("سجّل حسابك الأول علشان تعمل غرفة")
  if (!me.getString("name")) lib.forbid("كمّل بياناتك الأول")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  const name = String((e.requestInfo().body || {}).name || "").trim()
  if (!lib.str(name, 2, 30)) lib.fail("اسم الغرفة لازم من ٢ لـ ٣٠ حرف")
  if (!lib.clean(e.app, name)) lib.fail("اسم الغرفة فيه كلمة ممنوعة")
  const flat = name.toLowerCase().replace(/[أإآ]/g, "ا").replace(/[\sـ._-]+/g, "")
  if (["ادمن", "admin", "مشرف", "الادارة", "شاتكيمت", "kemet"].some((w) => flat.indexOf(w) >= 0)) lib.fail("الاسم ده محجوز، اختار اسم تاني")
  if (e.app.countRecords("rooms", $dbx.exp("owner = {:u} AND hidden = FALSE", { u: me.id })) > 0) lib.fail("عندك غرفة مفتوحة بالفعل (غرفة واحدة بس لكل عضو)")
  const month = new Date(Date.now() - 30 * 86400000).toISOString().replace("T", " ")
  if (e.app.countRecords("rooms", $dbx.exp("owner = {:u} AND hiddenBy = 'admin' AND updated >= {:m}", { u: me.id, m: month })) > 0) lib.forbid("الأدمن قفل غرفتك، تقدر تعمل غرفة جديدة بعد ٣٠ يوم")
  const r = new Record(e.app.findCollectionByNameOrId("rooms"))
  r.set("name", name)
  r.set("order", 1000)
  r.set("owner", me.id)
  r.set("ownerName", me.getString("name"))
  r.set("hidden", false)
  e.app.save(r)
  return e.json(200, { id: r.id })
}, $apis.requireAuth("users"))

// كل يوم الساعة ٤:٢٧ الصبح (مصر): غرف الأعضاء اللي محدش كتب فيها أسبوع بتتقفل
cronAdd("kemetIdleRooms", "27 2 * * *", () => {
  try {
    const week = new Date(Date.now() - 7 * 86400000).toISOString().replace("T", " ")
    const list = $app.findRecordsByFilter("rooms", "owner != '' && hidden = false && created < {:w}", "", 500, 0, { w: week })
    let n = 0
    for (const r of list) {
      if ($app.countRecords("messages", $dbx.exp("room = {:r} AND created >= {:w}", { r: r.id, w: week })) > 0) continue
      r.set("hidden", true); r.set("hiddenBy", "idle")
      $app.save(r)
      n++
      try { require(`${__hooks}/pushlib.js`).send($app, r.getString("owner"), { title: "🏠 غرفتك اتقفلت", body: "«" + r.getString("name") + "» فضيت أسبوع فاتقفلت — تقدر تعمل غرفة جديدة وتدعي صحابك", url: "#/rooms", tag: "myroom" }) } catch (_) {}
    }
    if (n) console.log("idle member rooms closed: " + n)
  } catch (err) { console.log("idle rooms failed: " + err) }
})
