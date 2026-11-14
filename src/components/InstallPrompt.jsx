import { useEffect, useState } from 'react'
import { isAndroid, isIOS, isApk, inAppBrowser, APK_URL } from '../browser.js'
import { Close } from './Icons.jsx'
import pyramids from '../assets/pyramids.png'

// رسالة "نزّل شات كيمت كتطبيق" — بتظهر بس لو فاتح من المتصفح على موبايل
const KEY = 'kemet-install-hidden-until'

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

// زرار التثبيت بتاع Chrome على أندرويد (بيتمسك أول ما الصفحة تفتح)
let deferred = null
const listeners = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    listeners.forEach((f) => f(e))
  })
}

function hiddenNow() {
  try { return Date.now() < Number(localStorage.getItem(KEY) || 0) } catch { return false }
}
function hideFor(days) {
  try { localStorage.setItem(KEY, String(Date.now() + days * 86400000)) } catch {}
}

const ShareIcon = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15V3M8 7l4-4 4 4" /><path d="M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
  </svg>
)
const AddIcon = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" />
  </svg>
)
const DotsIcon = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
  </svg>
)

export default function InstallPrompt({ force }) {
  const [show, setShow] = useState(false)
  const [prompt, setPrompt] = useState(deferred)

  const ios = isIOS()
  const android = isAndroid()
  const iosNotSafari = ios && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent)

  useEffect(() => {
    const f = (e) => setPrompt(e)
    listeners.add(f)
    return () => listeners.delete(f)
  }, [])

  useEffect(() => {
    if (!force && ((!ios && !android) || isStandalone() || isApk() || inAppBrowser() || hiddenNow())) return
    const t = setTimeout(() => setShow(true), force ? 0 : 3000)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null

  const close = (days) => { hideFor(days); setShow(false) }

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const res = await prompt.userChoice.catch(() => null)
    deferred = null
    setPrompt(null)
    if (res?.outcome === 'accepted') close(365)
  }

  return (
    <div className="install" role="dialog" aria-label="نزّل شات كيمت كتطبيق">
      <button type="button" className="install-x" aria-label="إغلاق" onClick={() => close(7)}><Close size={16} /></button>
      <div className="install-head">
        <img src={pyramids} alt="" className="install-icon" />
        <div>
          <b>نزّل شات كيمت كتطبيق 📲</b>
          <span>يفتح ملء الشاشة من أيقونة على موبايلك، زي أي تطبيق</span>
        </div>
      </div>

      {ios && iosNotSafari && (
        <p className="install-note">افتح اللينك ده في <b>Safari</b> الأول، وبعدين اتبع الخطوات.</p>
      )}

      {ios && (
        <ol className="install-steps">
          <li><span className="step-n">١</span>دوس على زرار المشاركة <span className="step-ic"><ShareIcon /></span> تحت</li>
          <li><span className="step-n">٢</span>اختار <b>«إضافة إلى الشاشة الرئيسية»</b> <span className="step-ic"><AddIcon /></span></li>
          <li><span className="step-n">٣</span>دوس <b>«إضافة»</b> فوق</li>
        </ol>
      )}

      {android && prompt && (
        <button type="button" className="btn-primary install-btn" onClick={install}>تثبيت التطبيق</button>
      )}

      {android && !prompt && (
        <ol className="install-steps">
          <li><span className="step-n">١</span>دوس على <span className="step-ic"><DotsIcon /></span> قايمة المتصفح</li>
          <li><span className="step-n">٢</span>اختار <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b></li>
        </ol>
      )}

      {android && (
        <a href={APK_URL} className="install-apk">أو حمّل ملف APK</a>
      )}

      <button type="button" className="install-later" onClick={() => close(7)}>مش دلوقتي</button>
    </div>
  )
}
