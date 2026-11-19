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
  // حمل السيرفر (علشان نعرف لو التقل من السيرفر): المعالج والذاكرة والبرامج الشغالة
  let load = "", mem = "", cpus = "", top = "", disk = ""
  try { load = toString($os.readFile("/proc/loadavg")).trim() } catch (_) {}
  try {
    const m = toString($os.readFile("/proc/meminfo"))
    const kb = (k) => { const x = new RegExp(k + ":\\s+(\\d+)").exec(m); return x ? Math.round(parseInt(x[1], 10) / 1024) : 0 }
    mem = "total " + kb("MemTotal") + "MB, available " + kb("MemAvailable") + "MB, swap free " + kb("SwapFree") + "/" + kb("SwapTotal") + "MB"
  } catch (_) {}
  try { cpus = toString($os.cmd("nproc").output()).trim() } catch (_) {}
  try { top = toString($os.cmd("sh", "-c", "ps -eo comm,%cpu,%mem,rss --sort=-%cpu | head -6").output()).trim() } catch (_) {}
  try { disk = toString($os.cmd("sh", "-c", "df -h / | tail -1").output()).trim() } catch (_) {}
  return e.json(200, {
    ok: true,
    voice,
    server: { cpus, load, mem, disk, top },
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
