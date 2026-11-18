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
    // اقعد على كرسي: النص للأدمن والمشرفين، والدايرة لأي عضو (لو الكرسي فاضي ومش مقفول)
    const side = b.side === "center" ? "center" : "ring"
    const i = parseInt(b.seat, 10)
    if (!(i >= 0 && i < v.seats[side].length)) lib.fail("كرسي غلط")
    if (side === "center" && !royal) lib.forbid("مجلس العرش للأدمن والمشرفين بس 👑")
    if (side === "ring" && v.seats.locked.indexOf(i) >= 0 && !royal) lib.forbid("الكرسي ده مقفول")
    if (v.seats[side][i] && v.seats[side][i].uid !== me.id) lib.fail("الكرسي ده عليه حد")
    vl.clearSeat(v.seats, me.id)
    v.seats[side][i] = { uid: me.id, name, at: Date.now() }
    delete v.hands[me.id]
    after.push([me.id, !v.muted[me.id]])
  } else if (action === "leave") {
    vl.clearSeat(v.seats, me.id)
    after.push([me.id, false])
  } else if (action === "hand") {
    if (b.up) v.hands[me.id] = { name, at: Date.now() }
    else delete v.hands[me.id]
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
      // يطلّع اللي رافع إيده على أول كرسي فاضي في الدايرة
      const i = v.seats.ring.findIndex((s, k) => !s && v.seats.locked.indexOf(k) < 0)
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
  }
})

// ===== الهدايا =====
// الأسعار هنا (السيرفر) هي اللي بتتحسب، مش اللي في التطبيق
routerAdd("POST", "/api/kemet/voice/gift", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  const PRICES = { rose: 10, heart: 50, lotus: 100, falcon: 250, gem: 500, camel: 1000, horse: 2500, crown: 5000 }
  const NAMES = { rose: "وردة النيل", heart: "قلب الورد", lotus: "زهرة اللوتس", falcon: "صقر حورس", gem: "جوهرة كليوباترا", camel: "قافلة الصحرا", horse: "خيل الفرعون", crown: "تاج الفرعون" }
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
    if (!admin) g.addCoins(tx, me.id, -price, "gift-sent", "هدية " + NAMES[gift] + " لـ " + toName)
    const r = new Record(tx.findCollectionByNameOrId("gifts"))
    r.set("room", room); r.set("gift", gift); r.set("price", price)
    r.set("from", me.id); r.set("fromName", me.getString("name")); r.set("to", to); r.set("toName", toName)
    tx.save(r)
    id = r.id
  })
  return e.json(200, { ok: true, id })
}, $apis.requireAuth("users"))
