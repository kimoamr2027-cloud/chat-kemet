/// <reference path="../pb_data/types.d.ts" />
// الغرفة الصوتية (الملوك القدماء) — الدايرة:
// النص (مجلس العرش) للأدمن والمشرفين بس، والدايرة اللي برّه للأعضاء
// المشرفين يقدروا ينزّلوا أي عضو من الدايرة أو يكتموه، أو يقفلوا كرسي

// دخول الغرفة: توكن للصوت (بيتكلم بس لو قاعد على كرسي ومش مكتوم)
routerAdd("POST", "/api/kemet/voice/join", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const vl = require(`${__hooks}/voicelib.js`)
  const me = e.auth
  if (!me.getString("name")) lib.forbid("كمّل بياناتك الأول")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  if (!vl.secret() || !vl.publicUrl()) return e.json(503, { message: "الصوت لسه بيتجهّز على السيرفر" })
  const b = e.requestInfo().body || {}
  const v = vl.readRoom(e.app, b.room)
  const seat = vl.seatOf(v.seats, me.id)
  return e.json(200, {
    url: vl.publicUrl(), room: v.rec.id, royal: vl.isRoyal(e.app, me.id),
    token: vl.token(me.id, me.getString("name"), v.rec.id, !!seat && !v.muted[me.id]),
  })
}, $apis.requireAuth("users"))

routerAdd("POST", "/api/kemet/voice/act", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const vl = require(`${__hooks}/voicelib.js`)
  const me = e.auth
  const b = e.requestInfo().body || {}
  const action = String(b.action || "")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  const royal = vl.isRoyal(e.app, me.id)
  const v = vl.readRoom(e.app, b.room)
  const room = v.rec.id
  const name = me.getString("name")
  const target = String(b.uid || "")
  const after = [] // [uid, canPublish] نبلّغ بيه LiveKit بعد الحفظ

  if (action === "sit") {
    // اقعد على كرسي: الأدمن والمشرفين بس. العضو بيطلب كرسي (hand) والأدمن أو المشرف يوافق (invite)
    const side = b.side === "center" ? "center" : "ring"
    const i = parseInt(b.seat, 10)
    if (!(i >= 0 && i < v.seats[side].length)) lib.fail("كرسي غلط")
    if (side === "center" && !royal) lib.forbid("مجلس العرش للأدمن والمشرفين بس 👑")
    // VIP الأمير والفرعون (مستوى ٥ و٦) بيقعدوا من غير موافقة
    if (!royal && require(`${__hooks}/viplib.js`).level(e.app, me.id) < 5) lib.forbid("اطلب الكرسي ✋ والأدمن هيوافق")
    if (!royal && v.seats.locked.indexOf(i) >= 0) lib.forbid("الكرسي ده مقفول")
    if (v.seats[side][i] && v.seats[side][i].uid !== me.id) lib.fail("الكرسي ده عليه حد")
    vl.clearSeat(v.seats, me.id)
    v.seats[side][i] = { uid: me.id, name, at: Date.now() }
    delete v.hands[me.id]
    after.push([me.id, !v.muted[me.id]])
  } else if (action === "leave") {
    vl.clearSeat(v.seats, me.id)
    after.push([me.id, false])
  } else if (action === "hand") {
    // طلب كرسي (ممكن كرسي معيّن)
    if (b.up) {
      const want = parseInt(b.seat, 10)
      v.hands[me.id] = { name, at: Date.now() }
      if (want >= 0 && want < v.seats.ring.length) v.hands[me.id].seat = want
    } else delete v.hands[me.id]
  } else {
    // ===== حاجات المشرفين =====
    if (!royal) lib.forbid("المشرفين بس")
    const isRoyalTarget = target && vl.isRoyal(e.app, target)
    if (action === "kick") {
      // ينزّل حد من الكرسي (المشرف مايقدرش ينزّل الأدمن، بس الأدمن يقدر)
      if (isRoyalTarget && !lib.isAdmin(e.app, me.id)) lib.forbid("مش هتقدر تنزّل مشرف")
      vl.clearSeat(v.seats, target)
      after.push([target, false])
    } else if (action === "mute") {
      if (isRoyalTarget && !lib.isAdmin(e.app, me.id)) lib.forbid("مش هتقدر تكتم مشرف")
      if (b.on) v.muted[target] = true
      else delete v.muted[target]
      after.push([target, !b.on && !!vl.seatOf(v.seats, target)])
    } else if (action === "invite") {
      // يوافق على طلب الكرسي: الكرسي اللي طلبه لو فاضي، وإلا أول كرسي فاضي في الدايرة
      const free = (k) => k >= 0 && k < v.seats.ring.length && !v.seats.ring[k] && v.seats.locked.indexOf(k) < 0
      const ask = v.hands[target] && v.hands[target].seat
      let i = free(parseInt(b.seat, 10)) ? parseInt(b.seat, 10) : free(ask) ? ask : -1
      if (i < 0) i = v.seats.ring.findIndex((s, k) => free(k))
      if (i < 0) lib.fail("مفيش كرسي فاضي")
      let tname = ""
      try { tname = e.app.findRecordById("users", target).getString("name") } catch (_) { lib.fail("العضو مش موجود") }
      vl.clearSeat(v.seats, target)
      v.seats.ring[i] = { uid: target, name: tname, at: Date.now() }
      delete v.hands[target]
      after.push([target, !v.muted[target]])
    } else if (action === "lock") {
      const i = parseInt(b.seat, 10)
      if (!(i >= 0 && i < v.seats.ring.length)) lib.fail("كرسي غلط")
      v.seats.locked = v.seats.locked.filter((x) => x !== i)
      if (b.on) {
        v.seats.locked.push(i)
        const s = v.seats.ring[i]
        if (s) { v.seats.ring[i] = null; after.push([s.uid, false]) }
      }
    } else if (action === "topic") {
      const t = String(b.text || "").trim().slice(0, 120)
      if (t && !lib.clean(e.app, t)) lib.fail("الموضوع فيه كلمة ممنوعة")
      v.rec.set("topic", t)
    } else if (action === "clearhand") {
      delete v.hands[target]
    } else lib.fail("حركة غلط")
  }
  vl.save(e.app, v)
  for (const [uid, on] of after) vl.setPublish(room, uid, on)
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// كل دقيقة: اللي قافل التطبيق ينزل من الكرسي، والإيد المرفوعة القديمة تتشال
cronAdd("kemetVoiceSweep", "* * * * *", () => {
  const vl = require(`${__hooks}/voicelib.js`)
  if (!vl.secret()) return
  for (const rec of $app.findAllRecords("voice")) {
    const here = vl.participants(rec.id)
    if (here === null) continue
    const v = vl.readRoom($app, rec.id)
    let changed = false
    for (const side of ["center", "ring"]) {
      v.seats[side] = v.seats[side].map((s) => {
        if (s && here.indexOf(s.uid) < 0 && Date.now() - (s.at || 0) > 60000) { changed = true; return null }
        return s
      })
    }
    for (const uid in v.hands) if (here.indexOf(uid) < 0) { delete v.hands[uid]; changed = true }
    if (v.rec.getInt("here") !== here.length) { v.rec.set("here", here.length); changed = true }
    if (changed) vl.save($app, v)
    // دقايق الغرفة الصوتية (مكافأة يومية)
    const g = require(`${__hooks}/gamelib.js`)
    const today = g.dayNum()
    for (const uid of here) {
      try {
        $app.runInTransaction((tx) => {
          const w = g.wallet(tx, uid)
          const m = (w.getInt("vday") === today ? w.getInt("vmin") : 0) + 1
          w.set("vday", today); w.set("vmin", m)
          tx.save(w)
          if (m === g.VOICE_MIN) g.addCoins(tx, uid, g.VOICE_COINS, "voice", "قعدت " + g.VOICE_MIN + " دقيقة في الغرفة الصوتية")
        })
      } catch (_) {}
    }
  }
})

// ===== الهدايا =====
// الأسعار هنا (السيرفر) هي اللي بتتحسب، مش اللي في التطبيق
routerAdd("POST", "/api/kemet/voice/gift", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  const PRICES = { heart: 50, ankh: 80, scarab: 100, scale: 150, falcon: 200, cobra: 300, chest: 400, isis: 500, anubis: 700, mask: 900, queen: 1200, chariot: 2000 }
  const NAMES = { heart: "قلب الورد", ankh: "مفتاح الحياة", scarab: "جعران الشمس", scale: "ميزان ماعت", falcon: "صقر حورس", cobra: "كوبرا التاج", chest: "كنز الفرعون", isis: "إيزيس", anubis: "أنوبيس", mask: "قناع الفرعون", queen: "عرش الملكة", chariot: "عربة الفرعون" }
  const me = e.auth
  const b = e.requestInfo().body || {}
  const gift = String(b.gift || "")
  const price = PRICES[gift]
  if (!price) lib.fail("هدية غلط")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  const to = String(b.to || "")
  if (!to || to === me.id) lib.fail("اختار حد تبعتله")
  let toName = ""
  try { toName = e.app.findRecordById("users", to).getString("name") } catch (_) { lib.fail("العضو مش موجود") }
  let room
  try { room = e.app.findRecordById("voice", String(b.room || "")).id } catch (_) { lib.fail("الغرفة مش موجودة") }
  const admin = lib.isAdmin(e.app, me.id)
  let id = ""
  e.app.runInTransaction((tx) => {
    // الأدمن رصيده مفتوح
    if (!admin) {
      g.addCoins(tx, me.id, -price, "gift-sent", "هدية " + NAMES[gift] + " لـ " + toName)
      // اللي استلم الهدية بياخد ٢٠٪ من سعرها
      const back = Math.floor(price * 0.2)
      if (back > 0) g.addCoins(tx, to, back, "gift-got", "هدية " + NAMES[gift] + " من " + me.getString("name"))
    }
    const r = new Record(tx.findCollectionByNameOrId("gifts"))
    r.set("room", room); r.set("gift", gift); r.set("price", price)
    r.set("from", me.id); r.set("fromName", me.getString("name")); r.set("to", to); r.set("toName", toName)
    tx.save(r)
    id = r.id
  })
  return e.json(200, { ok: true, id })
}, $apis.requireAuth("users"))
