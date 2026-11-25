/// <reference path="../pb_data/types.d.ts" />
// 🎙 حفلات الأعضاء (غرف صوتية باسم العضو) + 📺 نوع اللايف
migrate((app) => {
  const v = app.findCollectionByNameOrId("voice")
  v.fields.add(new TextField({ name: "owner", max: 64 }))
  v.fields.add(new TextField({ name: "ownerName", max: 30 }))
  v.fields.add(new NumberField({ name: "lastAt", onlyInt: true }))
  app.save(v)
  const l = app.findCollectionByNameOrId("lives")
  l.fields.add(new TextField({ name: "cat", max: 20 }))
  l.fields.add(new BoolField({ name: "fresh" }))
  app.save(l)
}, (app) => {
  const v = app.findCollectionByNameOrId("voice")
  for (const f of ["owner", "ownerName", "lastAt"]) v.fields.removeByName(f)
  app.save(v)
  const l = app.findCollectionByNameOrId("lives")
  for (const f of ["cat", "fresh"]) l.fields.removeByName(f)
  app.save(l)
})
