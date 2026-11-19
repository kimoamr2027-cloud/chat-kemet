/// <reference path="../pb_data/types.d.ts" />
// شحن الكوينز بفودافون كاش: العضو بيبعت طلب (الباقة + الرقم اللي حوّل منه + صورة التحويل) والأدمن بيوافق
// الكتابة من السيرفر بس (topup.pb.js). العضو بيشوف طلباته، والأدمن بيشوف الكل من route
migrate((app) => {
  app.save(new Collection({
    type: "base", name: "topups",
    listRule: "@request.auth.id = owner", viewRule: "@request.auth.id = owner", createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "owner", type: "text", required: true, max: 64 },
      { name: "name", type: "text", max: 30 },
      { name: "egp", type: "number", onlyInt: true },
      { name: "coins", type: "number", onlyInt: true },
      { name: "sender", type: "text", max: 20 },
      { name: "proof", type: "text", max: 460000, hidden: true },
      { name: "status", type: "text", max: 12 },
      { name: "note", type: "text", max: 120 },
      { name: "decided", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_topups_owner ON topups (owner, created)", "CREATE INDEX idx_topups_status ON topups (status, created)"],
  }))
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("topups")) } catch (_) {}
})
