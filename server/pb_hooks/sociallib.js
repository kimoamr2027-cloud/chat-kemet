// صاحبك دخل: لما العضو يرجع بعد ما كان مش متصل (أكتر من ١٥ دقيقة)، أصحابه بيوصلهم إشعار
// (مرة كل ٣ ساعات بالكتير لكل صاحب، و٣٠ صاحب بالكتير كل مرة)
function friendOnline(app, uid, name) {
  try {
    const push = require(`${__hooks}/pushlib.js`)
    const list = app.findRecordsByFilter("friends", "(a = {:u} || b = {:u}) && status = 'ok'", "-updated", 30, 0, { u: uid })
    for (const f of list) {
      const other = f.getString("a") === uid ? f.getString("b") : f.getString("a")
      let alerts = {}
      try { alerts = JSON.parse(f.getString("alerts") || "{}") || {} } catch (_) {}
      if (Date.now() - (alerts[other] || 0) < 3 * 3600000) continue
      // صاحبك نفسه متصل دلوقتي؟ مش محتاج إشعار
      try { const p = app.findRecordById("presence", other); if (Date.now() - new Date(p.getString("at").replace(" ", "T")).getTime() < 5 * 60000) continue } catch (_) {}
      alerts[other] = Date.now()
      f.set("alerts", alerts); app.save(f)
      try { push.send(app, other, { title: "🟢 " + name + " دخل كيمت", body: "صاحبك متصل دلوقتي — كلّمه خاص", url: "#/dm/" + uid, tag: "online_" + uid }) } catch (_) {}
    }
  } catch (err) { console.log("friend online failed: " + err) }
}

module.exports = { friendOnline }
