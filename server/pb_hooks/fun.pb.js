/// <reference path="../pb_data/types.d.ts" />
// صندوق الكنز، الهرم، ملك الغرفة، الخريطة الحية (الحسابات في funlib.js)

// افتح صندوق الكنز: أول واحد بس ياخده
routerAdd("POST", "/api/kemet/chest/claim", (e) => {
  const F = require(`${__hooks}/funlib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  const lib = require(`${__hooks}/lib.js`)
  const me = e.auth
  if (!me.getString("name")) lib.forbid("كمّل بياناتك الأول")
  if (lib.appBanned(e.app, me.id)) lib.forbid("حسابك محظور")
  const id = String((e.requestInfo().body || {}).id || "")
  let out = null
  e.app.runInTransaction((tx) => {
    let c
    try { c = tx.findRecordById("chests", id) } catch (_) { lib.fail("الصندوق مش موجود") }
    if (c.getString("winner")) { out = { won: false, winnerName: c.getString("winnerName"), coins: c.getInt("coins") }; return }
    if (Date.now() > c.getInt("until")) { out = { won: false, late: true }; return }
    if (lib.restricted(tx, c.getString("room"), me.id)) lib.forbid()
    c.set("winner", me.id); c.set("winnerName", me.getString("name"))
    tx.save(c)
    g.addCoins(tx, me.id, c.getInt("coins"), "chest", "💰 صندوق الكنز")
    out = { won: true, coins: c.getInt("coins"), room: c.getString("room") }
  })
  if (out.won) F.roomNote(e.app, out.room, "💰 " + me.getString("name") + " لقى صندوق الكنز وخد " + out.coins + " كوين! 🎉")
  return e.json(200, out)
}, $apis.requireAuth("users"))

cronAdd("kemetChest", "* * * * *", () => {
  try {
    const c = require(`${__hooks}/funlib.js`).maybeChest($app, false)
    if (c) console.log("chest in " + c.getString("room") + ": " + c.getInt("coins"))
  } catch (err) { console.log("chest failed: " + err) }
})
// الأدمن يرمي صندوق دلوقتي (للتجربة أو لحدث)
routerAdd("POST", "/api/kemet/chest/drop", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (!lib.isAdmin(e.app, e.auth.id)) lib.forbid("للأدمن بس")
  const c = require(`${__hooks}/funlib.js`).maybeChest(e.app, true)
  if (!c) lib.fail("مفيش غرفة فيها ٢ متصلين دلوقتي، أو فيه صندوق مفتوح")
  return e.json(200, { room: c.getString("room"), coins: c.getInt("coins") })
}, $apis.requireAuth("users"))

// الهرم
routerAdd("GET", "/api/kemet/pyramid", (e) => {
  const F = require(`${__hooks}/funlib.js`)
  const p = F.pyramid(e.app)
  return e.json(200, { stones: p.n, goal: p.d.goal, done: !!p.d.done, week: p.d.week, coins: F.PYRAMID_COINS, min: F.PYRAMID_MIN })
}, $apis.requireAuth("users"))
cronAdd("kemetPyramid", "33 * * * *", () => {
  try {
    const d = require(`${__hooks}/funlib.js`).checkPyramid($app)
    if (d) console.log("pyramid done! paid " + d.paid)
  } catch (err) { console.log("pyramid failed: " + err) }
})

// ملك الغرفة
routerAdd("GET", "/api/kemet/roomking", (e) => {
  const room = String(e.request.url.query().get("room") || "")
  return e.json(200, require(`${__hooks}/funlib.js`).roomKing(e.app, room) || {})
}, $apis.requireAuth("users"))

// الخريطة الحية
routerAdd("GET", "/api/kemet/livemap", (e) => e.json(200, require(`${__hooks}/funlib.js`).liveMap(e.app)), $apis.requireAuth("users"))
