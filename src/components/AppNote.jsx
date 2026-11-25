// زراير رسالة الترحيب للزائر في الخاص (تحت زراير التسجيل):
// 📲 تحميل التطبيق (للي فاتح من المتصفح على الموبايل) — 🔴 اتفرج على اللايف (لو فيه) — 🏺 القبايل
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { APK_URL, isIOS, isAndroid, isApk, isStandalone } from '../browser.js'
import { IosGuide } from './InstallPrompt.jsx'
import { useLives } from '../live.js'

export function WelcomeButtons() {
  const navigate = useNavigate()
  const lives = useLives()
  const [guide, setGuide] = useState(false)
  const browser = !isApk() && !isStandalone() && (isAndroid() || isIOS())
  const live = (lives || [])[0]
  const tap = (f) => (e) => { e.stopPropagation(); f() }
  return (
    <span className="su-btns wb-btns" onClick={(e) => e.stopPropagation()}>
      {browser && (isIOS()
        ? <span role="button" tabIndex={0} className="su-btn wb-app" onClick={tap(() => setGuide(true))}>📲 حط الشات على شاشتك الرئيسية</span>
        : <span role="button" tabIndex={0} className="su-btn wb-app" onClick={tap(() => { window.location.href = APK_URL })}>📲 تحميل التطبيق</span>)}
      {live && <span role="button" tabIndex={0} className="su-btn wb-live" onClick={tap(() => navigate(`/live/${live.id}`))}>🔴 اتفرج على لايف {live.hostName}</span>}
      <span role="button" tabIndex={0} className="su-btn wb-tribes" onClick={tap(() => navigate('/tribes'))}>🏺 القبايل</span>
      {guide && createPortal(<IosGuide onClose={() => setGuide(false)} />, document.body)}
    </span>
  )
}
