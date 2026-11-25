/// <reference path="../pb_data/types.d.ts" />
// 📣 شريط الهدايا الكبيرة محتاج يعرف الهدية اتبعتت فين (غرفة كتابة / صوتية / لايف)
// 🎯 أمنية الغرفة: هدف هدايا يومي لكل غرفة، ولما يكمل كل الموجودين بياخدوا كوينز
migrate((app) => {
  const g = app.findCollectionByNameOrId("gifts")
  g.fields.add(new TextField({ name: "kind", max: 10 }))
  g.addIndex("idx_gifts_price", false, "price, created", "")
  app.save(g)
  const AUTH = "@request.auth.id != ''"
  app.save(new Collection({
    type: "base", name: "wishes",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 40, pattern: "^[A-Za-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{15}" },
      { name: "day", type: "text", max: 10 },
      { name: "n", type: "number", onlyInt: true },
      { name: "level", type: "number", onlyInt: true },
      { name: "doneAt", type: "number", onlyInt: true },
      { name: "doneN", type: "number", onlyInt: true },
      { name: "doneCoins", type: "number", onlyInt: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  }))
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("wishes")) } catch (_) {}
  const g = app.findCollectionByNameOrId("gifts"); g.fields.removeByName("kind"); g.removeIndex("idx_gifts_price"); app.save(g)
})
