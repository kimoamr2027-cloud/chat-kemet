import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import pyramids from '../assets/pyramids.png'
import { Google } from '../components/Icons.jsx'
import { Radio, useToast } from '../components/ui.jsx'
import { loadProfile, saveProfile } from '../store.js'

export default function Login() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [gender, setGender] = useState('male')
  const [error, setError] = useState('')
  const [toast, showToast] = useToast()

  function enter() {
    if (!name.trim()) return setError('اكتب اسمك الأول')
    saveProfile({ ...loadProfile(), name: name.trim(), gender })
    navigate('/rooms', { replace: true })
  }

  return (
    <main className="screen login">
      <div className="login-head">
        <img src={pyramids} alt="الأهرامات وأبو الهول" />
        <h1>شات كيمت</h1>
      </div>

      <h2 className="login-title">تسجيل الدخول</h2>

      <form className="login-form" onSubmit={(e) => { e.preventDefault(); enter() }}>
        <div className="field">
          <label htmlFor="name">الاسم</label>
          <input id="name" className="input input-soft" type="text" placeholder="اكتب اسمك" maxLength={30}
            value={name} onChange={(e) => { setName(e.target.value); setError('') }} />
        </div>

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

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn-primary">دخول</button>
      </form>

      <div className="or"><span />أو<span /></div>

      <button type="button" className="btn-outline" onClick={() => showToast('الدخول بجوجل هيشتغل في المرحلة الجاية')}>
        <Google />
        تسجيل الدخول باستخدام Google
      </button>

      <p className="login-foot">ليس لديك حساب؟ <a href="#/login" onClick={(e) => { e.preventDefault(); document.getElementById('name').focus() }}>إنشاء حساب</a></p>
      {toast}
    </main>
  )
}
