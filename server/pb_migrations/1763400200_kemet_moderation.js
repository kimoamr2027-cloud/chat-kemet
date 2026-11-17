/// <reference path="../pb_data/types.d.ts" />
// "فلان دخل الغرفة"، الكتم والطرد من الغرفة، والحظر من التطبيق كله
migrate((app) => {
  const AUTH = "@request.auth.id != ''"
  const idField = { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 120, pattern: "^[A-Za-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{15}" }

  // سجل لكل (غرفة، عضو): id = room_uid
  app.save(new Collection({
    type: "base", name: "joins",
    listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: null,
    fields: [
      idField,
      { name: "room", type: "text", required: true, max: 40 },
      { name: "uid", type: "text", required: true, max: 64 },
      { name: "name", type: "text", max: 30 },
      { name: "at", type: "date" },
    ],
    indexes: ["CREATE INDEX idx_joins_room_at ON joins (room, at)"],
  }))

  // الكتم والطرد: id = room_uid
  app.save(new Collection({
    type: "base", name: "restrict",
    listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH,
    fields: [
      idField,
      { name: "room", type: "text", required: true, max: 40 },
      { name: "uid", type: "text", required: true, max: 64 },
      { name: "type", type: "select", required: true, maxSelect: 1, values: ["mute", "ban"] },
      { name: "until", type: "date", required: true },
      { name: "name", type: "text", max: 30 },
      { name: "by", type: "text", max: 64 },
      { name: "byName", type: "text", max: 30 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_restrict_room ON restrict (room)"],
  }))

  // الحظر من التطبيق: id = uid (الأدمن بس)
  app.save(new Collection({
    type: "base", name: "bans",
    listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: null, deleteRule: AUTH,
    fields: [
      { ...idField, max: 64 },
      { name: "name", type: "text", max: 30 },
      { name: "reason", type: "text", max: 200 },
      { name: "by", type: "text", max: 64 },
      { name: "created", type: "autodate", onCreate: true },
    ],
  }))
}, (app) => {
  for (const n of ["bans", "restrict", "joins"]) {
    try { app.delete(app.findCollectionByNameOrId(n)) } catch (_) {}
  }
})
