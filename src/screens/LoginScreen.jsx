import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import Divider from '../components/Divider.jsx'
import GoogleIcon from '../components/GoogleIcon.jsx'
import { saveProfile } from '../profile.js'

export default function LoginScreen() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [error, setError] = useState('')

  function handleGoogle() {
    if (!name.trim()) return setError('اكتب اسمك الأول')
    if (!gender) return setError('اختار النوع')
    // المرحلة الأولى: شكل بس — ربط جوجل الحقيقي هييجي مع Firebase
    saveProfile({ name: name.trim(), gender })
    navigate('/rooms')
  }

  return (
    <main className="login">
      <div className="login-head">
        <Logo size={84} />
        <h1 className="brand">شات كيمت</h1>
        <p className="tagline">دردشة بروح أرض الفراعنة</p>
      </div>

      <section className="card login-card">
        <h2 className="card-title">أهلاً بيك 👋</h2>
        <Divider />

        <label className="field">
          <span className="field-label">الاسم</span>
          <input
            className="input"
            type="text"
            placeholder="اكتب اسمك"
            value={name}
            maxLength={30}
            onChange={(e) => { setName(e.target.value); setError('') }}
          />
        </label>

        <div className="field">
          <span className="field-label">النوع</span>
          <div className="gender">
            <button
              type="button"
              className={`chip ${gender === 'male' ? 'chip-on' : ''}`}
              onClick={() => { setGender('male'); setError('') }}
            >
              <span aria-hidden="true">♂</span> ذكر
            </button>
            <button
              type="button"
              className={`chip ${gender === 'female' ? 'chip-on' : ''}`}
              onClick={() => { setGender('female'); setError('') }}
            >
              <span aria-hidden="true">♀</span> أنثى
            </button>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <button type="button" className="btn-google" onClick={handleGoogle}>
          <GoogleIcon />
          الدخول بحساب جوجل
        </button>

        <p className="note">نسخة تجريبية — تسجيل الدخول لسه مش متوصل</p>
      </section>
    </main>
  )
}
