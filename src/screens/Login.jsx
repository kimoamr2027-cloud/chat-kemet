import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import pyramids from '../assets/pyramids.png'
import { Google } from '../components/Icons.jsx'
import { Radio } from '../components/ui.jsx'
import { useAuth, signInWithGoogle, setPendingProfile, saveProfile, signOutUser, authErrorText } from '../auth.jsx'

function GenderPicker({ gender, setGender }) {
  return (
    <div className="field">
      <span id="gender-label">النوع</span>
      <div role="group" aria-labelledby="gender-label" className="choice-grid">
        {[['male', 'ذكر'], ['female', 'أنثى']].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={gender === id}
            className={`choice ${gender === id ? 'choice-on' : ''}`} onClick={() => setGender(id)}>
            <Radio on={gender === id} />{label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Login() {
  const { user, profile } = useAuth()
  const [name, setName] = useState(null) // null = لسه ماكتبش حاجة
  const [gender, setGender] = useState('male')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (user) setError('') }, [user])

  if (user && profile) return <Navigate to="/rooms" replace />

  const loading = user === undefined || (user && profile === undefined)
  // سجّل بجوجل بس لسه ماكملش بياناته
  const completing = user && profile === null
  const shownName = name ?? (completing ? (user.displayName || '').slice(0, 30) : '')

  function google(requireName) {
    if (requireName && !shownName.trim()) return setError('اكتب اسمك الأول')
    setError('')
    if (shownName.trim()) setPendingProfile({ name: shownName.trim(), gender })
    setBusy(true)
    // لازم تتنده على طول من الضغطة علشان سفاري مايقفلش نافذة جوجل
    signInWithGoogle()
      .catch((e) => setError(authErrorText(e)))
      .finally(() => setBusy(false))
  }

  async function complete() {
    if (!shownName.trim()) return setError('اكتب اسمك الأول')
    setBusy(true)
    try {
      await saveProfile(user.uid, { name: shownName, gender }, true)
    } catch {
      setError('مقدرناش نحفظ بياناتك، جرب تاني')
    }
    setBusy(false)
  }

  return (
    <main className="screen login">
      <div className="login-head">
        <img src={pyramids} alt="الأهرامات وأبو الهول" />
        <h1>شات كيمت</h1>
      </div>

      <h2 className="login-title">{completing ? 'كمّل بياناتك' : 'تسجيل الدخول'}</h2>

      {loading ? (
        <p className="login-wait">لحظة واحدة...</p>
      ) : (
        <>
          <form className="login-form" onSubmit={(e) => { e.preventDefault(); completing ? complete() : google(true) }}>
            <div className="field">
              <label htmlFor="name">الاسم</label>
              <input id="name" className="input input-soft" type="text" placeholder="اكتب اسمك" maxLength={30}
                value={shownName} onChange={(e) => { setName(e.target.value); setError('') }} />
            </div>
            <GenderPicker gender={gender} setGender={setGender} />
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'لحظة...' : completing ? 'يلا بينا' : 'دخول'}
            </button>
          </form>

          {completing ? (
            <p className="login-foot">داخل بحساب {user.email} — <a href="#/login" onClick={(e) => { e.preventDefault(); signOutUser() }}>مش انت؟</a></p>
          ) : (
            <>
              <div className="or"><span />أو<span /></div>
              <button type="button" className="btn-outline" disabled={busy} onClick={() => google(false)}>
                <Google />
                تسجيل الدخول باستخدام Google
              </button>
              <p className="login-foot">الدخول بيتم بحساب جوجل بتاعك. أول مرة هنحفظ اسمك ونوعك.</p>
            </>
          )}
        </>
      )}
    </main>
  )
}
