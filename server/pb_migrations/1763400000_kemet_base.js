/// <reference path="../pb_data/types.d.ts" />
// المرحلة ١: الأعضاء، الغرف، الرسايل، الإعدادات (الأدوار والكلمات الممنوعة)، المتصلين
// القواعد الصعبة (مين يعمل إيه) في pb_hooks، هنا الشكل بس
migrate((app) => {
  const AUTH = "@request.auth.id != ''"

  // ===== الأعضاء: رقم العضو = رقم Firebase بتاعه (علشان النقل يبقى سهل) =====
  const users = app.findCollectionByNameOrId("users")
  const id = users.fields.getByName("id")
  id.min = 1
  id.max = 64
  id.pattern = "^[A-Za-z0-9_-]+$"
  users.fields.removeByName("avatar")
  users.fields.removeByName("name")
  users.fields.add(new TextField({ name: "name", max: 30 }))
  users.fields.add(new SelectField({ name: "gender", values: ["male", "female"], maxSelect: 1 }))
  users.fields.add(new TextField({ name: "bio", max: 150 }))
  users.fields.add(new TextField({ name: "city", max: 40 }))
  users.fields.add(new NumberField({ name: "age", onlyInt: true, min: 13, max: 100 }))
  users.fields.add(new TextField({ name: "avatar", max: 120000 }))
  users.fields.add(new JSONField({ name: "rooms", maxSize: 20000 }))
  users.listRule = AUTH
  users.viewRule = AUTH
  users.createRule = null // بيتعمل من /api/kemet/auth بس
  users.updateRule = "@request.auth.id = id"
  users.deleteRule = null
  users.passwordAuth.enabled = false // الدخول عن طريق Firebase بس
  users.oauth2.enabled = false
  app.save(users)

  // ===== الغرف =====
  const rooms = new Collection({
    type: "base",
    name: "rooms",
    listRule: AUTH,
    viewRule: AUTH,
    createRule: AUTH, // الأدمن بس (hooks)
    updateRule: AUTH, // الأدمن والمشرف (hooks)
    deleteRule: AUTH, // الأدمن بس (hooks)
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 40, pattern: "^[a-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{12}" },
      { name: "name", type: "text", required: true, max: 30 },
      { name: "order", type: "number", onlyInt: true },
      { name: "photo", type: "text", max: 120000 },
      { name: "pinned", type: "json", maxSize: 4000 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  })
  app.save(rooms)

  // ===== رسايل الغرف =====
  const messages = new Collection({
    type: "base",
    name: "messages",
    listRule: AUTH,
    viewRule: AUTH,
    createRule: AUTH, // الشكل والصلاحيات في hooks
    updateRule: null, // التعديل والتفاعل من routes مخصوصة
    deleteRule: AUTH, // صاحبها أو المشرف (hooks)
    fields: [
      { name: "room", type: "text", required: true, max: 40 },
      { name: "uid", type: "text", required: true, max: 64 },
      { name: "name", type: "text", max: 30 },
      { name: "gender", type: "text", max: 10 },
      { name: "kind", type: "select", required: true, maxSelect: 1, values: ["text", "sticker", "image", "voice", "ludo", "snakes", "domino"] },
      { name: "text", type: "text", max: 1000 },
      { name: "sticker", type: "number", onlyInt: true, min: 0, max: 5 },
      { name: "media", type: "text", max: 40 },
      { name: "w", type: "number", onlyInt: true },
      { name: "h", type: "number", onlyInt: true },
      { name: "dur", type: "number", onlyInt: true },
      { name: "thumb", type: "text", max: 30000 },
      { name: "table", type: "text", max: 40 },
      { name: "replyTo", type: "json", maxSize: 2000 },
      { name: "reactions", type: "json", maxSize: 20000 },
      { name: "edited", type: "bool" },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_messages_room_created ON messages (room, created)"],
  })
  app.save(messages)

  // ===== الإعدادات: roles (الأدمن والمشرفين) و filter (الكلمات الممنوعة) =====
  const config = new Collection({
    type: "base",
    name: "config",
    listRule: AUTH,
    viewRule: AUTH,
    createRule: AUTH, // الأدمن بس (hooks)
    updateRule: AUTH,
    deleteRule: null,
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 40, pattern: "^[a-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{12}" },
      { name: "data", type: "json", maxSize: 200000 },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  })
  app.save(config)
  const roles = new Record(config)
  roles.set("id", "roles")
  roles.set("data", { admins: [], mods: {} })
  app.save(roles)
  const filter = new Record(config)
  filter.set("id", "filter")
  filter.set("data", { words: [], pattern: "" })
  app.save(filter)

  // ===== المتصلين: سجل واحد لكل عضو (رقمه = رقم العضو) =====
  const presence = new Collection({
    type: "base",
    name: "presence",
    listRule: AUTH,
    viewRule: AUTH,
    createRule: "@request.auth.id = @request.body.id",
    updateRule: "@request.auth.id = id",
    deleteRule: "@request.auth.id = id",
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 64, pattern: "^[A-Za-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{15}" },
      { name: "room", type: "text", max: 40 },
      { name: "name", type: "text", max: 30 },
      { name: "at", type: "date" },
      { name: "roomAt", type: "date" },
    ],
    indexes: ["CREATE INDEX idx_presence_room ON presence (room, roomAt)"],
  })
  app.save(presence)
}, (app) => {
  for (const n of ["presence", "config", "messages", "rooms"]) {
    try { app.delete(app.findCollectionByNameOrId(n)) } catch (_) {}
  }
})
