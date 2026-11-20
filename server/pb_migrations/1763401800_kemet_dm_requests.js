/// <reference path="../pb_data/types.d.ts" />
// طلبات الرسايل: الزائر لما يبعت خاص لحد، أول رسالة بتبقى «طلب» والتاني يوافق أو يرفض
// chats.req = { from: uid الزائر, status: "pending" | "ok" | "no" }
migrate((app) => {
  const c = app.findCollectionByNameOrId("chats")
  c.fields.add(new JSONField({ name: "req", maxSize: 300 }))
  app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId("chats")
  c.fields.removeByName("req")
  app.save(c)
})
