/// <reference path="../pb_data/types.d.ts" />
// 🏛 الميدان: بوستات الأعضاء (كلام + صورة)، لايكات، كومنتات، وتحدي الأسبوع
migrate((app) => {
  const AUTH = "@request.auth.id != ''"
  app.save(new Collection({
    type: "base", name: "posts",
    // الإضافة بتعدّي على hook بيتأكد من كل حاجة، والتعديل والمسح من الـ API بتاعنا بس
    listRule: AUTH + " && hidden = false", viewRule: AUTH + " && hidden = false", createRule: AUTH, updateRule: null, deleteRule: null,
    fields: [
      { name: "uid", type: "text", max: 64 },
      { name: "name", type: "text", max: 30 },
      { name: "text", type: "text", max: 600 },
      { name: "image", type: "file", maxSelect: 1, maxSize: 3 * 1024 * 1024, mimeTypes: ["image/jpeg", "image/png", "image/webp"], thumbs: ["480x0"] },
      { name: "w", type: "number", onlyInt: true },
      { name: "h", type: "number", onlyInt: true },
      { name: "tag", type: "text", max: 20 },
      { name: "likes", type: "number", onlyInt: true },
      { name: "comments", type: "number", onlyInt: true },
      { name: "hidden", type: "bool" },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_posts_created ON posts (created)", "CREATE INDEX idx_posts_tag ON posts (tag, likes)", "CREATE INDEX idx_posts_uid ON posts (uid, created)"],
  }))
  app.save(new Collection({
    type: "base", name: "postlikes",
    listRule: "@request.auth.id = uid", viewRule: "@request.auth.id = uid", createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "id", type: "text", primaryKey: true, system: true, required: true, min: 1, max: 80, pattern: "^[A-Za-z0-9_-]+$", autogeneratePattern: "[a-z0-9]{15}" },
      { name: "post", type: "text", max: 40 },
      { name: "uid", type: "text", max: 64 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_postlikes_post ON postlikes (post)", "CREATE INDEX idx_postlikes_uid ON postlikes (uid, created)"],
  }))
  app.save(new Collection({
    type: "base", name: "postcomments",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "post", type: "text", max: 40 },
      { name: "uid", type: "text", max: 64 },
      { name: "name", type: "text", max: 30 },
      { name: "text", type: "text", max: 300 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_postcomments_post ON postcomments (post, created)"],
  }))
  const n = app.findCollectionByNameOrId("notifications")
  const f = n.fields.getByName("type")
  const vals = [].concat(f.values)
  for (const v of ["plike", "pcomment", "pwin"]) if (vals.indexOf(v) < 0) vals.push(v)
  f.values = vals
  app.save(n)
}, (app) => {
  for (const c of ["posts", "postlikes", "postcomments"]) { try { app.delete(app.findCollectionByNameOrId(c)) } catch (_) {} }
})
