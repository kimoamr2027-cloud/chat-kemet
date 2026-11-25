/// <reference path="../pb_data/types.d.ts" />
// موازنة الكوينز وحاجات تتشرى بيها:
// - users.invitePaid: هدية الدعوة اتدفعت (بتتدفع لما الجديد يكتب ١٠ رسايل). الدعوات القديمة اتدفعت خلاص
// - rooms.boost: رسالة مرفوعة في الغرفة ١٠ دقايق (بـ ١٠٠ كوين)
// - perks.color / colorUntil: لون الاسم ليوم واحد (بـ ٢٠٠ كوين)
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new BoolField({ name: "invitePaid", hidden: true }))
  app.save(users)
  app.db().newQuery("UPDATE users SET invitePaid = TRUE WHERE invitedBy != ''").execute()
  const rooms = app.findCollectionByNameOrId("rooms")
  rooms.fields.add(new JSONField({ name: "boost", maxSize: 2000 }))
  app.save(rooms)
  const perks = app.findCollectionByNameOrId("perks")
  perks.fields.add(new TextField({ name: "color", max: 20 }))
  perks.fields.add(new NumberField({ name: "colorUntil", onlyInt: true }))
  app.save(perks)
}, (app) => {
  const users = app.findCollectionByNameOrId("users"); users.fields.removeByName("invitePaid"); app.save(users)
  const rooms = app.findCollectionByNameOrId("rooms"); rooms.fields.removeByName("boost"); app.save(rooms)
  const perks = app.findCollectionByNameOrId("perks"); perks.fields.removeByName("color"); perks.fields.removeByName("colorUntil"); app.save(perks)
})
