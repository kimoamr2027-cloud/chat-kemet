// تفعيل إشعارات الموبايل: سطر في الإعدادات + كارت صغير بيظهر مرة لحد ما العضو يرد
import { useState } from 'react'
import { useAuth } from '../auth.jsx'
import { Switch } from './ui.jsx'
import { logDiag } from '../diag.js'
import { usePushStatus, enablePush, disablePush } from '../push.js'

const HINT = {
  'ios-home': 'على الآيفون: دوس زرار المشاركة ⬆️ وبعدين «إضافة إلى الشاشة الرئيسية»، وافتح الشات من الأيقونة',
  denied: 'الإشعارات مقفولة من إعدادات الموبايل. افتحها من إعدادات المتصفح للموقع ده',
  unsupported: 'المتصفح ده مش بيدعم الإشعارات. جرّب Chrome أو تطبيق الأندرويد',
}
const errText = (e) => {
  if (e?.message === 'denied') return 'رفضت الإشعارات. تقدر تفتحها من إعدادات الموبايل'
  if (e?.message === 'dismissed') return 'لسه ماوافقتش على الإشعارات'
  logDiag('push.enable', e)
  if (e?.step === 'key') return 'السيرفر لسه بيجهّز الإشعارات، جرب كمان شوية'
  return 'مقدرناش نفعّل الإشعارات، جرب تاني'
}

export function PushSetting({ showToast }) {
  const { user } = useAuth()
  const [st, setSt] = usePushStatus()
  const [busy, setBusy] = useState(false)
  if (st === null) return null
  const on = st === 'on'
  const toggle = async () => {
    if (busy || HINT[st]) return HINT[st] && showToast(HINT[st])
    setBusy(true)
    try {
      setSt(on ? await disablePush() : await enablePush(user.uid))
      showToast(on ? 'اتقفلت إشعارات الموبايل' : '🔔 الإشعارات اتفعّلت! هتوصلك حتى والشات مقفول')
    } catch (e) { showToast(errText(e)) }
    setBusy(false)
  }
  return (
    <div className="set-row push-row">
      <span className="set-label">🔔 إشعارات على الموبايل<small>{HINT[st] ? HINT[st] : 'توصلك الرسايل حتى والشات مقفول'}</small></span>
      <Switch on={on} onToggle={toggle} label="إشعارات على الموبايل" />
    </div>
  )
}

const KEY = 'kemet-push-asked'
export function PushPrompt({ showToast }) {
  const { user } = useAuth()
  const [st, setSt] = usePushStatus()
  const [hidden, setHidden] = useState(() => { try { return !!localStorage.getItem(KEY) } catch { return false } })
  const [busy, setBusy] = useState(false)
  // الآيفون من غير أيقونة: كارت «حط الشات على شاشتك» هو اللي بيظهر بداله
  if (hidden || st !== 'off') return null
  const close = () => { try { localStorage.setItem(KEY, '1') } catch {} setHidden(true) }
  const yes = async () => {
    if (st === 'ios-home') return showToast(HINT['ios-home'])
    setBusy(true)
    try { setSt(await enablePush(user.uid)); showToast('🔔 الإشعارات اتفعّلت!'); close() } catch (e) { showToast(errText(e)); if (e?.message === 'denied') close() }
    setBusy(false)
  }
  return (
    <div className="push-card">
      <span className="push-ic">🔔</span>
      <div className="push-b">
        <b>فعّل الإشعارات</b>
        <small>{st === 'ios-home' ? 'ضيف الشات للشاشة الرئيسية الأول علشان الإشعارات توصلك' : 'علشان توصلك الرسايل الخاصة والردود حتى والشات مقفول'}</small>
      </div>
      <button type="button" className="pill-btn pill-gold" disabled={busy} onClick={yes}>{st === 'ios-home' ? 'إزاي؟' : 'فعّل'}</button>
      <button type="button" className="push-x" aria-label="مش دلوقتي" onClick={close}>✕</button>
    </div>
  )
}
