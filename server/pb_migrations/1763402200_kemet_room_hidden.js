/// <reference path="../pb_data/types.d.ts" />
// مسح الغرفة بقى «إخفاء»: الغرفة بتختفي من عند الناس وتفضل موجودة برسايلها، والأدمن يقدر يرجّعها
migrate((app) => {
  const rooms = app.findCollectionByNameOrId("rooms")
  rooms.fields.add(new BoolField({ name: "hidden" }))
  app.save(rooms)
}, (app) => {
  const rooms = app.findCollectionByNameOrId("rooms")
  rooms.fields.removeByName("hidden")
  app.save(rooms)
})
