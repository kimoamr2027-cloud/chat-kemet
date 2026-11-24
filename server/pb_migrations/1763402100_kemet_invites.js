/// <reference path="../pb_data/types.d.ts" />
// - users.invitedBy: مين دعاه (لينك الدعوة) — السيرفر بس اللي بيحطه
// - users.nudgedAt: آخر مرة اتبعتله إشعار «وحشتنا» (علشان مانزهقهوش)
// (الاتنين مخفيين: مابيظهروش لحد غير السيرفر)
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new TextField({ name: "invitedBy", max: 64, hidden: true }))
  users.fields.add(new NumberField({ name: "nudgedAt", onlyInt: true, hidden: true }))
  users.addIndex("idx_users_invitedBy", false, "invitedBy", "")
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  users.removeIndex("idx_users_invitedBy")
  users.fields.removeByName("invitedBy")
  users.fields.removeByName("nudgedAt")
  app.save(users)
})
