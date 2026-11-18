// الغرفة الصوتية: مفاتيح LiveKit والتحكم فيه (بيتحمّل بـ require)
// LiveKit هو برنامج الصوت المباشر اللي شغال على نفس السيرفر
const lib = require(`${__hooks}/lib.js`)

const dir = () => $os.getenv("KEMET_LK_DIR") || "/opt/kemet/livekit"
const apiUrl = () => $os.getenv("KEMET_LK_API") || "http://127.0.0.1:7880"
const KEY = "kemet"
function secret() {
  try { return toString($os.readFile(dir() + "/secret")).trim() } catch (_) { return "" }
}
// العنوان اللي التطبيق بيتصل بيه (wss://الدومين)
function publicUrl() { return $os.getenv("KEMET_LK_PUBLIC") || "" }

// مين يقعد في مجلس العرش ويتحكم: الأدمن وأي مشرف
function isRoyal(app, uid) {
  const r = lib.roles(app)
  if (r.admins.indexOf(uid) >= 0) return true
  for (const k in r.mods) if ((r.mods[k] || []).indexOf(uid) >= 0) return true
  return false
}

function token(uid, name, room, canPublish) {
  return $security.createJWT({
    iss: KEY, sub: uid, name,
    video: { room, roomJoin: true, canPublish: !!canPublish, canSubscribe: true, canPublishData: true },
  }, secret(), 6 * 3600)
}

// نداء على LiveKit (Twirp) — لو مش شغال بنكمّل عادي
function call(method, body) {
  const s = secret()
  if (!s) return null
  const admin = $security.createJWT({ iss: KEY, sub: "kemet-server", video: { roomAdmin: true, roomList: true, room: body.room || "" } }, s, 600)
  try {
    const res = $http.send({
      url: apiUrl() + "/twirp/livekit.RoomService/" + method, method: "POST", timeout: 5,
      body: JSON.stringify(body), headers: { "content-type": "application/json", authorization: "Bearer " + admin },
    })
    return res.statusCode === 200 ? res.json : null
  } catch (_) { return null }
}
// يقدر يتكلم ولا لأ (لما يقعد على كرسي أو يتنزّل أو يتكتم)
function setPublish(room, uid, on) {
  return call("UpdateParticipant", { room, identity: uid, permission: { can_publish: !!on, can_subscribe: true, can_publish_data: true } })
}
function participants(room) {
  const r = call("ListParticipants", { room })
  return r && r.participants ? r.participants.map((p) => p.identity) : null
}

function readRoom(app, id) {
  let rec
  try { rec = app.findRecordById("voice", String(id || "")) } catch (_) { lib.fail("الغرفة مش موجودة") }
  const seats = lib.readJSON(rec, "seats") || { center: [null, null, null], ring: [], locked: [] }
  seats.locked = seats.locked || []
  return { rec, seats, muted: lib.readJSON(rec, "muted") || {}, hands: lib.readJSON(rec, "hands") || {} }
}
function seatOf(seats, uid) {
  for (const side of ["center", "ring"]) {
    const i = seats[side].findIndex((s) => s && s.uid === uid)
    if (i >= 0) return { side, i }
  }
  return null
}
function clearSeat(seats, uid) {
  const s = seatOf(seats, uid)
  if (s) seats[s.side][s.i] = null
  return s
}
function save(app, v) {
  v.rec.set("seats", v.seats); v.rec.set("muted", v.muted); v.rec.set("hands", v.hands)
  app.save(v.rec)
}

module.exports = { secret, publicUrl, isRoyal, token, call, setPublish, participants, readRoom, seatOf, clearSeat, save }
