// VIP: الأسعار والأسامي (نفس اللي في src/vip.js)
const VIP_PRICES = [1000, 2000, 3500, 5000, 8000, 12000]
const VIP_NAMES = ["الكاتب", "الكاهن", "القائد", "الوزير", "الأمير", "الفرعون"]
const VIP_DAYS = 30
const DAY = 86400000

// مستوى العضو دلوقتي (٠ = مش VIP أو خلص)
function level(app, uid) {
  try {
    const r = app.findRecordById("vips", uid)
    return r.getInt("until") > Date.now() ? r.getInt("level") : 0
  } catch (_) { return 0 }
}

module.exports = { VIP_PRICES, VIP_NAMES, VIP_DAYS, DAY, level }
