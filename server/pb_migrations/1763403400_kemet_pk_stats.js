/// <reference path="../pb_data/types.d.ts" />
// إحصائيات التحدي لكل عضو (سلسلة الانتصارات وانتصارات الأسبوع) + تحدي الفرق في الغرفة الصوتية
migrate((app) => {
  const AUTH = "@request.auth.id != ''"
  app.save(new Collection({
    type: "base", name: "pkstats",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 64, pattern: "^[A-Za-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{15}" },
      { name: "name", type: "text", max: 30 },
      { name: "wins", type: "number", onlyInt: true },
      { name: "losses", type: "number", onlyInt: true },
      { name: "streak", type: "number", onlyInt: true },
      { name: "best", type: "number", onlyInt: true },
      { name: "week", type: "text", max: 10 },
      { name: "weekWins", type: "number", onlyInt: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_pkstats_week ON pkstats (week, weekWins)"],
  }))
  const c = app.findCollectionByNameOrId("pks")
  c.fields.add(new JSONField({ name: "teamA", maxSize: 2000 }))
  c.fields.add(new JSONField({ name: "teamB", maxSize: 2000 }))
  app.save(c)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("pkstats")) } catch (_) {}
  const c = app.findCollectionByNameOrId("pks"); c.fields.removeByName("teamA"); c.fields.removeByName("teamB"); app.save(c)
})
