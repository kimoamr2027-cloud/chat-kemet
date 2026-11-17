/// <reference path="../pb_data/types.d.ts" />
// المرحلة ٣: الصور والفويس (ملفات حقيقية على السيرفر) + صوري في البروفايل
migrate((app) => {
  const AUTH = "@request.auth.id != ''"
  const SEE = "@request.auth.id != '' && (room != '' || @request.auth.id = a || @request.auth.id = b)"

  // ملف صورة أو فويس في غرفة (room) أو في خاص (a/b = العضوين)
  // الملفات "محمية": محتاجة توكن قصير من السيرفر، ومحدش يقدر يفتحها من برّه
  app.save(new Collection({
    type: "base", name: "media",
    listRule: SEE, viewRule: SEE, createRule: AUTH, updateRule: null, deleteRule: "@request.auth.id = owner",
    fields: [
      { name: "owner", type: "text", required: true, max: 64 },
      { name: "type", type: "select", required: true, maxSelect: 1, values: ["image", "voice"] },
      { name: "room", type: "text", max: 40 },
      { name: "chat", type: "text", max: 130 },
      { name: "a", type: "text", max: 64 },
      { name: "b", type: "text", max: 64 },
      { name: "file", type: "file", required: true, maxSelect: 1, maxSize: 3 * 1024 * 1024, protected: true,
        mimeTypes: ["image/jpeg", "audio/mpeg", "audio/mp4", "audio/webm", "audio/aac", "audio/ogg"] },
      { name: "created", type: "autodate", onCreate: true },
    ],
  }))

  // صوري (٦ بالكتير): id = uid_slot
  app.save(new Collection({
    type: "base", name: "photos",
    listRule: AUTH, viewRule: AUTH, createRule: "@request.auth.id = @request.body.owner",
    updateRule: "@request.auth.id = owner", deleteRule: "@request.auth.id = owner",
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 80, pattern: "^[A-Za-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{15}" },
      { name: "owner", type: "text", required: true, max: 64 },
      { name: "slot", type: "number", onlyInt: true, min: 0, max: 5 },
      { name: "data", type: "text", required: true, max: 300000 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_photos_owner ON photos (owner)"],
  }))
}, (app) => {
  for (const n of ["photos", "media"]) {
    try { app.delete(app.findCollectionByNameOrId(n)) } catch (_) {}
  }
})
