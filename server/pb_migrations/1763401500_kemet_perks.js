/// <reference path="../pb_data/types.d.ts" />
// فقاعات الرسايل والارتباط
// perks (id = uid): شكل الفقاعة لحد إمتى + الارتباط (مين والخاتم ومن إمتى)
// proposals: طلبات الارتباط (الكوينز بتتخصم وقت الطلب وبترجع لو اترفض أو اتلغى)
// events: إعلانات بتظهر لكل الناس (مبروك فلان وفلانة ارتبطوا)
// الكتابة من السيرفر بس (perks.pb.js)
migrate((app) => {
  const id = { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 64, pattern: "^[A-Za-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{15}" }
  app.save(new Collection({
    type: "base", name: "perks",
    listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''", createRule: null, updateRule: null, deleteRule: null,
    fields: [
      id,
      { name: "bubble", type: "text", max: 20 },
      { name: "bubbleUntil", type: "number", onlyInt: true },
      { name: "partner", type: "text", max: 64 },
      { name: "partnerName", type: "text", max: 30 },
      { name: "ring", type: "number", onlyInt: true },
      { name: "since", type: "number", onlyInt: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  }))
  app.save(new Collection({
    type: "base", name: "proposals",
    listRule: "@request.auth.id = asker || @request.auth.id = target", viewRule: "@request.auth.id = asker || @request.auth.id = target", createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "asker", type: "text", required: true, max: 64 },
      { name: "askerName", type: "text", max: 30 },
      { name: "target", type: "text", required: true, max: 64 },
      { name: "targetName", type: "text", max: 30 },
      { name: "ring", type: "number", onlyInt: true },
      { name: "paid", type: "number", onlyInt: true },
      { name: "status", type: "text", max: 12 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_prop_to ON proposals (target, status)", "CREATE INDEX idx_prop_from ON proposals (asker, status)"],
  }))
  app.save(new Collection({
    type: "base", name: "events",
    listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''", createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "kind", type: "text", max: 20 },
      { name: "a", type: "text", max: 64 },
      { name: "aName", type: "text", max: 30 },
      { name: "b", type: "text", max: 64 },
      { name: "bName", type: "text", max: 30 },
      { name: "ring", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_events_created ON events (created)"],
  }))
}, (app) => {
  for (const n of ["perks", "proposals", "events"]) { try { app.delete(app.findCollectionByNameOrId(n)) } catch (_) {} }
})
