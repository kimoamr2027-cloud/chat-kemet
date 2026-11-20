import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import pyramids from '../assets/pyramids-night.png'
import { Google } from '../components/Icons.jsx'
import { WhatsAppLink } from '../components/ui.jsx'
import { inAppBrowser, isAndroid, chromeIntent } from '../browser.js'
import { useAuth, loginWithUsername, passwordErrorText, signInWithGoogle, setPendingProfile, saveProfile, signOutUser, authErrorText, signInAsGuest } from '../auth.jsx'
import { pharaohName } from '../names.js'

// اختيار النوع (مربعين كبار)
function GenderPicker({ gender, setGender }) {
  return (
    <div role="group" aria-label="النوع" className="ln-gen">
      {[['male', '🧔🏽', 'ذكر'], ['female', '👩🏽', 'أنثى']].map(([id, ic, label]) => (
        <button key={id} type="button" aria-pressed={gender === id} className={gender === id ? 'on' : ''} onClick={() => setGender(id)}>
          <i aria-hidden="true">{ic}</i>{label}
        </button>
      ))}
    </div>
  )
}

// لو التحميل طوّل: زرار نجرب تاني
function SlowRetry() {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setSlow(true), 10000); return () => clearTimeout(t) }, [])
  if (!slow) return null
  return (
    <div className="ln-bottom">
      <p className="ln-wait">الدخول بياخد وقت أكتر من العادي…</p>
      <button type="button" className="ln-gold" onClick={() => window.location.reload()}>حاول تاني</button>
      <button type="button" className="ln-link" onClick={() => signOutUser().then(() => window.location.reload())}>ارجع لصفحة الدخول</button>
    </div>
  )
}

export default function Login() {
  const { user, profile } = useAuth()
  const [name, setName] = useState(null) // null = لسه ماكتبش حاجة
  const [gender, setGender] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  // main = الصفحة الأولى، guest = الاسم الفرعوني، pw = الإيميل والباسورد
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('kemet-login-mode') === 'pw' ? 'pw' : 'main' } catch { return 'main' } })
  const [pharaoh, setPharaoh] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const inApp = inAppBrowser()

  useEffect(() => { if (user) setError('') }, [user])

  if (user && profile) return <Navigate to="/rooms" replace />

  const loading = user === undefined || (user && profile === undefined)
  // دخل بجوجل أول مرة: لسه ماكملش اسمه ونوعه
  const completing = user && profile === null && !user.isAnonymous
  const shownName = name ?? (completing ? (user.displayName || '').slice(0, 30) : '')

  function google() {
    setError(''); setBusy(true)
    // لازم تتنده على طول من الضغطة علشان سفاري مايقفلش نافذة جوجل
    signInWithGoogle()
      .catch((e) => setError(authErrorText(e)))
      .finally(() => setBusy(false))
  }

  function asGuest() {
    if (!gender) return setError('اختار ذكر ولا أنثى الأول')
    setError(''); setPharaoh(pharaohName(gender)); setMode('guest')
  }
  async function enterGuest() {
    setBusy(true); setError('')
    try { await signInAsGuest(pharaoh, gender) } catch { setError('مقدرناش ندخلك، جرب تاني') }
    setBusy(false)
  }

  async function loginPw() {
    if (!username.trim() || !password) return setError('اكتب الإيميل والباسورد')
    setError(''); setBusy(true)
    try {
      await loginWithUsername(username, password)
      try { localStorage.setItem('kemet-login-mode', 'pw') } catch {}
    } catch (e) {
      setError(passwordErrorText(e))
    }
    setBusy(false)
  }

  async function complete() {
    if (!shownName.trim()) return setError('اكتب اسمك الأول')
    if (!gender) return setError('اختار ذكر ولا أنثى')
    setBusy(true)
    try {
      await saveProfile(user.uid, { name: shownName, gender }, true)
    } catch {
      setError('مقدرناش نحفظ بياناتك، جرب تاني')
    }
    setBusy(false)
  }

  const Head = ({ small }) => (
    <div className={`ln-head ${small ? 'small' : ''}`}>
      <img src={pyramids} alt="الأهرامات وأبو الهول" />
      {!small && <><h1>شات كيمت</h1><p>دردشة مصرية بروح فرعونية</p></>}
    </div>
  )

  return (
    <main className="screen ln">
      <div className="ln-sky" aria-hidden="true"><span className="ln-moon" /></div>

      {inApp && !user && (
        <div className="inapp">
          <b>انت فاتح من جوه {inApp}</b>
          جوجل مش بيسمح بتسجيل الدخول من هنا. افتح اللينك في {isAndroid() ? 'Chrome' : 'Safari'} (أو ادخل كزائر):
          <div className="inapp-actions">
            {isAndroid() && <a className="btn-primary inapp-btn" href={chromeIntent()}>افتح في Chrome</a>}
            <button type="button" className="btn-outline inapp-btn" onClick={() => {
              navigator.clipboard?.writeText(window.location.href.split('#')[0]).then(() => setCopied(true)).catch(() => {})
            }}>{copied ? '✓ اتنسخ — الصقه في المتصفح' : 'انسخ اللينك'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <><Head /><p className="ln-wait">لحظة واحدة...</p><SlowRetry /></>
      ) : completing ? (
        <>
          <Head small />
          <form className="ln-card" onSubmit={(e) => { e.preventDefault(); complete() }}>
            <h2>أهلًا بيك في كيمت 👋</h2>
            <p className="ln-sub">آخر خطوة: عرّفنا بنفسك</p>
            <label htmlFor="name" className="ln-lbl">اسمك في الشات</label>
            <input id="name" className="ln-in" type="text" placeholder="اكتب اسمك" maxLength={30}
              value={shownName} onChange={(e) => { setName(e.target.value); setError('') }} />
            <span className="ln-lbl">النوع</span>
            <GenderPicker gender={gender} setGender={(g) => { setGender(g); setError('') }} />
            {error && <p className="ln-err">{error}</p>}
            <button type="submit" className="ln-gold" disabled={busy}>{busy ? 'لحظة...' : 'يلا بينا ✨'}</button>
            <p className="ln-foot">داخل بحساب {user.email} — <a href="#/login" onClick={(e) => { e.preventDefault(); signOutUser() }}>مش انت؟</a></p>
          </form>
        </>
      ) : mode === 'guest' ? (
        <>
          <Head small />
          <div className="ln-reveal">
            <span className="ln-badge">اسمك في كيمت</span>
            <b className="ln-name">{pharaoh}</b>
            <small>اسم فرعوني اتختارلك 👑<br />تقدر تكتب في الغرف وتبعت خاص على طول</small>
            <button type="button" className="ln-line" onClick={() => setPharaoh(pharaohName(gender))}>🎲 اختارلي اسم تاني</button>
          </div>
          <div className="ln-bottom">
            {error && <p className="ln-err">{error}</p>}
            <button type="button" className="ln-gold" disabled={busy} onClick={enterGuest}>{busy ? 'لحظة...' : 'يلا بينا ✨'}</button>
            <button type="button" className="ln-link" onClick={() => setMode('main')}>رجوع</button>
          </div>
        </>
      ) : mode === 'pw' ? (
        <>
          <Head small />
          <form className="ln-card" onSubmit={(e) => { e.preventDefault(); loginPw() }}>
            <h2>ادخل بحسابك</h2>
            <label htmlFor="username" className="ln-lbl">الإيميل أو اسم المستخدم</label>
            <input id="username" className="ln-in" type="text" dir="ltr" placeholder="name@gmail.com"
              autoCapitalize="none" autoCorrect="off" autoComplete="username" spellCheck="false"
              value={username} onChange={(e) => { setUsername(e.target.value); setError('') }} />
            <label htmlFor="password" className="ln-lbl">الباسورد</label>
            <div className="pw-wrap">
              <input id="password" className="ln-in" type={showPw ? 'text' : 'password'} dir="ltr"
                autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />
              <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)}>{showPw ? 'إخفاء' : 'إظهار'}</button>
            </div>
            {error && <p className="ln-err">{error}</p>}
            <button type="submit" className="ln-gold" disabled={busy}>{busy ? 'لحظة...' : 'دخول'}</button>
            <button type="button" className="ln-link" onClick={() => { setMode('main'); setError('') }}>رجوع</button>
          </form>
        </>
      ) : (
        <>
          <Head />
          <div className="ln-bottom">
            <p className="ln-q">ادخل على طول — انت ولد ولا بنت؟</p>
            <GenderPicker gender={gender} setGender={(g) => { setGender(g); setError('') }} />
            {error && <p className="ln-err">{error}</p>}
            <button type="button" className="ln-gold" onClick={asGuest}>ادخل كزائر ✨</button>
            <div className="ln-or"><span />أو عندك حساب؟<span /></div>
            <button type="button" className="ln-line" disabled={busy} onClick={google}><span className="ln-g"><Google /></span>ادخل بحساب جوجل</button>
            <button type="button" className="ln-line" onClick={() => { setMode('pw'); setError('') }}>✉️ ادخل بالإيميل والباسورد</button>
            <WhatsAppLink className="wa-login ln-wa" />
          </div>
        </>
      )}
    </main>
  )
}
