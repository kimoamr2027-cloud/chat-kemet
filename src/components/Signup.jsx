// تسجيل الزائر: شيت بيظهر لما يدوس على حاجة للمسجّلين بس (الغرفة الصوتية، الألعاب...) أو من رسالة الترحيب
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Sheet } from './ui.jsx'
import { Google } from './Icons.jsx'
import { useAuth, isGuest, guestToGoogle, guestToEmail, signupErrorText } from '../auth.jsx'

export function useIsGuest() {
  const { user, profile } = useAuth()
  return isGuest(user, profile)
}

export function SignupSheet({ onClose, title = 'سجّل حسابك ببلاش', why = 'وتقدر تدخل الغرفة الصوتية، وتلعب وتكسب كوينز وهدايا، ومحدش ياخد اسمك', icon = '👑', showToast }) {
  const [mode, setMode] = useState(null)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const done = () => { showToast?.('🎉 اتسجّلت! حسابك واسمك زي ما هم'); onClose?.() }
  async function google() {
    setErr(''); setBusy(true)
    try { await guestToGoogle(); done() } catch (e) { setErr(signupErrorText(e)) }
    setBusy(false)
  }
  async function byEmail(e) {
    e.preventDefault(); setErr('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('اكتب الإيميل صح')
    if (pw.length < 6) return setErr('الباسورد لازم ٦ حروف أو أرقام على الأقل')
    setBusy(true)
    try { await guestToEmail(email, pw); done() } catch (e2) { setErr(signupErrorText(e2)) }
    setBusy(false)
  }
  return (
    <Sheet onClose={onClose}>
      <span className="grabber" aria-hidden="true" />
      <div className="su">
        <div className="su-ic">{icon}</div>
        <h2 className="sheet-title">{title}</h2>
        <p className="su-why">{why}</p>
        {mode === 'email' ? (
          <form className="su-form" onSubmit={byEmail}>
            <input className="input" type="email" dir="ltr" placeholder="الإيميل" autoCapitalize="none" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="input" type="password" dir="ltr" placeholder="الباسورد (٦ على الأقل)" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            {err && <p className="error">{err}</p>}
            <button type="submit" className="btn-primary su-main" disabled={busy}>{busy ? 'لحظة...' : 'سجّل'}</button>
            <button type="button" className="su-back" onClick={() => { setMode(null); setErr('') }}>رجوع</button>
          </form>
        ) : (
          <>
            <button type="button" className="btn-primary su-main" disabled={busy} onClick={google}><Google />{busy ? 'لحظة...' : 'سجّل بجوجل'}</button>
            <button type="button" className="btn-outline" onClick={() => setMode('email')}>✉️ سجّل بالإيميل والباسورد</button>
            {err && <p className="error">{err}</p>}
          </>
        )}
        <small className="su-note">اسمك ورسايلك هيفضلوا زي ما هم</small>
      </div>
    </Sheet>
  )
}

// بدل الصفحة كلها (الألعاب مثلًا) للزائر
export function GuestWall({ icon, title, why }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="guest-wall">
      <div className="su-ic">{icon}</div>
      <h2>{title}</h2>
      <p>{why}</p>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>سجّل ببلاش</button>
      {open && <SignupSheet onClose={() => setOpen(false)} icon={icon} title={title} why={why} />}
    </div>
  )
}

// زراير التسجيل جوه رسالة الترحيب (بتختفي لو اتسجّل خلاص)
export function SignupButtons() {
  const guest = useIsGuest()
  const [open, setOpen] = useState(false)
  if (!guest) return <span className="su-done">✅ انت مسجّل خلاص</span>
  return (
    <span className="su-btns" onClick={(e) => e.stopPropagation()}>
      <span role="button" tabIndex={0} className="su-btn su-btn-main" onClick={() => setOpen(true)}>سجّل بجوجل أو بالإيميل</span>
      {open && createPortal(<SignupSheet onClose={() => setOpen(false)} />, document.body)}
    </span>
  )
}
