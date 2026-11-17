/// <reference path="../pb_data/types.d.ts" />
// حالة السيرفر (من غير أي بيانات خاصة): نفتحها من المتصفح علشان نتأكد إنه شغال
routerAdd("GET", "/api/kemet/status", (e) => {
  let collections = 0
  try { collections = $app.findAllCollections().filter((c) => !c.system).length } catch (_) {}
  return e.json(200, {
    ok: true,
    app: "chat-kemet",
    collections,
    time: new Date().toISOString(),
  })
})
