// اكتشاف المتصفحات اللي جوه التطبيقات (فيسبوك، انستجرام، تيك توك...) — جوجل بيمنع الدخول منها
export function inAppBrowser() {
  const ua = navigator.userAgent || ''
  if (/FBAN|FBAV|FB_IAB|FBIOS|Messenger/i.test(ua)) return 'فيسبوك'
  if (/Instagram/i.test(ua)) return 'انستجرام'
  if (/musical_ly|TikTok|BytedanceWebview|trill/i.test(ua)) return 'تيك توك'
  if (/Snapchat/i.test(ua)) return 'سناب شات'
  if (/Line\//i.test(ua)) return 'لاين'
  if (/Twitter/i.test(ua)) return 'تويتر'
  if (/; wv\)/.test(ua) && /Android/i.test(ua)) return 'تطبيق تاني'
  return null
}

export const isAndroid = () => /Android/i.test(navigator.userAgent || '')
export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// لينك يفتح الصفحة في Chrome على أندرويد
export function chromeIntent() {
  const u = new URL(window.location.href)
  return `intent://${u.host}${u.pathname}${u.hash}#Intent;scheme=https;package=com.android.chrome;end`
}

// فاتح من تطبيق الأندرويد (الـ APK)؟
export function isApk() {
  try {
    if (/[?&]source=apk/.test(window.location.search) || (document.referrer || '').startsWith('android-app://com.kemet.chat')) {
      localStorage.setItem('kemet-apk', '1')
    }
    return localStorage.getItem('kemet-apk') === '1'
  } catch { return false }
}
export const APK_URL = 'https://github.com/kimoamr2027-cloud/chat-kemet/releases/latest/download/chat-kemet.apk'

// فاتح كتطبيق (من أيقونة الشاشة الرئيسية)؟
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

// زرار التثبيت بتاع Chrome على أندرويد: لازم يتمسك أول ما الصفحة تفتح
let installEvent = null
const installListeners = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installEvent = e
    installListeners.forEach((f) => f(e))
  })
  window.addEventListener('appinstalled', () => { installEvent = null; installListeners.forEach((f) => f(null)) })
}
export const getInstallEvent = () => installEvent
export function onInstallEvent(f) { installListeners.add(f); return () => installListeners.delete(f) }
export function clearInstallEvent() { installEvent = null }
