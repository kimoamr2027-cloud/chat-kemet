// النسخة الاحتياطية المقفولة: GitHub بيسحبها كل يوم ويحفظها برّه السيرفر.
// الملف متشفّر بالمفتاح العام (server/backup/pub.pem)، ومحدش يقدر يفتحه غير اللي معاه المفتاح الخاص (الأدمن).
routerAdd("GET", "/api/kemet/backup/status", (e) => {
  const path = $os.getenv("KEMET_OFFSITE") || "/opt/kemet/offsite/kemet-backup.enc"
  let info = ""
  try { info = toString($os.readFile(path + ".txt")).trim() } catch (_) {}
  if (!info) return e.json(200, { ok: false })
  const [at, size] = info.split(" ")
  return e.json(200, { ok: true, at, size: parseInt(size, 10) || 0 })
})

routerAdd("GET", "/api/kemet/backup/file", (e) => {
  const path = $os.getenv("KEMET_OFFSITE") || "/opt/kemet/offsite/kemet-backup.enc"
  let data
  try { data = $os.readFile(path) } catch (_) { return e.json(404, { message: "لسه مفيش نسخة" }) }
  e.response.header().set("Content-Disposition", "attachment; filename=kemet-backup.enc")
  return e.blob(200, "application/octet-stream", data)
})
