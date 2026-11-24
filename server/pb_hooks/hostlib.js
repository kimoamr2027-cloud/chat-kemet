// «نفرتاري 🤖» مضيفة كيمت: بوت معروف إنه بوت (شارة «بوت» جنب اسمها)
// بترحّب بالجداد في الخاص، وبترد على الأسئلة البسيطة بردود جاهزة. مابتدّعيش إنها إنسانة، ومابتتكلمش كلام عاطفي.
const HOST = "nefertari"
const lib = require(`${__hooks}/lib.js`)

const norm = (s) => String(s || "").toLowerCase()
  .replace(/[ً-ٰٟـ]/g, "")
  .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")

// أكتر غرفة فيها ناس دلوقتي (ظاهرة)
function busiest(app) {
  try {
    const cut = new Date(Date.now() - 5 * 60000).toISOString().replace("T", " ")
    const rows = arrayOf(new DynamicModel({ room: "", n: 0 }))
    app.db().newQuery("SELECT room, COUNT(*) AS n FROM presence WHERE room != '' AND roomAt >= {:c} AND id != {:h} GROUP BY room ORDER BY n DESC LIMIT 5").bind({ c: cut, h: HOST }).all(rows)
    for (const r of rows) {
      try { const room = app.findRecordById("rooms", r.room); if (!room.getBool("hidden")) return { id: r.room, name: room.getString("name"), n: r.n } } catch (_) {}
    }
  } catch (_) {}
  return null
}
function onlineCount(app) {
  try { return app.countRecords("presence", $dbx.exp("at >= {:c} AND id != {:h}", { c: new Date(Date.now() - 5 * 60000).toISOString().replace("T", " "), h: HOST })) } catch (_) { return 0 }
}
function roomLine(app) {
  const b = busiest(app)
  return b ? "🔥 أكتر غرفة فيها ناس دلوقتي: «" + b.name + "» (" + b.n + " موجودين) — ادخلها من صفحة الغرف وسلّم عليهم 👋"
    : "🏛 ادخل «غرفة الأهرامات» من صفحة الغرف، دي الغرفة الرئيسية"
}

// الرد على سؤال (أول مجموعة كلمات تطابق)
function replyFor(app, text, name) {
  const t = norm(text)
  const has = (...w) => w.some((x) => t.indexOf(x) >= 0)
  if (has("بحبك", "حبيبتي", "حبيبي", "ارتبط", "تتجوز", "رقمك", "نمرتك", "واتس", "صورتك", "صورك", "نتعرف", "قمر", "عسل", "جميله", "حلوه", "بوسه"))
    return "أنا بوت 🤖 مساعدة الشات بس — ماليش رقم ولا صور 😄\nلو عايز تتعرف على ناس حقيقيين، افتح خانة «👥 المتصلين» تحت، فيها " + onlineCount(app) + " متصلين دلوقتي."
  if (has("انتي مين", "انت مين", "مين انتي", "مين انت", "بوت", "حقيقي", "انسان", "بني ادم", "روبوت"))
    return "أنا نفرتاري 🤖 بوت بيساعد الناس في شات كيمت — مش إنسانة. بفهم أسئلة بسيطة: الكوينز، الألعاب، التسجيل، الغرف، القبايل، الدعوات، الـ VIP."
  if (has("شكرا", "متشكر", "تسلم", "ميرسي", "مرسي", "thanks"))
    return "العفو يا " + name + " 🌸 لو احتجت حاجة تاني اسألني."
  if (has("ازيك", "عامل ايه", "عامله ايه", "اخبارك", "ايه الاخبار"))
    return "أنا تمام الحمد لله 😊 محتاج مساعدة في حاجة؟ اكتبلي مثلًا: كوينز، ألعاب، غرف."
  if (has("كوين", "نقط", "فلوس", "رصيد", "اشحن", "شحن", "coins"))
    return "🪙 الكوينز بتكسبها من:\n• الألعاب (لودو، دومينو، السلم والتعبان)\n• الغرفة الصوتية (٣٠ دقيقة في اليوم)\n• هدايا التسجيل كل يوم أول أسبوع\n• مهام أول أسبوع في صفحة الغرف\n• دعوة صحابك (٢٠٠ كوين لكل واحد يسجّل)\nوتقدر تشحن من المحفظة في صفحة الألعاب ➕"
  if (has("لعب", "العاب", "لعبه", "لودو", "دومينو", "سلم", "تعبان"))
    return "🎲 الألعاب في الشريط اللي تحت ← «الألعاب»: لودو، دومينو، والسلم والتعبان. تقدر تلعب مع ناس أو ضد الكمبيوتر، والكسبان ياخد كوينز 🏆"
  if (has("مسابق", "اسئله", "سؤال"))
    return "🎬 مسابقة كيمت بتبدأ لوحدها كل ساعة في أكتر غرفة فيها ناس — اكتب الإجابة في الشات وأول واحد يجاوب صح ياخد نقطة وألقاب ☥"
  if (has("سجل", "تسجيل", "حساب", "ايميل", "جوجل", "باسورد"))
    return "📝 علشان تسجّل: الإعدادات ← «سجّل حسابك» (بجوجل أو بالإيميل). اسمك ورسايلك بيفضلوا زي ما هم، وبتاخد ٤٠٠ كوين وتقدر تدخل الغرفة الصوتية وتحط صورة."
  if (has("صوت", "مايك", "صوتيه", "اتكلم", "فويس"))
    return "🎙 الغرفة الصوتية في أول صفحة الغرف (للمسجّلين). ادخل ودوس على أي كرسي فاضي تقعد عليه، وبعدين المايك 🎤"
  if (has("دعو", "لينك", "ادعي", "صحاب", "اصحاب"))
    return "🤝 لينك الدعوة بتاعك في الإعدادات. ابعته لصحابك، ولما حد يسجّل بيه انت وهو تاخدوا ٢٠٠ كوين."
  if (has("قبيل", "قبايل"))
    return "🏺 القبايل: صفحة الغرف ← «القبايل». انضم لقبيلتك وكسّبها نقط بالرسايل والألعاب والدعوات، والقبيلة الأولى كل أسبوع أعضاؤها ياخدوا ١٠٠ كوين."
  if (has("vip", "في اي بي", "فيب"))
    return "👑 الـ VIP من المحفظة (صفحة الألعاب ← الرصيد ← 👑 VIP): ٦ مستويات بالكوينز لمدة ٣٠ يوم، كل واحد بمميزات زي شارة واسم ملوّن وبرواز ودخول ملكي."
  if (has("غرفتي", "اعمل غرفه", "غرفه باسمي"))
    return "🏠 تقدر تعمل غرفتك: صفحة الغرف ← «🏠 غرف الأعضاء» ← «اعمل غرفتك» (للمسجّلين). انت مشرفها وتدعي صحابك."
  if (has("بلاغ", "بلغ", "ضايق", "حظر", "شتيم", "مشرف", "ادمن", "بيضايق"))
    return "🛡 لو حد ضايقك: دوس على اسمه ← «بلّغ» أو «حظر». الأدمن بيراجع البلاغات، والمشرفين يقدروا يكتموه أو يطردوه من الغرفة."
  if (has("صوره", "صور", "بروفايل"))
    return "📷 تحط صورة من «حسابي» تحت ← دوس على الصورة. الصور للأعضاء المسجّلين."
  if (has("غرف", "غرفه", "ادخل", "فين الناس", "مين موجود", "متصل"))
    return roomLine(app) + "\nوخانة «👥 المتصلين» تحت فيها كل اللي أونلاين، تكلّمهم خاص أو تدخل معاهم."
  if (has("اهلا", "سلام", "هاي", "هلو", "مرحب", "صباح", "مسا", "hi", "hello"))
    return "أهلًا بيك يا " + name + " 👋 أنا نفرتاري مساعدة كيمت 🤖\nاسألني عن: الكوينز، الألعاب، التسجيل، الغرف، القبايل، الدعوات."
  return "مش فاهماك أوي 😅 أنا بوت وبفهم أسئلة بسيطة — جرّب تكتب: كوينز، ألعاب، تسجيل، غرف، قبايل، دعوة.\n" + roomLine(app)
}

// رسالة من نفرتاري في الخاص (ومحادثتها بتتحدّث)
function send(app, to, text, kind) {
  const [a, b] = to < HOST ? [to, HOST] : [HOST, to]
  const chatId = a + "_" + b
  app.runInTransaction((tx) => {
    const m = new Record(tx.findCollectionByNameOrId("dms"))
    m.set("chat", chatId); m.set("a", a); m.set("b", b); m.set("uid", HOST); m.set("kind", kind || "text"); m.set("text", String(text).slice(0, 1000))
    m.set("reactions", {}); m.set("edited", false)
    tx.save(m)
    let c
    try { c = tx.findRecordById("chats", chatId) } catch (_) {
      c = new Record(tx.findCollectionByNameOrId("chats")); c.set("id", chatId); c.set("a", a); c.set("b", b)
    }
    const unread = lib.readJSON(c, "unread") || {}
    unread[to] = (unread[to] || 0) + 1
    const active = lib.readJSON(c, "active") || {}
    active[HOST] = true
    c.set("unread", unread); c.set("active", active)
    // الزائر بعتلها «طلب رسايل»: الرد معناه موافقة
    const req = lib.readJSON(c, "req")
    if (req && req.status === "pending") c.set("req", { from: req.from, status: "ok" })
    c.set("last", { uid: HOST, text: String(text).split("\n")[0].slice(0, 100), at: new Date().toISOString(), id: m.id })
    c.set("updatedAt", new DateTime())
    tx.save(c)
  })
}

// ترحيب بالجديد (زائر أو عضو)
function welcome(app, u) {
  const name = u.getString("name")
  if (u.getBool("guest")) {
    send(app, u.id, "أهلًا يا " + name + " 👋 أنا نفرتاري 🤖 مساعدة شات كيمت (بوت مش إنسانة).\nانت داخل كزائر: تقدر تكتب في كل الغرف وتبعت خاص.\n🎁 وخدت ١٠٠ كوين هدية تلعب بيها لودو ودومينو والسلم والتعبان.\n" + roomLine(app) + "\n\nسجّل حسابك ببلاش علشان:\n🪙 تاخد ٤٠٠ كوين كمان وهدايا كل يوم\n🎙 تدخل الغرفة الصوتية\n🔒 ومحدش ياخد اسمك\n\nولو عندك سؤال اكتبهولي هنا 💬", "signup")
  } else {
    send(app, u.id, "أهلًا يا " + name + " 👋 نوّرت كيمت! أنا نفرتاري 🤖 مساعدة الشات (بوت مش إنسانة).\n🎁 خدت ٥٠٠ كوين هدية — العب بيها في صفحة الألعاب.\n" + roomLine(app) + "\n🎯 وفي صفحة الغرف «مهام أول أسبوع» بكوينز زيادة، و🏺 القبايل.\n🤝 ابعت لينك الدعوة من الإعدادات لصحابك وخدوا ٢٠٠ كوين.\n\nلو عندك أي سؤال اكتبهولي هنا 💬")
  }
}

// العضو بعتلها رسالة: ترد (بحد أقصى ٤٠ رد في الساعة لكل عضو)
function answer(app, me, text) {
  const hourAgo = new Date(Date.now() - 3600000).toISOString().replace("T", " ")
  if (app.countRecords("dms", $dbx.exp("uid = {:h} AND (a = {:u} OR b = {:u}) AND created >= {:t}", { h: HOST, u: me.id, t: hourAgo })) >= 40) return
  send(app, me.id, replyFor(app, text, me.getString("name")))
}

module.exports = { HOST, welcome, answer, send, replyFor, busiest }
