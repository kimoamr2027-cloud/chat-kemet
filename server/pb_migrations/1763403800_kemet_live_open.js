/// <reference path="../pb_data/types.d.ts" />
// 🔴 اللايف مفتوح للأعضاء: منع من اللايف (لحد وقت معيّن) + الموافقة على القواعد
migrate((app) => {
  const u = app.findCollectionByNameOrId("users")
  u.fields.add(new NumberField({ name: "liveBan" }))
  u.fields.add(new BoolField({ name: "livePledge" }))
  app.save(u)
}, (app) => {
  const u = app.findCollectionByNameOrId("users")
  u.fields.removeByName("liveBan"); u.fields.removeByName("livePledge")
  app.save(u)
})
