/// <reference path="../pb_data/types.d.ts" />
// 🙋 ضيوف اللايف: أي متفرج يطلب يطلع مع المضيف، والمضيف يوافق (٣ ضيوف بالكتير)
migrate((app) => {
  const l = app.findCollectionByNameOrId("lives")
  l.fields.add(new JSONField({ name: "guests", maxSize: 4000 }))
  l.fields.add(new JSONField({ name: "asks", maxSize: 20000 }))
  app.save(l)
}, (app) => {
  const l = app.findCollectionByNameOrId("lives")
  l.fields.removeByName("guests"); l.fields.removeByName("asks")
  app.save(l)
})
