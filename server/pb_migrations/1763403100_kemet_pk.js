/// <reference path="../pb_data/types.d.ts" />
// التحدي (PK) في الغرفة الصوتية: اتنين قاعدين على كراسي، والجمهور بيدعم بالهدايا والورد
migrate((app) => {
  const AUTH = "@request.auth.id != ''"
  app.save(new Collection({
    type: "base", name: "pks",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 40, pattern: "^[a-z0-9]+$", autogeneratePattern: "[a-z0-9]{15}" },
      { name: "room", type: "text", required: true, max: 40 },
      { name: "a", type: "text", max: 64 }, { name: "aName", type: "text", max: 30 },
      { name: "b", type: "text", max: 64 }, { name: "bName", type: "text", max: 30 },
      { name: "from", type: "text", max: 64 },
      { name: "status", type: "select", maxSelect: 1, values: ["invite", "live", "done", "off"] },
      { name: "mins", type: "number", onlyInt: true },
      { name: "startAt", type: "number", onlyInt: true },
      { name: "endAt", type: "number", onlyInt: true },
      { name: "scoreA", type: "number", onlyInt: true },
      { name: "scoreB", type: "number", onlyInt: true },
      { name: "supA", type: "json", maxSize: 20000 },
      { name: "supB", type: "json", maxSize: 20000 },
      { name: "roses", type: "json", maxSize: 20000 },
      { name: "winner", type: "text", max: 64 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_pks_room ON pks (room, created)"],
  }))
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("pks")) } catch (_) {}
})
