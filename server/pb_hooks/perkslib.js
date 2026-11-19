// فقاعات الرسايل والارتباط: الأسعار هنا هي اللي بتتحسب (نفس اللي في src/perks.js)
const BUBBLES = { papyrus: 600, turq: 900, lapis: 1200, gold: 1800, fire: 2500, royal: 4000 }
const BUBBLE_NAMES = { papyrus: "بردي", turq: "فيروز", lapis: "ليل النيل", gold: "دهب", fire: "نار رع", royal: "ملكي" }
const RINGS = [1500, 4000, 9000]
const RING_NAMES = ["خاتم فضة", "خاتم دهب", "خاتم ألماظ"]
const DAY = 86400000
const BUBBLE_DAYS = 30
const PROPOSAL_MS = 2 * DAY // الطلب بيستنى يومين وبعدين بيتلغى والكوينز بترجع

// سجل العضو (ولو مش موجود بيتعمل فاضي)
function rec(tx, uid) {
  try { return tx.findRecordById("perks", uid) } catch (_) {}
  const r = new Record(tx.findCollectionByNameOrId("perks"))
  r.set("id", uid)
  return r
}
function partnerOf(tx, uid) {
  try { return tx.findRecordById("perks", uid).getString("partner") } catch (_) { return "" }
}

module.exports = { BUBBLES, BUBBLE_NAMES, RINGS, RING_NAMES, DAY, BUBBLE_DAYS, PROPOSAL_MS, rec, partnerOf }
