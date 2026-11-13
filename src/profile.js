// تخزين مؤقت لبيانات المستخدم على الجهاز لحد ما نربط Firebase في المرحلة الجاية
const KEY = 'kemet-profile'

export function saveProfile(profile) {
  try { localStorage.setItem(KEY, JSON.stringify(profile)) } catch {}
}

export function loadProfile() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null }
}

export function clearProfile() {
  try { localStorage.removeItem(KEY) } catch {}
}
