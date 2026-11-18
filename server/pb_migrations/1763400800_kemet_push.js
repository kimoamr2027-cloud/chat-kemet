/// <reference path="../pb_data/types.d.ts" />
// إشعارات الموبايل: كل موبايل/متصفح فعّل الإشعارات ليه اشتراك هنا
migrate((app) => {
  app.save(new Collection({
    type: "base", name: "pushsubs",
    listRule: "@request.auth.id = owner", viewRule: "@request.auth.id = owner",
    createRule: "@request.auth.id != '' && @request.auth.id = @request.body.owner", updateRule: null, deleteRule: "@request.auth.id = owner",
    fields: [
      { name: "owner", type: "text", required: true, max: 64 },
      { name: "endpoint", type: "text", required: true, max: 1000 },
      { name: "keys", type: "json", maxSize: 1000 },
      { name: "ua", type: "text", max: 200 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_pushsubs_endpoint ON pushsubs (endpoint)", "CREATE INDEX idx_pushsubs_owner ON pushsubs (owner)"],
  }))
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("pushsubs")) } catch (_) {}
})
