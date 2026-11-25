// 🏛 الميدان: تحدي الأسبوع والجوايز والإشعارات
const DAY = 86400000
const POSTS_DAY = 5 // أقصى عدد بوستات في اليوم للعضو
const PRIZES = [500, 300, 150] // المركز الأول والتاني والتالت في التحدي
const MIN_LIKES = 3 // أقل عدد لايكات علشان تكسب
// موضوع التحدي بيتغير كل أسبوع (بالترتيب)
const THEMES = [
  { title: "أحلى صورة فرعونية", e: "🏺" },
  { title: "أكلة مصرية من إيدك", e: "🍲" },
  { title: "الغروب من عندك", e: "🌅" },
  { title: "صورة من بلدك", e: "🏙" },
  { title: "أحلى ضحكة", e: "😄" },
  { title: "حيوانك الأليف", e: "🐱" },
  { title: "مكانك المفضل في مصر", e: "🇪🇬" },
  { title: "ستايلك النهارده", e: "✨" },
]
const iso = (ms) => new Date(ms).toISOString().replace("T", " ")
function weekStart(now) { return require(`${__hooks}/starlib.js`).weekStart(now) }
// التحدي بتاع أسبوع معيّن (start = بداية الأسبوع)
function challengeAt(start) {
  const g = require(`${__hooks}/gamelib.js`)
  const key = "c" + g.weekKey(start + 3 * DAY)
  const n = Math.floor((start + 3 * DAY) / (7 * DAY))
  const t = THEMES[((n % THEMES.length) + THEMES.length) % THEMES.length]
  return { key, title: t.title, e: t.e, tag: "#" + t.title.replace(/\s+/g, "_"), start, end: start + 7 * DAY }
}
function current() { return challengeAt(weekStart()) }
function previous() { return challengeAt(weekStart() - 7 * DAY) }

// الأوائل في تحدي (أكتر لايكات، واحد بس لكل عضو)
function leaders(app, key, n) {
  const rows = arrayOf(new DynamicModel({ id: "", uid: "", name: "", likes: 0 }))
  app.db().newQuery("SELECT id, uid, name, likes FROM posts WHERE tag = {:k} AND hidden = 0 ORDER BY likes DESC, created ASC LIMIT 60").bind({ k: key }).all(rows)
  const seen = {}
  const out = []
  for (const r of rows) {
    if (seen[r.uid]) continue
    seen[r.uid] = true
    out.push({ post: r.id, uid: r.uid, name: r.name, likes: r.likes })
    if (out.length >= n) break
  }
  return out
}

// إشعار في الموقع + على الموبايل
function notify(app, to, type, fromId, fromName, postId, text, id, push) {
  try {
    const st = require(`${__hooks}/lib.js`).settingsOf(app, to)
    if (fromId && st.blocked[fromId]) return
    if (type !== "pwin" && st.notif.mentions === false) return
    let n = null
    if (id) { try { n = app.findRecordById("notifications", id) } catch (_) {} }
    if (!n) { n = new Record(app.findCollectionByNameOrId("notifications")); if (id) n.set("id", id) }
    n.set("owner", to); n.set("type", type); n.set("from", fromId || "nefertari"); n.set("fromName", fromName)
    n.set("text", String(text || "").slice(0, 120)); n.set("roomId", ""); n.set("roomName", ""); n.set("msgId", postId)
    n.set("emoji", ""); n.set("read", false); n.set("at", new DateTime())
    app.save(n)
    if (push) require(`${__hooks}/pushlib.js`).send(app, to, { title: push.title, body: push.body, url: "#/p/" + postId, tag: type + "_" + postId })
  } catch (err) { console.log("square notify: " + err) }
}

// آخر الأسبوع: الجوايز للتحدي اللي خلص (مرة واحدة)
function payPrevious(app) {
  const lib = require(`${__hooks}/lib.js`)
  const g = require(`${__hooks}/gamelib.js`)
  const c = previous()
  let rec = null
  try { rec = app.findRecordById("config", "square") } catch (_) {}
  const d = rec ? lib.readJSON(rec, "data") || {} : {}
  if (d.paid === c.key) return null
  const top = leaders(app, c.key, PRIZES.length).filter((x) => x.likes >= MIN_LIKES)
  app.runInTransaction((tx) => {
    top.forEach((w, i) => {
      w.coins = PRIZES[i]
      g.addCoins(tx, w.uid, PRIZES[i], "square", "🏆 المركز " + (i + 1) + " في تحدي " + c.title)
    })
    if (!rec) { rec = new Record(tx.findCollectionByNameOrId("config")); rec.set("id", "square") }
    rec.set("data", { paid: c.key, last: { key: c.key, title: c.title, e: c.e, tag: c.tag, winners: top } })
    tx.save(rec)
  })
  top.forEach((w, i) => notify(app, w.uid, "pwin", "", "نفرتاري 🤖", w.post, "المركز " + (i + 1) + " — " + w.coins + " كوين", "pwin_" + c.key + "_" + w.uid,
    { title: "🏆 كسبت في تحدي الأسبوع!", body: "المركز " + (i + 1) + " في «" + c.title + "» وخدت " + w.coins + " كوين 🪙" }))
  return top
}
function lastWinners(app) {
  try { return (require(`${__hooks}/lib.js`).readJSON(app.findRecordById("config", "square"), "data") || {}).last || null } catch (_) { return null }
}

function post(app, id) {
  let p = null
  try { p = app.findRecordById("posts", String(id || "")) } catch (_) {}
  if (!p || p.getBool("hidden")) throw new BadRequestError("البوست ده اتمسح")
  return p
}

module.exports = { post, DAY, POSTS_DAY, PRIZES, MIN_LIKES, THEMES, iso, current, previous, challengeAt, leaders, notify, payPrevious, lastWinners }
