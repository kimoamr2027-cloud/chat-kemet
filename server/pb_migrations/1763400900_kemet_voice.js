/// <reference path="../pb_data/types.d.ts" />
// الغرفة الصوتية (الملوك القدماء): الكراسي والموضوع والإيد المرفوعة
// الكتابة كلها من السيرفر (routes في voice.pb.js)، والكل يقرا لحظيًا
migrate((app) => {
  const AUTH = "@request.auth.id != ''"
  app.save(new Collection({
    type: "base", name: "voice",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 40, pattern: "^[a-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{15}" },
      { name: "name", type: "text", max: 40 },
      { name: "topic", type: "text", max: 120 },
      // center: كراسي مجلس العرش (الأدمن والمشرفين)، ring: كراسي الأعضاء
      // كل كرسي: { uid, name } أو null، و locked: أرقام كراسي الدايرة المقفولة
      { name: "seats", type: "json", maxSize: 5000 },
      { name: "muted", type: "json", maxSize: 5000 },
      { name: "hands", type: "json", maxSize: 20000 },
      // عدد اللي في الغرفة دلوقتي (بيتحدّث كل دقيقة)
      { name: "here", type: "number", onlyInt: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  }))
  const r = new Record(app.findCollectionByNameOrId("voice"))
  r.set("id", "kings")
  r.set("name", "الملوك القدماء")
  r.set("topic", "")
  r.set("seats", { center: [null, null, null], ring: [null, null, null, null, null, null, null, null], locked: [] })
  r.set("muted", {})
  r.set("hands", {})
  app.save(r)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("voice")) } catch (_) {}
})
