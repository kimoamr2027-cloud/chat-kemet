/// <reference path="../pb_data/types.d.ts" />
// - visits: مين زار بروفايلك (سجل واحد لكل زائر، بيتمسح بعد ٣٠ يوم)
// - friends: الأصحاب (طلب ← موافقة)، ورقمه = رقمين الاتنين مترتبين
// - إشعار جديد friend: طلب صداقة / اتقبل
migrate((app) => {
  const AUTH = "@request.auth.id != ''"
  app.save(new Collection({
    type: "base", name: "visits",
    listRule: "@request.auth.id = owner", viewRule: "@request.auth.id = owner", createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 140, pattern: "^[A-Za-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{15}" },
      { name: "owner", type: "text", required: true, max: 64 },
      { name: "visitor", type: "text", required: true, max: 64 },
      { name: "visitorName", type: "text", max: 30 },
      { name: "n", type: "number", onlyInt: true },
      { name: "at", type: "date" },
    ],
    indexes: ["CREATE INDEX idx_visits_owner ON visits (owner, at)"],
  }))
  app.save(new Collection({
    type: "base", name: "friends",
    listRule: "@request.auth.id = a || @request.auth.id = b", viewRule: "@request.auth.id = a || @request.auth.id = b",
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 140, pattern: "^[A-Za-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{15}" },
      { name: "a", type: "text", required: true, max: 64 },
      { name: "b", type: "text", required: true, max: 64 },
      { name: "from", type: "text", max: 64 },
      { name: "status", type: "select", maxSelect: 1, values: ["pending", "ok"] },
      { name: "alerts", type: "json", maxSize: 500 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_friends_a ON friends (a)", "CREATE INDEX idx_friends_b ON friends (b)"],
  }))
  const n = app.findCollectionByNameOrId("notifications")
  n.fields.getByName("type").values = ["dm", "reply", "mention", "react", "mod", "invite", "welcome", "friend"]
  app.save(n)
}, (app) => {
  for (const c of ["visits", "friends"]) { try { app.delete(app.findCollectionByNameOrId(c)) } catch (_) {} }
  const n = app.findCollectionByNameOrId("notifications")
  n.fields.getByName("type").values = ["dm", "reply", "mention", "react", "mod", "invite", "welcome"]
  app.save(n)
})
