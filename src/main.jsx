import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'
import { isApk } from './browser.js'
import './diag.js' // سجل الأخطاء
import { rememberInvite } from './components/Invite.jsx'

isApk() // بنسجّل لو التطبيق اتفتح من الـ APK
rememberInvite() // لينك دعوة (?ref=...)

if (!window.__kemetMoving) ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* HashRouter علشان الروابط تشتغل على GitHub Pages من غير مشاكل */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)

if (!window.__kemetMoving && 'serviceWorker' in navigator && import.meta.env.PROD && !import.meta.env.BASE_URL.endsWith('/pb/')) {
  // الموقع الأساسي (GitHub /chat-kemet/ أو الدومين الجديد /) — مش النسخة التجريبية
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  })
  // 🩹 الصفحة فتحت من غير تصميم (ملف الـ CSS ماوصلش — غالبًا نسخة قديمة متخزنة بعد تحديث):
  // نمسح الكاش ونحمّل الصفحة تاني مرة واحدة بس
  window.addEventListener('load', () => {
    setTimeout(() => {
      const styled = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
      if (styled) { try { sessionStorage.removeItem('kemet-heal') } catch { /* مش مهم */ } return }
      try { if (sessionStorage.getItem('kemet-heal')) return; sessionStorage.setItem('kemet-heal', '1') } catch { return }
      Promise.all([
        window.caches ? caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('kemet-v')).map((k) => caches.delete(k)))) : null,
        navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.update().catch(() => {})))),
      ]).catch(() => {}).finally(() => window.location.reload())
    }, 1500)
  })
  // الضغط على إشعار والتطبيق مفتوح: نروح للمحادثة أو الغرفة
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'open' && e.data.url) { const h = new URL(e.data.url).hash; if (h) window.location.hash = h }
  })
}
