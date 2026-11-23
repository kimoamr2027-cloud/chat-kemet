/// <reference path="../pb_data/types.d.ts" />
// الزوار: يكتبوا في الغرف ويبعتوا خاص ويلعبوا بالـ١٠٠ كوين اللي خدوها، بس من غير الغرفة الصوتية وهدايا التسجيل اليومية والشحن والهدايا وVIP
routerUse(new Middleware((e) => {
  // (لازم القايمة تبقى جوه: الـ handlers في PocketBase مابتشوفش اللي برّاها)
  const KEMET_GUEST_BLOCKED = [
    "/api/kemet/voice/", "/api/kemet/daily",
    "/api/kemet/vip/buy", "/api/kemet/topup", "/api/kemet/bubble/", "/api/kemet/ring/",
  ]
  const p = e.request.url.path
  if (p.indexOf("/api/kemet/") === 0 && e.auth && e.auth.getBool("guest")) {
    for (const x of KEMET_GUEST_BLOCKED) {
      if (p === x || p.indexOf(x) === 0 && (x.slice(-1) === "/" || p.charAt(x.length) === "/")) {
        throw new ForbiddenError("سجّل حسابك الأول علشان تقدر تستخدم دي")
      }
    }
  }
  return e.next()
}, 100, "kemetGuests"))

// أول ما الزائر يختار اسمه: رسالة ترحيب في الخاص من «شات كيمت» فيها زراير التسجيل
onRecordAfterUpdateSuccess((e) => {
  const r = e.record
  if (!r.getBool("guest") || r.getBool("welcomed") || !r.getString("name")) return e.next()
  try {
    const me = r.id, bot = "kemetbot"
    const [a, b] = me < bot ? [me, bot] : [bot, me]
    const chatId = a + "_" + b
    const text = "أهلًا يا " + r.getString("name") + " 👋 نورت كيمت!\nانت داخل دلوقتي كزائر، تقدر تكتب في كل الغرف وتبعت خاص.\n\n🎁 وخدت ١٠٠ كوين هدية علشان تلعب لودو ودومينو والسلم والتعبان من صفحة الألعاب.\n\nسجّل حسابك ببلاش علشان:\n🪙 تاخد ٤٠٠ كوين كمان وهدايا كل يوم\n🎙 تدخل الغرفة الصوتية\n🔒 ومحدش ياخد اسمك"
    e.app.runInTransaction((tx) => {
      const m = new Record(tx.findCollectionByNameOrId("dms"))
      m.set("chat", chatId); m.set("a", a); m.set("b", b); m.set("uid", bot); m.set("kind", "signup"); m.set("text", text)
      m.set("reactions", {}); m.set("edited", false)
      tx.save(m)
      let c
      try { c = tx.findRecordById("chats", chatId) } catch (_) {
        c = new Record(tx.findCollectionByNameOrId("chats")); c.set("id", chatId); c.set("a", a); c.set("b", b)
      }
      const unread = {}; unread[me] = 1
      const active = {}; active[bot] = true
      c.set("unread", unread); c.set("active", active)
      c.set("last", { uid: bot, text: "أهلًا بيك في كيمت 👋 خدت ١٠٠ كوين هدية 🎁", at: new Date().toISOString(), id: m.id })
      c.set("updatedAt", new DateTime())
      tx.save(c)
      const u = tx.findRecordById("users", me)
      u.set("welcomed", true)
      tx.saveNoValidate(u)
    })
  } catch (err) { console.log("guest welcome failed", err) }
  return e.next()
}, "users")
