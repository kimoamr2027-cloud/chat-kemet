/// <reference path="../pb_data/types.d.ts" />
// إشعار جديد: «فلان بيدعوك تدخل غرفة كذا» (من خانة المتصلين)
migrate((app) => {
  const n = app.findCollectionByNameOrId("notifications")
  n.fields.getByName("type").values = ["dm", "reply", "mention", "react", "mod", "invite"]
  app.save(n)
}, (app) => {
  const n = app.findCollectionByNameOrId("notifications")
  n.fields.getByName("type").values = ["dm", "reply", "mention", "react", "mod"]
  app.save(n)
})
