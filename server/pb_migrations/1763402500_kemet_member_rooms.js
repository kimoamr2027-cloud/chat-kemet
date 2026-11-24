/// <reference path="../pb_data/types.d.ts" />
// غرف الأعضاء: أي عضو مسجّل يعمل غرفة واحدة باسمه وهو مشرفها
// - rooms.owner / ownerName: صاحب الغرفة (فاضي = غرفة رسمية)
// - rooms.hiddenBy: مين قفلها (owner / admin / idle = فضيت أسبوع)
migrate((app) => {
  const rooms = app.findCollectionByNameOrId("rooms")
  rooms.fields.add(new TextField({ name: "owner", max: 64 }))
  rooms.fields.add(new TextField({ name: "ownerName", max: 30 }))
  rooms.fields.add(new TextField({ name: "hiddenBy", max: 10 }))
  rooms.addIndex("idx_rooms_owner", false, "owner", "")
  app.save(rooms)
}, (app) => {
  const rooms = app.findCollectionByNameOrId("rooms")
  rooms.removeIndex("idx_rooms_owner")
  for (const f of ["owner", "ownerName", "hiddenBy"]) rooms.fields.removeByName(f)
  app.save(rooms)
})
