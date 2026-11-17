/// <reference path="../pb_data/types.d.ts" />
// فويسات الآيفون القديمة (m4a) بتتقري على إنها video/mp4 أو audio/x-m4a
migrate((app) => {
  const c = app.findCollectionByNameOrId("media")
  const f = c.fields.getByName("file")
  f.mimeTypes = ["image/jpeg", "audio/mpeg", "audio/mp4", "audio/x-m4a", "video/mp4", "audio/webm", "video/webm", "audio/aac", "audio/ogg", "audio/wav", "audio/x-wav"]
  app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId("media")
  c.fields.getByName("file").mimeTypes = ["image/jpeg", "audio/mpeg", "audio/mp4", "audio/webm", "audio/aac", "audio/ogg"]
  app.save(c)
})
