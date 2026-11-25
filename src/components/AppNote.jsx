// 📢 رسائل النظام: «حمّل تطبيق شات كيمت» — بتظهر بس للي فاتح من المتصفح على الموبايل
// أندرويد: لينك تحميل التطبيق على طول. آيفون: شرح «حط الشات على شاشتك الرئيسية»
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { APK_URL, isIOS } from '../browser.js'
import { IosGuide } from './InstallPrompt.jsx'

export function AppNote() {
  const [guide, setGuide] = useState(false)
  const ios = isIOS()
  return (
    <div className="sys-msg">
      <span className="sys-ic" aria-hidden="true">📲</span>
      <span>
        <span className="sys-chip">📢 رسائل النظام</span>
        {ios
          ? <>حط شات كيمت على شاشتك الرئيسية وافتحه زي التطبيق — أسرع، وبإشعارات حتى وهو مقفول. <button type="button" className="sys-link" onClick={() => setGuide(true)}>[ إزاي؟ ]</button></>
          : <>حمّل تطبيق شات كيمت واستمتع بدردشة أسهل وأسرع، وإشعارات حتى والتطبيق مقفول. <a className="sys-link" href={APK_URL}>[ تحميل التطبيق ]</a></>}
      </span>
      {guide && createPortal(<IosGuide onClose={() => setGuide(false)} />, document.body)}
    </div>
  )
}
