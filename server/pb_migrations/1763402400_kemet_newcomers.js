/// <reference path="../pb_data/types.d.ts" />
// - users.tasks: مهام أول أسبوع اللي العضو خد مكافأتها (مخفية)
// - إشعار جديد welcome: «فلان بيرحّب بيك في كيمت 👋» (من شريط «مين جديد النهارده»)
// - نجم الأسبوع: نحسبه على طول للأسبوع اللي فات (وبعد كده كل اتنين)
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new JSONField({ name: "tasks", maxSize: 2000, hidden: true }))
  app.save(users)
  const n = app.findCollectionByNameOrId("notifications")
  n.fields.getByName("type").values = ["dm", "reply", "mention", "react", "mod", "invite", "welcome"]
  app.save(n)
  try { require(`${__hooks}/starlib.js`).pickStar(app) } catch (err) { console.log("star migration failed: " + err) }
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.removeByName("tasks")
  app.save(users)
  const n = app.findCollectionByNameOrId("notifications")
  n.fields.getByName("type").values = ["dm", "reply", "mention", "react", "mod", "invite"]
  app.save(n)
})
