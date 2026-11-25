// 🎯 أمنية الغرفة: كل غرفة (كتابة أو صوتية) ليها هدف هدايا كل يوم (بتوقيت مصر)
// ٣ مستويات في اليوم. لما المستوى يكمل: كل الموجودين في الغرفة دلوقتي بياخدوا كوينز
const GOALS = [1000, 2000, 3000]
const REWARD = [15, 25, 40]
const MAX_PEOPLE = 40
const iso = (ms) => new Date(ms).toISOString().replace("T", " ")
function day() { return new Date(Date.now() + 2 * 3600000).toISOString().slice(0, 10) }
function state(app, room) {
  let r = null
  try { r = app.findRecordById("wishes", room) } catch (_) {}
  const d = day()
  if (!r || r.getString("day") !== d) return { day: d, n: 0, level: 0, goal: GOALS[0], reward: REWARD[0], max: GOALS.length, rec: r }
  const level = r.getInt("level")
  return { day: d, n: r.getInt("n"), level, goal: GOALS[level] || 0, reward: REWARD[level] || 0, max: GOALS.length, rec: r,
    doneAt: r.getInt("doneAt"), doneN: r.getInt("doneN"), doneCoins: r.getInt("doneCoins") }
}
// الموجودين في الغرفة دلوقتي
function present(app, room, kind) {
  const ids = {}
  if (kind === "voice") {
    try { const V = require(`${__hooks}/voicelib.js`); for (const p of V.participants(room) || []) ids[p] = true } catch (_) {}
    try {
      const s = require(`${__hooks}/lib.js`).readJSON(app.findRecordById("voice", room), "seats") || {}
      for (const x of [...(s.center || []), ...(s.ring || [])]) if (x && x.uid) ids[x.uid] = true
    } catch (_) {}
  } else {
    const rows = arrayOf(new DynamicModel({ id: "" }))
    app.db().newQuery("SELECT id FROM presence WHERE room = {:r} AND roomAt >= {:c} LIMIT 200").bind({ r: room, c: iso(Date.now() - 5 * 60000) }).all(rows)
    for (const x of rows) ids[x.id] = true
  }
  delete ids.kemetbot; delete ids.nefertari
  return Object.keys(ids).slice(0, MAX_PEOPLE)
}
// هدية اتبعتت: بنزوّد الأمنية، ولو كملت بنوزّع
function add(app, room, kind, price) {
  if (kind !== "voice" && kind !== "room") return null
  const g = require(`${__hooks}/gamelib.js`)
  let done = null
  // لو الهدية دي هتكمّل المستوى: بنجيب الموجودين برّه الـ transaction (ممكن يكون فيه طلب لسيرفر الصوت)
  const s0 = state(app, room)
  const ppl = s0.level < GOALS.length && s0.n + price >= GOALS[s0.level] ? present(app, room, kind) : []
  app.runInTransaction((tx) => {
    const s = state(tx, room)
    if (s.level >= GOALS.length) return
    let r = s.rec
    if (!r) { r = new Record(tx.findCollectionByNameOrId("wishes")); r.set("id", room) }
    let n = s.n + price
    let level = s.level
    if (n >= GOALS[level]) {
      const coins = REWARD[level]
      for (const uid of ppl) { try { tx.findRecordById("users", uid); g.addCoins(tx, uid, coins, "wish", "🎯 أمنية الغرفة اتحققت") } catch (_) {} }
      done = { level: level + 1, coins, people: ppl.length }
      level += 1; n = 0
      r.set("doneAt", Date.now()); r.set("doneN", ppl.length); r.set("doneCoins", coins)
    }
    r.set("day", s.day); r.set("n", n); r.set("level", level)
    tx.save(r)
  })
  if (done && kind === "room") {
    try {
      const F = require(`${__hooks}/funlib.js`)
      F.roomNote(app, room, `🎯 أمنية الغرفة (المستوى ${done.level}) اتحققت! 🎉 كل الموجودين (${done.people}) خدوا ${done.coins} كوين 🪙` + (done.level < GOALS.length ? "\nالمستوى الجاي اتفتح، يلا نكمّله 💪" : "\nخلّصتوا أماني النهارده كلها 👑"))
    } catch (_) {}
  }
  return done
}
// الهدايا اللي جات لكل واحد في الغرفة النهارده (بالكوينز)
function received(app, room) {
  const start = Date.parse(day() + "T00:00:00Z") - 2 * 3600000
  const rows = arrayOf(new DynamicModel({ to: "", n: 0 }))
  app.db().newQuery("SELECT [[to]] AS [[to]], SUM(price) AS n FROM gifts WHERE room = {:r} AND created >= {:a} GROUP BY [[to]]").bind({ r: room, a: iso(start) }).all(rows)
  const out = {}
  for (const x of rows) out[x.to] = x.n
  return out
}
module.exports = { GOALS, REWARD, day, state, present, add, received }
