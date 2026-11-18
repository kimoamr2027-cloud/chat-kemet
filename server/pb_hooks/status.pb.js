/// <reference path="../pb_data/types.d.ts" />
// حالة السيرفر (من غير أي بيانات خاصة): نفتحها من المتصفح علشان نتأكد إنه شغال
routerAdd("GET", "/api/kemet/status", (e) => {
  let collections = 0
  try { collections = $app.findAllCollections().filter((c) => !c.system).length } catch (_) {}
  // الصوت المباشر: جاهز لو مفتاح LiveKit موجود والسيرفر شغال من ورا Caddy
  let voice = "off"
  try {
    const vl = require(`${__hooks}/voicelib.js`)
    if (vl.secret() && vl.publicUrl()) voice = vl.participants("kings") === null ? "no-livekit" : "on"
  } catch (_) {}
  return e.json(200, {
    ok: true,
    voice,
    app: "chat-kemet",
    collections,
    time: new Date().toISOString(),
  })
})
