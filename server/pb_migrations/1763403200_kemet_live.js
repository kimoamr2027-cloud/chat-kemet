/// <reference path="../pb_data/types.d.ts" />
// 🔴 اللايف بالفيديو: المضيفين المعتمدين بس (الأدمن بيوافق)، و٣ لايفات في نفس الوقت بالكتير
// - users.liveHost: مضيف معتمد (السيرفر بس اللي بيغيّره)
// - lives: اللايفات (شغال / خلص)
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new BoolField({ name: "liveHost" }))
  app.save(users)
  const AUTH = "@request.auth.id != ''"
  app.save(new Collection({
    type: "base", name: "lives",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 40, pattern: "^[a-z0-9]+$", autogeneratePattern: "[a-z0-9]{15}" },
      { name: "host", type: "text", required: true, max: 64 },
      { name: "hostName", type: "text", max: 30 },
      { name: "title", type: "text", max: 60 },
      { name: "status", type: "select", maxSelect: 1, values: ["live", "ended"] },
      { name: "viewers", type: "number", onlyInt: true },
      { name: "startAt", type: "number", onlyInt: true },
      { name: "endAt", type: "number", onlyInt: true },
      { name: "endedBy", type: "text", max: 64 },
      { name: "seenAt", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_lives_status ON lives (status, created)"],
  }))
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("lives")) } catch (_) {}
  const users = app.findCollectionByNameOrId("users"); users.fields.removeByName("liveHost"); app.save(users)
})
