/// <reference path="../pb_data/types.d.ts" />
// القبايل: كل عضو مسجّل ينضم لقبيلة، والقبايل بتتنافس كل أسبوع بالنقط
// - tribes: القبايل (الأدمن يغيّر أساميها من لوحة السيرفر)
// - users.tribe: قبيلة العضو (ظاهرة للكل علشان الشارة)، users.tribeAt: آخر مرة غيّرها (مخفية)
migrate((app) => {
  const AUTH = "@request.auth.id != ''"
  const col = new Collection({
    type: "base", name: "tribes",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 20, pattern: "^[a-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{10}" },
      { name: "name", type: "text", required: true, max: 30 },
      { name: "icon", type: "text", max: 8 },
      { name: "desc", type: "text", max: 120 },
      { name: "order", type: "number", onlyInt: true },
    ],
  })
  app.save(col)
  const seed = [
    ["saeed", "الصعايدة", "🌾", "من بني سويف لأسوان", 1],
    ["alex", "إسكندرية", "🌊", "عروس البحر ومطروح", 2],
    ["cairo", "القاهرة والجيزة", "🏙️", "أم الدنيا وضواحيها", 3],
    ["delta", "الدلتا", "🌿", "المنوفية والغربية والشرقية والدقهلية وكل الدلتا", 4],
    ["canal", "القناة وسينا", "⚓", "بورسعيد والإسماعيلية والسويس وسينا والبحر الأحمر", 5],
    ["abroad", "المصريين في الغربة", "✈️", "اللي برّه مصر وقلبه فيها", 6],
  ]
  for (const [id, name, icon, desc, order] of seed) {
    const r = new Record(col)
    r.set("id", id); r.set("name", name); r.set("icon", icon); r.set("desc", desc); r.set("order", order)
    app.save(r)
  }
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new TextField({ name: "tribe", max: 20 }))
  users.fields.add(new NumberField({ name: "tribeAt", onlyInt: true, hidden: true }))
  users.addIndex("idx_users_tribe", false, "tribe", "")
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  users.removeIndex("idx_users_tribe")
  users.fields.removeByName("tribe")
  users.fields.removeByName("tribeAt")
  app.save(users)
  try { app.delete(app.findCollectionByNameOrId("tribes")) } catch (_) {}
})
