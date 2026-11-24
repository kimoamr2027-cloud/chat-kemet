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
  // الضغط على إشعار والتطبيق مفتوح: نروح للمحادثة أو الغرفة
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'open' && e.data.url) { const h = new URL(e.data.url).hash; if (h) window.location.hash = h }
  })
}
