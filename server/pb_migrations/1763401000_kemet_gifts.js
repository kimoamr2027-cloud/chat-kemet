/// <reference path="../pb_data/types.d.ts" />
// هدايا الغرفة الصوتية: كل هدية بتتسجل هنا، وكل اللي في الغرفة بيشوفوها لحظيًا
migrate((app) => {
  app.save(new Collection({
    type: "base", name: "gifts",
    listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''", createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "room", type: "text", required: true, max: 40 },
      { name: "gift", type: "text", required: true, max: 20 },
      { name: "from", type: "text", max: 64 },
      { name: "fromName", type: "text", max: 30 },
      { name: "to", type: "text", max: 64 },
      { name: "toName", type: "text", max: 30 },
      { name: "price", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_gifts_room ON gifts (room, created)"],
  }))
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("gifts")) } catch (_) {}
})
