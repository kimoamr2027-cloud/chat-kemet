/// <reference path="../pb_data/types.d.ts" />
// المرحلة ٤: الألعاب والكوينز. كل الكتابة من السيرفر (routes في games.pb.js)
migrate((app) => {
  const AUTH = "@request.auth.id != ''"
  const idField = (max) => ({ name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max, pattern: "^[A-Za-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{15}" })

  // المحفظة: id = uid
  app.save(new Collection({
    type: "base", name: "wallets",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      idField(64),
      { name: "coins", type: "number", onlyInt: true },
      { name: "day", type: "number", onlyInt: true },
      { name: "streak", type: "number", onlyInt: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_wallets_coins ON wallets (coins)"],
  }))

  // كشف الحساب
  app.save(new Collection({
    type: "base", name: "coinlog",
    listRule: "@request.auth.id = owner", viewRule: "@request.auth.id = owner", createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "owner", type: "text", required: true, max: 64 },
      { name: "amount", type: "number", onlyInt: true },
      { name: "kind", type: "text", max: 20 },
      { name: "note", type: "text", max: 80 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_coinlog_owner ON coinlog (owner, created)"],
  }))

  // ترابيزات لودو والسلم والتعبان والدومينو
  // state = كل حالة اللعبة (نفس أسماء الحقول اللي الشاشات متعودة عليها)، deck = ورق السحب (مخفي)
  app.save(new Collection({
    type: "base", name: "tables",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "kind", type: "select", required: true, maxSelect: 1, values: ["ludo", "snakes", "domino"] },
      { name: "status", type: "text", max: 20 },
      { name: "host", type: "text", max: 64 },
      { name: "seats", type: "json", maxSize: 1000 },
      { name: "state", type: "json", maxSize: 20000 },
      { name: "deck", type: "json", maxSize: 1000, hidden: true },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_tables_kind_status ON tables (kind, status)"],
  }))

  // ورق الدومينو: كل لاعب يشوف ورقه بس، ولما اللعبة تخلص الكل يشوف
  app.save(new Collection({
    type: "base", name: "hands",
    listRule: "@request.auth.id = owner || open = true", viewRule: "@request.auth.id = owner || open = true",
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      idField(100),
      { name: "owner", type: "text", required: true, max: 64 },
      { name: "table", type: "text", required: true, max: 40 },
      { name: "tiles", type: "json", maxSize: 1000 },
      { name: "sum", type: "number", onlyInt: true },
      { name: "open", type: "bool" },
    ],
    indexes: ["CREATE INDEX idx_hands_table ON hands (`table`)"],
  }))

  // شات الترابيزة
  app.save(new Collection({
    type: "base", name: "tablechat",
    listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: null, deleteRule: null,
    fields: [
      { name: "table", type: "text", required: true, max: 40 },
      { name: "uid", type: "text", max: 64 },
      { name: "name", type: "text", max: 30 },
      { name: "text", type: "text", required: true, max: 120 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_tablechat_table ON tablechat (`table`, created)"],
  }))

  // ترتيب الأسبوع: id = board_uid (board = quiz | ludo | snakes | domino)
  app.save(new Collection({
    type: "base", name: "scores",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      idField(100),
      { name: "board", type: "text", required: true, max: 10 },
      { name: "uid", type: "text", max: 64 },
      { name: "name", type: "text", max: 30 },
      { name: "week", type: "text", max: 10 },
      { name: "n", type: "number", onlyInt: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_scores_board_week ON scores (board, week)"],
  }))

  // مسابقة كيمت: id = رقم الغرفة
  app.save(new Collection({
    type: "base", name: "quiz",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      idField(40),
      { name: "state", type: "json", maxSize: 5000 },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  }))
}, (app) => {
  for (const n of ["quiz", "scores", "tablechat", "hands", "tables", "coinlog", "wallets"]) {
    try { app.delete(app.findCollectionByNameOrId(n)) } catch (_) {}
  }
})
