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

// أول ما الجديد (زائر أو عضو لسه عامل حساب) يختار اسمه: رسالة ترحيب في الخاص من «نفرتاري 🤖»
onRecordAfterUpdateSuccess((e) => {
  const r = e.record
  if (r.getBool("welcomed") || !r.getString("name") || r.id === "nefertari" || r.id === "kemetbot") return e.next()
  // الأعضاء القدام مابيوصلهمش ترحيب (بس اللي عامل حسابه من أقل من يوم)
  const created = new Date(r.getString("created").replace(" ", "T")).getTime()
  if (!r.getBool("guest") && !(Date.now() - created < 86400000)) return e.next()
  try {
    const u = e.app.findRecordById("users", r.id)
    u.set("welcomed", true)
    e.app.saveNoValidate(u)
    require(`${__hooks}/hostlib.js`).welcome(e.app, u)
  } catch (err) { console.log("welcome failed", err) }
  return e.next()
}, "users")
