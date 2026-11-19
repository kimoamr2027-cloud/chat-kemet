/// <reference path="../pb_data/types.d.ts" />
// تنبيهات الـ VIP: بنفتكر إمتى بعتنا «هيخلص بعد ٣ أيام» و«خلص» علشان مانكررش
migrate((app) => {
  const c = app.findCollectionByNameOrId("vips")
  c.fields.add(new NumberField({ name: "warned", onlyInt: true }))
  c.fields.add(new NumberField({ name: "ended", onlyInt: true }))
  app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId("vips")
  c.fields.removeByName("warned"); c.fields.removeByName("ended")
  app.save(c)
})
