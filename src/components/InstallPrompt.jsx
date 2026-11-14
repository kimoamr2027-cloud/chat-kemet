import { useEffect, useState } from 'react'
import {
  isAndroid, isIOS, isApk, isStandalone, APK_URL, getInstallEvent, onInstallEvent, clearInstallEvent,
} from '../browser.js'
import { Sheet } from './ui.jsx'

// "نزّل الشات كتطبيق" — سطر صغير في الإعدادات (للآيفون والأندرويد بس)

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
export const DownloadIcon = ({ size = 20 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" />
  </svg>
)

export default function InstallRow({ showToast }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState(getInstallEvent())
  useEffect(() => onInstallEvent(setPrompt), [])

  const ios = isIOS()
  const android = isAndroid()
  if ((!ios && !android) || isStandalone() || isApk()) return null
  const iosNotSafari = ios && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent)

  async function tap() {
    // أندرويد Chrome: تثبيت بدوسة واحدة
    if (android && prompt) {
      prompt.prompt()
      const res = await prompt.userChoice.catch(() => null)
      clearInstallEvent(); setPrompt(null)
      if (res?.outcome === 'accepted') showToast?.('اتسطّب ✓ هتلاقيه على الشاشة الرئيسية')
      return
    }
    setOpen(true)
  }

  return (
    <>
      <button type="button" className="set-row set-btn install-row" onClick={tap}>
        <span className="install-ic"><DownloadIcon size={18} /></span>
        <span className="set-label">نزّل الشات كتطبيق<small>{ios ? 'على الآيفون' : 'على الأندرويد'}</small></span>
      </button>

      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">📲 نزّل شات كيمت كتطبيق</h2>
          {ios && iosNotSafari && <p className="install-note">افتح اللينك ده في <b>Safari</b> الأول، وبعدين اتبع الخطوات.</p>}
          {ios && (
            <ol className="install-steps">
              <li><span className="step-n">١</span>دوس على زرار المشاركة <span className="step-ic"><ShareIcon /></span> تحت</li>
              <li><span className="step-n">٢</span>اختار <b>«إضافة إلى الشاشة الرئيسية»</b> <span className="step-ic"><AddIcon /></span></li>
              <li><span className="step-n">٣</span>دوس <b>«إضافة»</b> فوق</li>
            </ol>
          )}
          {android && (
            <>
              <ol className="install-steps">
                <li><span className="step-n">١</span>دوس على <span className="step-ic"><DotsIcon /></span> قايمة المتصفح</li>
                <li><span className="step-n">٢</span>اختار <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b></li>
              </ol>
              <a href={APK_URL} className="btn-outline install-apk-btn"><DownloadIcon />أو حمّل ملف APK</a>
            </>
          )}
          <button type="button" className="install-later" onClick={() => setOpen(false)}>تمام</button>
        </Sheet>
      )}
    </>
  )
}
