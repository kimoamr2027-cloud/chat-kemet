// إرسال إشعار للموبايل (Web Push) — بيتحمّل بـ require
// البعت نفسه بيعمله server/push/send.py (بيحتاج تشفير مش موجود جوه PocketBase)
function dir() { return $os.getenv("KEMET_PUSH_DIR") || "/opt/kemet/push" }
function publicKey() {
  try { return toString($os.readFile(dir() + "/vapid.pub")).trim() } catch (_) { return "" }
}
// payload: { title, body, url, tag }
function send(app, uid, payload) {
  const d = dir()
  let py = d + "/venv/bin/python"
  try { $os.stat(py) } catch (_) { return { sent: 0, skipped: "no sender" } }
  const subs = app.findRecordsByFilter("pushsubs", "owner = {:u}", "-created", 10, 0, { u: uid })
  if (!subs.length) return { sent: 0 }
  const job = {
    subs: subs.map((s) => ({ id: s.id, endpoint: s.getString("endpoint"), keys: JSON.parse(s.getString("keys") || "{}") })),
    payload,
  }
  const f = d + "/job-" + $security.randomString(12) + ".json"
  $os.writeFile(f, JSON.stringify(job), 0o600)
  let out = { sent: 0 }
  try {
    const script = ($os.getenv("KEMET_REPO") || "/opt/kemet/repo") + "/server/push/send.py"
    out = JSON.parse(toString($os.cmd(py, script, f).output()))
    for (const id of out.gone || []) { try { app.delete(app.findRecordById("pushsubs", id)) } catch (_) {} }
  } catch (err) {
    out = { sent: 0, error: String(err).slice(0, 200) }
  }
  try { $os.remove(f) } catch (_) {}
  return out
}
module.exports = { publicKey, send }
