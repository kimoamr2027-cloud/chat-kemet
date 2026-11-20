/// <reference path="../pb_data/types.d.ts" />
// الزوار: بيدخلوا من غير تسجيل (اسم فرعوني بيتختار لهم)
// - users.guest: زائر ولا مسجّل (السيرفر بس اللي بيحدده من Firebase)
// - users.welcomed: اتبعتله رسالة الترحيب في الخاص
// - حساب «شات كيمت» (kemetbot) اللي بيبعت رسالة الترحيب
// - نوع رسالة جديد في الخاص: signup (فيها زراير التسجيل)
// - إعداد خصوصية جديد للخاص: members (المسجّلين بس، من غير الزوار)
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new BoolField({ name: "guest" }))
  users.fields.add(new BoolField({ name: "welcomed" }))
  app.save(users)

  const dms = app.findCollectionByNameOrId("dms")
  const kind = dms.fields.getByName("kind")
  kind.values = ["text", "sticker", "image", "voice", "ludo", "snakes", "domino", "signup"]
  app.save(dms)

  const st = app.findCollectionByNameOrId("settings")
  const who = st.fields.getByName("dmWho")
  who.values = ["all", "rooms", "members", "none"]
  app.save(st)

  let bot
  try { bot = app.findRecordById("users", "kemetbot") } catch (_) {
    bot = new Record(users)
    bot.set("id", "kemetbot")
    bot.set("email", "kemetbot@users.kemet.local")
    bot.set("emailVisibility", false)
    bot.set("verified", true)
    bot.setPassword($security.randomString(40))
  }
  bot.set("name", "شات كيمت")
  bot.set("rooms", [])
  app.save(bot)
}, (app) => {
  try { app.delete(app.findRecordById("users", "kemetbot")) } catch (_) {}
  const users = app.findCollectionByNameOrId("users")
  users.fields.removeByName("guest"); users.fields.removeByName("welcomed")
  app.save(users)
})
