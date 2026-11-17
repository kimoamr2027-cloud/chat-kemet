/// <reference path="../pb_data/types.d.ts" />
// المرحلة ٤: الألعاب والكوينز. التطبيق بيبعت "عايز أعمل كذا" والسيرفر بيتأكد وينفّذ

// ===== الكوينز =====
// محفظتي (لو مش موجودة بتتعمل بهدية البداية ٥٠٠)
routerAdd("POST", "/api/kemet/wallet", (e) => {
  const g = require(`${__hooks}/gamelib.js`)
  let coins = 0
  e.app.runInTransaction((tx) => { coins = g.wallet(tx, e.auth.id).getInt("coins") })
  return e.json(200, { coins })
}, $apis.requireAuth("users"))

// مكافأة اليوم (٧ أيام ورا بعض)
routerAdd("POST", "/api/kemet/daily", (e) => {
  const g = require(`${__hooks}/gamelib.js`)
  const lib = require(`${__hooks}/lib.js`)
  let reward = 0
  e.app.runInTransaction((tx) => {
    const w = g.wallet(tx, e.auth.id)
    const today = g.dayNum()
    if (w.getInt("day") === today) lib.fail("خدت مكافأة النهارده")
    const streak = w.getInt("day") === today - 1 ? (w.getInt("streak") % 7) + 1 : 1
    reward = g.DAILY[streak - 1]
    w.set("day", today); w.set("streak", streak)
    tx.save(w)
    g.addCoins(tx, e.auth.id, reward, "daily", "مكافأة اليوم (يوم " + "١٢٣٤٥٦٧"[streak - 1] + ")")
  })
  return e.json(200, { reward })
}, $apis.requireAuth("users"))

// هدية من الأدمن
routerAdd("POST", "/api/kemet/gift", (e) => {
  const g = require(`${__hooks}/gamelib.js`)
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid()
  const b = e.requestInfo().body || {}
  const amount = parseInt(b.amount, 10)
  if (!(amount >= 1 && amount <= 100000)) lib.fail("المبلغ غلط")
  try { e.app.findRecordById("users", String(b.uid || "")) } catch (_) { lib.fail("العضو مش موجود") }
  e.app.runInTransaction((tx) => { g.addCoins(tx, String(b.uid), amount, "gift", "هدية من الأدمن 🎁") })
  return e.json(200, { ok: true })
}, $apis.requireAuth("users"))

// ===== الترابيزات =====
routerAdd("POST", "/api/kemet/game", (e) => {
  const g = require(`${__hooks}/gamelib.js`)
  const lib = require(`${__hooks}/lib.js`)
  const me = e.auth
  const uid = me.id
  const b = e.requestInfo().body || {}
  const action = String(b.action || "")
  if (lib.appBanned(e.app, uid)) lib.forbid("حسابك محظور")
  const admin = lib.isAdmin(e.app, uid)
  const name = me.getString("name")
  if (!name) lib.forbid("كمّل بياناتك الأول")
  let out = { ok: true }

  e.app.runInTransaction((tx) => {
    // ترابيزة جديدة
    if (action === "create") {
      const kind = String(b.kind || "")
      if (["ludo", "snakes", "domino"].indexOf(kind) < 0) lib.fail("لعبة غلط")
      const size = parseInt(b.size, 10)
      if ([2, 3, 4].indexOf(size) < 0) lib.fail("عدد غلط")
      const fee = parseInt(b.fee || 0, 10)
      if (g.FEES.indexOf(fee) < 0) lib.fail("دخولية غلط")
      const mode = kind === "ludo" && ["night", "quick", "luck"].indexOf(b.mode) >= 0 ? b.mode : "classic"
      let room = "", roomName = ""
      if (b.room) { try { roomName = tx.findRecordById("rooms", String(b.room)).getString("name"); room = String(b.room) } catch (_) {} }
      const rec = new Record(tx.findCollectionByNameOrId("tables"))
      rec.set("kind", kind)
      tx.save(rec) // علشان ياخد رقم
      const t = { id: rec.id, kind, host: uid, seats: [uid], status: "waiting", hostName: name, room, roomName, size, names: {}, left: {}, refunded: {}, paid: {}, turn: 0 }
      t.names[uid] = name
      if (kind === "domino") { t.chain = []; t.passes = 0 } else { t.colors = g.colorsFor(size); t.p0 = g.startPos(kind, mode); t.phase = "roll"; t.rollN = 0 }
      if (kind === "ludo" && mode !== "classic") t.mode = mode
      if (fee) {
        t.fee = fee
        if (!admin) { g.addCoins(tx, uid, -fee, "fee", "دخولية ترابيزة " + g.GAME_AR[kind]); t.paid[uid] = true }
      }
      g.save(tx, rec, t)
      out = { id: rec.id }
      return
    }

    const { rec, t } = g.load(tx, b.id)

    if (action === "join") {
      if (t.seats.indexOf(uid) >= 0) return
      if (t.status !== "waiting" || t.seats.length >= t.size) lib.fail("الترابيزة اتملت")
      if (t.fee && !admin) { g.addCoins(tx, uid, -t.fee, "fee", "دخولية ترابيزة " + g.GAME_AR[t.kind]); t.paid[uid] = true }
      const n = t.seats.length
      t.seats.push(uid)
      t.names[uid] = name
      if (t.kind !== "domino") t["p" + n] = g.startPos(t.kind, t.mode)
      if (t.seats.length === t.size) {
        if (t.kind === "domino") g.deal(tx, rec, t)
        else { t.status = "playing"; t.turnAt = Date.now() }
      }
      g.save(tx, rec, t); return
    }

    if (action === "start") {
      if (t.host !== uid || t.status !== "waiting") lib.forbid()
      if (t.seats.length < 2) lib.fail("لازم لاعبين على الأقل")
      t.size = t.seats.length
      if (t.kind === "domino") g.deal(tx, rec, t)
      else { t.colors = g.colorsFor(t.seats.length); t.status = "playing"; t.turnAt = Date.now() }
      g.save(tx, rec, t); return
    }

    if (action === "chat") {
      g.seatOf(t, uid)
      const text = String(b.text || "").trim().slice(0, 120)
      if (!text || !lib.clean(tx, text)) lib.fail("الرسالة غلط")
      const c = new Record(tx.findCollectionByNameOrId("tablechat"))
      c.set("table", t.id); c.set("uid", uid); c.set("name", name); c.set("text", text)
      tx.save(c); return
    }

    if (action === "leave") {
      g.seatOf(t, uid)
      if (t.status === "waiting" && t.host === uid && !t.fee) { tx.delete(rec); return }
      t.left[uid] = true
      if (t.status === "waiting") {
        if (t.host === uid) { t.status = "cancelled"; for (const u of t.seats) g.refund(tx, t, u) }
        else g.refund(tx, t, uid)
      }
      g.save(tx, rec, t); return
    }

    if (action === "close") {
      if (t.host !== uid || t.status === "playing") lib.forbid()
      tx.delete(rec); return
    }

    // الباقيين خرجوا: آخر واحد يكسب
    if (action === "claim") {
      g.seatOf(t, uid)
      if (t.status !== "playing" || t.left[uid] || t.seats.some((u) => u !== uid && !t.left[u])) lib.forbid("لسه فيه لاعبين")
      g.finish(tx, rec, t, uid); return
    }

    // الدور يعدّي: مفيش نقلة، أو صاحب الدور خرج، أو اتأخر
    if (action === "pass") {
      const s = g.seatOf(t, uid)
      if (t.status !== "playing" || t.left[uid]) lib.forbid()
      const cur = t.seats[t.turn]
      const late = Date.now() > (t.turnAt || 0) + g.TURN_MS
      let stuck = false
      if (t.turn === s) {
        if (t.kind === "ludo") stuck = t.phase === "move" && ![0, 1, 2, 3].some((i) => g.canMove(t["p" + s][i], t.dice))
        else if (t.kind === "domino") {
          const h = g.hand(tx, t, uid)
          const tiles = lib.readJSON(h, "tiles") || []
          stuck = !tiles.some((x) => g.sidesFor(x, t.chain).length) && !(t.size < 4 && t.next < 28)
        }
      }
      if (!stuck && !t.left[cur] && !late) lib.forbid("مش وقت تعدية الدور")
      if (t.kind === "domino") {
        t.passes = (t.passes || 0) + 1
        t.last = { seat: t.turn, kind: "pass", at: Date.now() }
        t.turnAt = Date.now()
        if (t.passes >= t.seats.length) {
          // اتقفلت: نكشف نقط الكل، والأقل يكسب (ولو اتعادلوا: اللي قاعد الأول)
          let win = -1, best = 1e9
          t.seats.forEach((u, j) => {
            const sum = g.hand(tx, t, u).getInt("sum")
            t["r" + j] = sum
            if (!t.left[u] && sum < best) { best = sum; win = j }
          })
          t.blockedAt = Date.now()
          t.winnerSeat = win
          g.finish(tx, rec, t, t.seats[win]); return
        }
        t.turn = g.nextSeat(t, t.turn)
      } else {
        t.turn = g.nextSeat(t, t.turn); t.phase = "roll"; t.turnAt = Date.now()
      }
      g.save(tx, rec, t); return
    }

    // ===== لودو والسلم والتعبان =====
    if (action === "roll") {
      g.myTurn(t, uid)
      if (t.kind === "domino" || t.phase !== "roll") lib.fail("مش وقت النرد")
      t.dice = g.rand(6) + 1
      t.rollN = (t.rollN || 0) + 1
      t.phase = "move"
      g.save(tx, rec, t); return
    }
    if (action === "move") {
      const s = g.myTurn(t, uid)
      if (t.phase !== "move") lib.fail("ارمي النرد الأول")
      if (t.kind === "ludo") {
        const piece = parseInt(b.piece, 10)
        if (!(piece >= 0 && piece <= 3) || !g.canMove(t["p" + s][piece], t.dice)) lib.fail("النقلة دي مش مسموحة")
        if (g.ludoMove(t, piece, t.dice)) { g.finish(tx, rec, t, uid); return }
        g.save(tx, rec, t); return
      }
      if (t.kind === "snakes") {
        const from = t["p" + s]
        const to = g.snTo(from, t.dice)
        t["p" + s] = to
        t.last = { seat: s, from, to, dice: t.dice }
        t.phase = "roll"; t.turnAt = Date.now()
        t.turn = to === 100 || t.dice === 6 ? s : g.nextSeat(t, s)
        if (to === 100) { g.finish(tx, rec, t, uid); return }
        g.save(tx, rec, t); return
      }
      lib.fail("لعبة غلط")
    }

    // ===== الدومينو =====
    if (action === "play") {
      const s = g.myTurn(t, uid)
      if (t.kind !== "domino") lib.fail("لعبة غلط")
      const x = parseInt(b.x, 10)
      const side = t.chain.length ? String(b.side) : "R"
      const h = g.hand(tx, t, uid)
      const tiles = lib.readJSON(h, "tiles") || []
      if (tiles.indexOf(x) < 0) lib.fail("الحتة دي مش معاك")
      if (g.sidesFor(x, t.chain).indexOf(side) < 0) lib.fail("الحتة دي ماتنفعش هنا")
      const o = g.orient(x, t.chain, side)
      t.chain = !t.chain.length ? [o] : side === "L" ? [o].concat(t.chain) : t.chain.concat([o])
      h.set("tiles", tiles.filter((y) => y !== x)); h.set("sum", h.getInt("sum") - g.pips(x))
      tx.save(h)
      t["c" + s] = t["c" + s] - 1
      t.passes = 0
      t.turnAt = Date.now()
      t.last = { seat: s, kind: "play", x, o, side, at: Date.now() }
      if (t["c" + s] === 0) { g.finish(tx, rec, t, uid); return }
      t.turn = g.nextSeat(t, s)
      g.save(tx, rec, t); return
    }
    if (action === "draw") {
      const s = g.myTurn(t, uid)
      if (t.kind !== "domino" || t.size >= 4 || t.next >= 28) lib.fail("مفيش سحب")
      const h = g.hand(tx, t, uid)
      const tiles = lib.readJSON(h, "tiles") || []
      if (tiles.some((x) => g.sidesFor(x, t.chain).length)) lib.fail("معاك حتة تنفع")
      const deck = lib.readJSON(rec, "deck") || []
      const x = deck[t.next - t.seats.length * 7]
      h.set("tiles", tiles.concat([x])); h.set("sum", h.getInt("sum") + g.pips(x))
      tx.save(h)
      t.next++
      t["c" + s] = t["c" + s] + 1
      t.last = { seat: s, kind: "draw", at: Date.now() }
      t.turnAt = Date.now()
      out = { x }
      g.save(tx, rec, t); return
    }
    lib.fail("حركة غلط")
  })
  return e.json(200, out)
}, $apis.requireAuth("users"))

// شات الترابيزة: بيتكتب من /api/kemet/game (action=chat) بس
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) throw new ForbiddenError()
  e.next()
}, "tablechat")

// ===== مسابقة كيمت =====
routerAdd("POST", "/api/kemet/quiz", (e) => {
  const g = require(`${__hooks}/gamelib.js`)
  const lib = require(`${__hooks}/lib.js`)
  const uid = e.auth.id
  const b = e.requestInfo().body || {}
  const room = String(b.room || "")
  const action = String(b.action || "")
  try { e.app.findRecordById("rooms", room) } catch (_) { lib.fail("الغرفة مش موجودة") }
  if (lib.appBanned(e.app, uid) || lib.restricted(e.app, room, uid)) lib.forbid()
  const mod = lib.isMod(e.app, room, uid)
  let out = { ok: true }

  e.app.runInTransaction((tx) => {
    let rec = null
    try { rec = tx.findRecordById("quiz", room) } catch (_) {}
    const cur = rec ? lib.readJSON(rec, "state") || {} : null
    const put = (st) => {
      if (!rec) { rec = new Record(tx.findCollectionByNameOrId("quiz")); rec.set("id", room) }
      rec.set("state", st); tx.save(rec)
    }
    // سؤال جديد (المشرف بس): الأسئلة من بنك التطبيق، والإجابات hashes بس
    const round = () => {
      const d = b.data || {}
      const hashes = Array.isArray(d.hashes) ? d.hashes.filter((h) => /^[0-9a-f]{64}$/.test(h)).slice(0, 8) : []
      const n = parseInt(d.round, 10), total = parseInt(d.total, 10)
      if (!hashes.length || !lib.str(d.prompt, 1, 300) || !(total >= 1 && total <= 50) || !(n >= 1 && n <= total)) lib.fail("سؤال غلط")
      return {
        type: String(d.type || "").slice(0, 20), prompt: d.prompt, hint: String(d.hint || "").slice(0, 100), hashes, round: n, total,
        status: "open", startedBy: uid, startedByName: e.auth.getString("name"), roundAt: Date.now(),
        answer: "", winner: "", winnerName: "", solvedAt: null,
      }
    }
    if (action === "start") {
      if (!mod) lib.forbid("المشرف بس اللي يبدأ المسابقة")
      return put(round())
    }
    if (!cur) lib.fail("مفيش مسابقة")
    if (action === "next") {
      if (!mod) lib.forbid()
      if (cur.status === "open" || cur.status === "ended" || parseInt((b.data || {}).round, 10) !== cur.round + 1) { out = { ok: false }; return }
      return put(round())
    }
    if (action === "ended") {
      if (cur.status === "ended" || cur.status === "open" || cur.round !== parseInt(b.round, 10) || cur.round < cur.total) { out = { ok: false }; return }
      cur.status = "ended"
      put(cur); return
    }
    if (action === "stop") {
      if (!mod) lib.forbid()
      cur.status = "ended"
      put(cur); return
    }
    if (action === "end") {
      if (!mod) lib.forbid()
      tx.delete(rec); return
    }
    // الوقت خلص ومحدش جاوب
    if (action === "timeout") {
      if (cur.status !== "open" || cur.round !== parseInt(b.round, 10) || Date.now() < cur.roundAt + g.ROUND_MS - 3000) { out = { ok: false }; return }
      cur.status = "timeout"; cur.answer = String(b.answer || "").slice(0, 100); cur.solvedAt = Date.now()
      put(cur); return
    }
    // إجابة صح: أول واحد ياخد النقطة و٢٠ كوين
    if (action === "answer") {
      if (cur.status !== "open" || (cur.hashes || []).indexOf(String(b.hash)) < 0) { out = { ok: false }; return }
      const name = e.auth.getString("name")
      cur.status = "solved"; cur.winner = uid; cur.winnerName = name; cur.answer = String(b.answer || "").slice(0, 100); cur.solvedAt = Date.now()
      put(cur)
      const week = g.weekKey()
      let sc
      try { sc = tx.findRecordById("scores", "quiz_" + uid) } catch (_) {
        sc = new Record(tx.findCollectionByNameOrId("scores")); sc.set("id", "quiz_" + uid); sc.set("board", "quiz"); sc.set("uid", uid)
      }
      sc.set("n", sc.getString("week") === week ? sc.getInt("n") + 1 : 1); sc.set("week", week); sc.set("name", name)
      tx.save(sc)
      if (!lib.isAdmin(tx, uid)) g.addCoins(tx, uid, g.QUIZ_COINS, "quiz", "إجابة صح في مسابقة كيمت")
      return
    }
    lib.fail("حركة غلط")
  })
  return e.json(200, out)
}, $apis.requireAuth("users"))
