// 📢 رسائل النظام جوه الغرف: بتتبدّل بالدور، وبتظهر عند كل واحد لوحده (مش بتتبعت ولا بتتسجّل)
// - 📲 حمّل التطبيق: للي فاتح من المتصفح على الموبايل بس (أندرويد: تحميل، آيفون: شرح الشاشة الرئيسية)
// - 🤝 لينك الدعوة (للمسجّلين)، 🔴 لايف شغال (لو فيه)، 🛡 القواعد، 🏺 القبايل، 🎬 المسابقة
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { APK_URL, isIOS, isAndroid, isApk, isStandalone } from '../browser.js'
import { IosGuide } from './InstallPrompt.jsx'
import { useAuth, isGuest } from '../auth.jsx'
import { useLives } from '../live.js'
import { INVITE_COINS } from './Invite.jsx'
import { ar } from '../utils.js'

// الرسايل اللي ممكن تظهر للشخص ده (بالترتيب اللي بتتبدّل بيه)
export function sysNoteTypes(guest) {
  const browser = !isApk() && !isStandalone() && (isAndroid() || isIOS())
  return [browser && 'app', !guest && 'invite', 'live', 'rules', browser && 'app', 'tribes', 'quiz'].filter(Boolean)
}

function Note({ ic, children }) {
  return (
    <div className="sys-msg">
      <span className="sys-ic" aria-hidden="true">{ic}</span>
      <span><span className="sys-chip">📢 رسائل النظام</span>{children}</span>
    </div>
  )
}

export function SysNote({ type }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const lives = useLives()
  const [guide, setGuide] = useState(false)
  if (type === 'app') {
    const ios = isIOS()
    return (
      <Note ic="📲">
        {ios
          ? <>حط شات كيمت على شاشتك الرئيسية وافتحه زي التطبيق — أسرع، وبإشعارات حتى وهو مقفول. <button type="button" className="sys-link" onClick={() => setGuide(true)}>[ إزاي؟ ]</button></>
          : <>حمّل تطبيق شات كيمت واستمتع بدردشة أسهل وأسرع، وإشعارات حتى والتطبيق مقفول. <a className="sys-link" href={APK_URL}>[ تحميل التطبيق ]</a></>}
        {guide && createPortal(<IosGuide onClose={() => setGuide(false)} />, document.body)}
      </Note>
    )
  }
  if (type === 'invite') {
    if (!user || isGuest(user, profile)) return null
    const link = `${window.location.origin}${import.meta.env.BASE_URL}?ref=${user.uid}`
    const text = `تعالى دردش معايا على شات كيمت 👑 شات مصري ببلاش:\n${link}`
    const share = () => (navigator.share ? navigator.share({ title: 'شات كيمت', text }).catch(() => {}) : window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'))
    return <Note ic="🤝">ادعي صحابك لشات كيمت وخد {ar(INVITE_COINS)} كوين على كل واحد يسجّل ويتكلم. <button type="button" className="sys-link" onClick={share}>[ لينك الدعوة ]</button></Note>
  }
  if (type === 'live') {
    const l = (lives || [])[0]
    if (!l) return null
    return <Note ic="🔴">فيه لايف شغال دلوقتي مع {l.hostName} «{l.title}» 🎶 <button type="button" className="sys-link" onClick={() => navigate(`/live/${l.id}`)}>[ اتفرج ]</button></Note>
  }
  if (type === 'rules') return <Note ic="🛡">ممنوع الشتيمة وأرقام التليفونات في الغرف. لو حد ضايقك دوس على اسمه ← بلّغ.</Note>
  if (type === 'tribes') return <Note ic="🏺">انضم لقبيلتك وكسّبها نقط بالكلام والألعاب، والقبيلة الأولى كل أسبوع أعضاؤها بياخدوا كوينز. <button type="button" className="sys-link" onClick={() => navigate('/tribes')}>[ القبايل ]</button></Note>
  if (type === 'quiz') return <Note ic="🎬">مسابقة كيمت بتبدأ لوحدها كل ساعة في أكتر غرفة فيها ناس — خليك موجود وكسّب ألقاب ☥</Note>
  return null
}
