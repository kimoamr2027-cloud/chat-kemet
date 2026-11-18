/// <reference path="../pb_data/types.d.ts" />
// VIP كيمت: ٦ مستويات بتتشرى بالكوينز لمدة ٣٠ يوم (id = uid). الكتابة من السيرفر بس (vip.pb.js)
migrate((app) => {
  app.save(new Collection({
    type: "base", name: "vips",
    listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''", createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 64, pattern: "^[A-Za-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{15}" },
      { name: "level", type: "number", onlyInt: true },
      { name: "until", type: "number", onlyInt: true },
      { name: "name", type: "text", max: 30 },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  }))
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("vips")) } catch (_) {}
})
