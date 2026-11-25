/// <reference path="../pb_data/types.d.ts" />
// صندوق الكنز: بيظهر في غرفة فيها ناس، وأول واحد يدوس عليه ياخد الكوينز
migrate((app) => {
  const AUTH = "@request.auth.id != ''"
  app.save(new Collection({
    type: "base", name: "chests",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 40, pattern: "^[a-z0-9]+$", autogeneratePattern: "[a-z0-9]{15}" },
      { name: "room", type: "text", required: true, max: 40 },
      { name: "coins", type: "number", onlyInt: true },
      { name: "until", type: "number", onlyInt: true },
      { name: "winner", type: "text", max: 64 },
      { name: "winnerName", type: "text", max: 30 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_chests_room ON chests (room, created)"],
  }))
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("chests")) } catch (_) {}
})
