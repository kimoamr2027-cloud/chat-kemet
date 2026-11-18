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

// أمر فتح بورتات الصوت في Oracle — رابط قصير علشان يتكتب بالإيد في Cloud Shell من الموبايل:
//   curl -sL 158-101-231-239.sslip.io/v | bash
routerAdd("GET", "/v", (e) => {
  const repo = $os.getenv("KEMET_REPO") || "/opt/kemet/repo"
  try { return e.string(200, toString($os.readFile(repo + "/server/oci-voice-ports.sh"))) } catch (_) { return e.string(404, "echo not found") }
})
