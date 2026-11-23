/// <reference path="../pb_data/types.d.ts" />
// رجوع الغرف اللي اتمسحت (مرة واحدة بس):
// بندوّر في النسخ الاحتياطية اللي على السيرفر (/opt/kemet/backups — آخر ١٤ يوم)، من الأحدث للأقدم،
// وأي غرفة كانت موجودة ومش موجودة دلوقتي بترجع بنفس رقمها واسمها وصورتها وترتيبها والرسالة المتثبّتة.
// الرسايل والصور والفويس بتاعة الغرفة لسه موجودين (مربوطين برقم الغرفة)، فبيرجعوا معاها.
// أي غلط هنا مابيوقفش السيرفر: بيتكتب في اللوج بس.
migrate((app) => {
  const tmp = "/tmp/kemet-rooms-restore.db"
  try {
    const dir = $os.getenv("KEMET_BACKUPS") || "/opt/kemet/backups"
    if (!/^[\w\/.-]+$/.test(dir)) return
    let list = ""
    try { list = toString($os.cmd("sh", "-c", "ls -1 " + dir + "/data-*.db.gz 2>/dev/null | sort -r").output()).trim() } catch (_) {}
    if (!list) { console.log("restore rooms: no backups in " + dir); return }
    const col = app.findCollectionByNameOrId("rooms")
    const seen = {}
    let restored = 0
    for (const f of list.split("\n")) {
      if (!/^[\w\/.-]+\.db\.gz$/.test(f)) continue
      let rows = []
      try {
        $os.cmd("sh", "-c", "gunzip -c '" + f + "' > " + tmp).run()
        const js = toString($os.cmd("sqlite3", "-json", tmp, "SELECT id, name, \"order\" AS ord, photo, pinned FROM rooms").output()).trim()
        rows = js ? JSON.parse(js) : []
      } catch (err) { console.log("restore rooms: can't read " + f + ": " + err); continue }
      for (const x of rows) {
        if (!x || !x.id || seen[x.id]) continue
        seen[x.id] = true // أحدث نسخة من الغرفة هي اللي بترجع
        try { app.findRecordById("rooms", x.id); continue } catch (_) {}
        try {
          const r = new Record(col)
          r.set("id", x.id)
          r.set("name", x.name || x.id)
          r.set("order", parseInt(x.ord, 10) || 0)
          if (x.photo) r.set("photo", x.photo)
          if (x.pinned) { try { const p = JSON.parse(x.pinned); if (p) r.set("pinned", p) } catch (_) {} }
          app.save(r)
          restored++
          console.log("restore rooms: restored " + x.id + " (" + x.name + ") from " + f)
        } catch (err) { console.log("restore rooms: failed " + x.id + ": " + err) }
      }
    }
    console.log("restore rooms: done, restored " + restored)
  } catch (err) {
    console.log("restore rooms failed: " + err)
  } finally {
    try { $os.remove(tmp) } catch (_) {}
  }
}, (app) => {})
