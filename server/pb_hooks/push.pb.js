/// <reference path="../pb_data/types.d.ts" />
// إشعارات الموبايل: المفتاح العام للاشتراك، واشتراك الجهاز بيتنقل لصاحبه الجديد لو اتغيّر
routerAdd("GET", "/api/kemet/push/key", (e) => {
  const k = require(`${__hooks}/pushlib.js`).publicKey()
  return k ? e.json(200, { key: k }) : e.json(404, { key: "" })
})

onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const r = e.record
  const ep = r.getString("endpoint")
  if (!/^https:\/\/[^\s]+$/.test(ep) && !/^http:\/\/127\.0\.0\.1:\d+\//.test(ep)) lib.fail("اشتراك غلط") // ١٢٧ للاختبارات بس
  const k = lib.readJSON(r, "keys") || {}
  if (!lib.str(k.p256dh, 10, 200) || !lib.str(k.auth, 4, 100)) lib.fail("اشتراك غلط")
  r.set("keys", { p256dh: k.p256dh, auth: k.auth })
  // نفس الموبايل كان مسجّل لعضو تاني (خرج ودخل بحساب تاني): الاشتراك القديم يتمسح
  try { e.app.delete(e.app.findFirstRecordByData("pushsubs", "endpoint", ep)) } catch (_) {}
  e.next()
}, "pushsubs")
