/// <reference path="../pb_data/types.d.ts" />
// البداية: الأدمنز والمشرفين والغرف زي الشات الحالي (صور الغرف والرسايل بتتنقل بعدين)
migrate((app) => {
  const roles = app.findRecordById("config", "roles")
  roles.set("data", {
    admins: ["w9zT4g6X0cfWiLideNZUSvubRoW2", "LoywF10oR3S539R3gu8BMCxJLU82"],
    mods: { pyramids: ["GBqiFyCCNKZbaZQgQL0Aqsdm0b12"] },
  })
  app.save(roles)

  const col = app.findCollectionByNameOrId("rooms")
  const rooms = [
    ["pyramids", "غرفة الأهرامات", 1],
    ["nile", "نهر النيل", 2],
    ["luxor", "الأقصر وأسوان", 3],
    ["alex", "إسكندرية", 4],
    ["youth", "شباب كيمت", 5],
    ["history", "تاريخ مصر القديمة", 6],
  ]
  for (const [id, name, order] of rooms) {
    try { app.findRecordById("rooms", id); continue } catch (_) {}
    const r = new Record(col)
    r.set("id", id)
    r.set("name", name)
    r.set("order", order)
    app.save(r)
  }
}, (app) => {})
