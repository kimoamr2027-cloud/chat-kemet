/// <reference path="../pb_data/types.d.ts" />
// المرحلة ٥: استيراد بيانات Firebase
// unpack.sh بيفك الملف المقفول في /opt/kemet/migrate/ready، والـ cron ده بيستورده مرة واحدة

// المفتاح العام بس (بيقفل، مابيفتحش) — علشان نقفل البيانات قبل ما ترفع
routerAdd("GET", "/api/kemet/migrate/pubkey", (e) => {
  const dir = $os.getenv("KEMET_MIGRATE_DIR") || "/opt/kemet/migrate"
  try { return e.string(200, toString($os.readFile(dir + "/pub.pem"))) } catch (_) { return e.string(404, "no key yet") }
})

// حالة النقل (أرقام بس، من غير أي بيانات)
routerAdd("GET", "/api/kemet/migrate/status", (e) => {
  const dir = $os.getenv("KEMET_MIGRATE_DIR") || "/opt/kemet/migrate"
  let st = { state: "waiting" }
  try { st = JSON.parse(toString($os.readFile(dir + "/status.json"))) } catch (_) {}
  return e.json(200, st)
})

// كل دقيقة: لو فيه بيانات متفكوكة ومستنية، نستوردها مرة واحدة
cronAdd("kemetImport", "* * * * *", () => {
  const dir = $os.getenv("KEMET_MIGRATE_DIR") || "/opt/kemet/migrate"
  const ready = dir + "/ready"
  try { $os.stat(ready + "/data.json") } catch (_) { return }
  const done = dir + "/done-" + Date.now()
  let st
  try {
    $os.rename(ready, dir + "/importing")
    st = { state: "imported", at: new Date().toISOString(), counts: require(`${__hooks}/importer.js`).run($app, dir + "/importing") }
  } catch (err) {
    st = { state: "failed", at: new Date().toISOString(), error: String(err).slice(0, 500) }
  }
  try { $os.rename(dir + "/importing", done) } catch (_) {}
  $os.writeFile(dir + "/status.json", JSON.stringify(st), 0o644)
})
