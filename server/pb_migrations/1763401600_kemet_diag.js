/// <reference path="../pb_data/types.d.ts" />
// سجل الأخطاء: أي غلط بيحصل عند الأعضاء بيتسجّل هنا (مكان الغلط ونوعه بس، من غير رسايل)
// الأعضاء بيكتبوا بس، والأدمن بيقرا من route (/api/kemet/diag)
migrate((app) => {
  app.save(new Collection({
    type: "base", name: "diag",
    listRule: null, viewRule: null, createRule: "@request.auth.id != ''", updateRule: null, deleteRule: null,
    fields: [
      { name: "uid", type: "text", max: 64 },
      { name: "name", type: "text", max: 30 },
      { name: "where", type: "text", max: 60 },
      { name: "msg", type: "text", max: 300 },
      { name: "info", type: "text", max: 300 },
      { name: "ua", type: "text", max: 200 },
      { name: "ver", type: "text", max: 40 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_diag_created ON diag (created)", "CREATE INDEX idx_diag_uid ON diag (uid, created)"],
  }))
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("diag")) } catch (_) {}
})
