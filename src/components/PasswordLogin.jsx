import { useState } from 'react'
import { useAuth, myUsername, createUsernameLogin, changePassword, passwordErrorText, USERNAME_RE, normalizeUsername } from '../auth.jsx'

// في الإعدادات: اعمل اسم مستخدم وباسورد علشان تدخل بيهم من غير جوجل
export default function PasswordLogin({ showToast }) {
  const { user } = useAuth()
  const [username, setUsername] = useState(() => myUsername(user))
  const [open, setOpen] = useState(false)
  const [u, setU] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!username) {
      const name = normalizeUsername(u)
      if (!USERNAME_RE.test(name)) return setError('اسم المستخدم: من ٣ لـ ٢٠ حرف إنجليزي أو رقم (ممكن . أو _)')
    }
    if (pw.length < 6) return setError('الباسورد لازم ٦ حروف أو أرقام على الأقل')
    if (pw !== pw2) return setError('الباسورد مش زي بعضه في الخانتين')
    setBusy(true)
    try {
      if (username) {
        await changePassword(pw)
        showToast('الباسورد اتغيّر ✓')
      } else {
        const name = await createUsernameLogin(u, pw)
        setUsername(name)
        try { localStorage.setItem('kemet-login-mode', 'pw') } catch {}
        showToast('اتعمل ✓ دلوقتي تقدر تدخل بالاسم والباسورد')
      }
      setOpen(false); setPw(''); setPw2('')
    } catch (err) {
      setError(passwordErrorText(err))
    }
    setBusy(false)
  }

  return (
    <div className="set-card set-card-pad">
      {username ? (
        <>
          <span className="set-q">🔑 اسم المستخدم بتاعك</span>
          <span className="pw-user" dir="ltr">{username}</span>
          <small className="pw-hint">لو خرجت، ادخل تاني بالاسم ده والباسورد من شاشة الدخول ← «عندي اسم مستخدم وباسورد».</small>
          {!open && <button type="button" className="pill-btn pw-change" onClick={() => setOpen(true)}>تغيير الباسورد</button>}
        </>
      ) : (
        <>
          <span className="set-q">🔑 ادخل باسم مستخدم وباسورد</span>
          <small className="pw-hint">اعمل اسم مستخدم وباسورد، ولو خرجت تدخل بيهم من غير جوجل.</small>
          {!open && <button type="button" className="btn-primary pw-create" onClick={() => setOpen(true)}>اعمل اسم مستخدم وباسورد</button>}
        </>
      )}

      {open && (
        <form className="pw-form" onSubmit={submit}>
          {!username && (
            <input className="input" dir="ltr" placeholder="اسم المستخدم (إنجليزي)" autoCapitalize="none" autoCorrect="off"
              spellCheck="false" autoComplete="username" value={u} onChange={(e) => { setU(e.target.value); setError('') }} />
          )}
          <input className="input" dir="ltr" type="password" placeholder={username ? 'الباسورد الجديد' : 'الباسورد'} autoComplete="new-password"
            value={pw} onChange={(e) => { setPw(e.target.value); setError('') }} />
          <input className="input" dir="ltr" type="password" placeholder="اكتب الباسورد تاني" autoComplete="new-password"
            value={pw2} onChange={(e) => { setPw2(e.target.value); setError('') }} />
          {error && <p className="error">{error}</p>}
          <div className="pw-actions">
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'لحظة...' : 'حفظ'}</button>
            <button type="button" className="btn-outline" onClick={() => { setOpen(false); setError('') }}>إلغاء</button>
          </div>
        </form>
      )}
    </div>
  )
}
