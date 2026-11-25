/// <reference path="../pb_data/types.d.ts" />
// تحدي لايف: بين لايفين (liveA ضد liveB)، نفس جدول التحديات
migrate((app) => {
  const c = app.findCollectionByNameOrId("pks")
  c.fields.add(new TextField({ name: "liveA", max: 40 }))
  c.fields.add(new TextField({ name: "liveB", max: 40 }))
  c.addIndex("idx_pks_lives", false, "liveA, liveB", "")
  app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId("pks")
  c.removeIndex("idx_pks_lives"); c.fields.removeByName("liveA"); c.fields.removeByName("liveB")
  app.save(c)
})
