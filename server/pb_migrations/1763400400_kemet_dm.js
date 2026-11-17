/// <reference path="../pb_data/types.d.ts" />
// المرحلة ٢: الخاص، الإشعارات، إعدادات الخصوصية، البلاغات
migrate((app) => {
  const AUTH = "@request.auth.id != ''"
  const ME = "@request.auth.id = id"
  const MEMBER = "@request.auth.id = a || @request.auth.id = b"
  const idField = { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 120, pattern: "^[A-Za-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{15}" }

  // إعدادات الخصوصية: id = uid (صاحبها بس يشوفها — فيها قايمة المحظورين)
  app.save(new Collection({
    type: "base", name: "settings",
    listRule: ME, viewRule: ME, createRule: "@request.auth.id = @request.body.id", updateRule: ME, deleteRule: null,
    fields: [
      { ...idField, max: 64 },
      { name: "blocked", type: "json", maxSize: 200000 },
      { name: "dmWho", type: "select", maxSelect: 1, values: ["all", "rooms", "none"] },
      { name: "noReceipts", type: "bool" },
      { name: "hideOnline", type: "bool" },
      { name: "notif", type: "json", maxSize: 500 },
    ],
  }))

  // المحادثات: id = uid1_uid2 (مترتبين). كل الكتابة من السيرفر
  app.save(new Collection({
    type: "base", name: "chats",
    listRule: MEMBER, viewRule: MEMBER, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      idField,
      { name: "a", type: "text", required: true, max: 64 },
      { name: "b", type: "text", required: true, max: 64 },
      { name: "last", type: "json", maxSize: 2000 },
      { name: "unread", type: "json", maxSize: 500 },
      { name: "readAt", type: "json", maxSize: 500 },
      { name: "active", type: "json", maxSize: 500 },
      { name: "typing", type: "json", maxSize: 500 },
      { name: "updatedAt", type: "date" },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_chats_a ON chats (a)", "CREATE INDEX idx_chats_b ON chats (b)"],
  }))

  // رسايل الخاص
  app.save(new Collection({
    type: "base", name: "dms",
    listRule: MEMBER, viewRule: MEMBER, createRule: AUTH, updateRule: null, deleteRule: "@request.auth.id = uid",
    fields: [
      { name: "chat", type: "text", required: true, max: 130 },
      { name: "a", type: "text", required: true, max: 64 },
      { name: "b", type: "text", required: true, max: 64 },
      { name: "uid", type: "text", required: true, max: 64 },
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
      { name: "reactions", type: "json", maxSize: 1000 },
      { name: "edited", type: "bool" },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_dms_chat_created ON dms (chat, created)"],
  }))

  // الإشعارات: السيرفر بس اللي بيكتبها (من /api/kemet/notify)، وصاحبها يعلّم إنه قراها أو يمسحها
  app.save(new Collection({
    type: "base", name: "notifications",
    listRule: "@request.auth.id = owner", viewRule: "@request.auth.id = owner",
    createRule: null, updateRule: "@request.auth.id = owner", deleteRule: "@request.auth.id = owner",
    fields: [
      idField,
      { name: "owner", type: "text", required: true, max: 64 },
      { name: "type", type: "select", required: true, maxSelect: 1, values: ["dm", "reply", "mention", "react", "mod"] },
      { name: "from", type: "text", max: 64 },
      { name: "fromName", type: "text", max: 30 },
      { name: "text", type: "text", max: 120 },
      { name: "roomId", type: "text", max: 40 },
      { name: "roomName", type: "text", max: 30 },
      { name: "msgId", type: "text", max: 64 },
      { name: "emoji", type: "text", max: 10 },
      { name: "read", type: "bool" },
      { name: "at", type: "date" },
    ],
    indexes: ["CREATE INDEX idx_notif_owner_at ON notifications (owner, at)"],
  }))

  // البلاغات: أي عضو يبلّغ، والأدمن بس يشوفها (من /api/kemet/reports)
  app.save(new Collection({
    type: "base", name: "reports",
    listRule: null, viewRule: null, createRule: AUTH, updateRule: null, deleteRule: null,
    fields: [
      { name: "reporter", type: "text", required: true, max: 64 },
      { name: "reported", type: "text", required: true, max: 64 },
      { name: "reportedName", type: "text", max: 30 },
      { name: "reason", type: "text", required: true, max: 100 },
      { name: "chatId", type: "text", max: 300 },
      { name: "created", type: "autodate", onCreate: true },
    ],
  }))
}, (app) => {
  for (const n of ["reports", "notifications", "dms", "chats", "settings"]) {
    try { app.delete(app.findCollectionByNameOrId(n)) } catch (_) {}
  }
})
