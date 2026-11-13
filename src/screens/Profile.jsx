import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Back, Gear, User, Camera, Image, Close } from '../components/Icons.jsx'
import { useToast } from '../components/ui.jsx'
import { loadProfile, saveProfile } from '../store.js'
import { ar } from '../utils.js'

// تصغير الصورة قبل حفظها على الجهاز
function shrink(file, max) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

export default function Profile() {
  const navigate = useNavigate()
  const [p, setP] = useState(() => ({ avatar: '', photos: [], ...loadProfile() }))
  const [toast, showToast] = useToast()
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value })

  async function onAvatar(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const avatar = await shrink(f, 320)
    if (avatar) setP((x) => ({ ...x, avatar }))
    e.target.value = ''
  }
  async function onPhotos(e) {
    const files = Array.from(e.target.files || []).slice(0, 6 - p.photos.length)
    const out = (await Promise.all(files.map((f) => shrink(f, 720)))).filter(Boolean)
    setP((x) => ({ ...x, photos: [...x.photos, ...out].slice(0, 6) }))
    e.target.value = ''
  }
  function save() {
    if (!p.name.trim()) return showToast('الاسم مينفعش يبقى فاضي')
    if (!saveProfile({ ...p, name: p.name.trim() })) return showToast('الصور كبيرة، امسح صورة وجرب تاني')
    showToast('اتحفظت بياناتك')
    setTimeout(() => navigate('/rooms'), 700)
  }

  return (
    <main className="screen">
      <header className="head head-row">
        <Link to="/rooms" aria-label="رجوع" className="icon-btn"><Back /></Link>
        <h1 className="h-small">بياناتي</h1>
        <Link to="/settings" aria-label="الإعدادات" className="icon-btn"><Gear /></Link>
      </header>

      <div className="scroll form-area">
        <div className="avatar-pick">
          <label className="avatar-label">
            <input type="file" accept="image/*" onChange={onAvatar} aria-label="اختار صورة البروفايل" className="file-hidden" />
            {p.avatar
              ? <img src={p.avatar} alt="صورة البروفايل" className="avatar-img" />
              : <div className="avatar-empty"><User size={48} sw={1.6} /></div>}
            <span className="avatar-cam" aria-hidden="true"><Camera /></span>
          </label>
          <span className="avatar-hint">تغيير صورة البروفايل</span>
        </div>

        <div className="field">
          <label htmlFor="p-name">الاسم</label>
          <input id="p-name" className="input" type="text" placeholder="اسمك بالكامل" value={p.name} onChange={set('name')} maxLength={30} />
        </div>

        <div className="field">
          <label htmlFor="p-bio">نبذة عني</label>
          <textarea id="p-bio" className="input textarea" rows="3" placeholder="اكتب حاجة عن نفسك" value={p.bio} onChange={set('bio')} maxLength={200} />
        </div>

        <div className="two-col">
          <div className="field">
            <label htmlFor="p-city">المدينة</label>
            <input id="p-city" className="input" type="text" placeholder="مثلاً القاهرة" value={p.city} onChange={set('city')} />
          </div>
          <div className="field">
            <label htmlFor="p-age">السن</label>
            <input id="p-age" className="input" type="number" inputMode="numeric" placeholder="مثلاً ٢٥" value={p.age} onChange={set('age')} />
          </div>
        </div>

        <div className="field">
          <span id="p-gender">النوع</span>
          <div role="group" aria-labelledby="p-gender" className="choice-grid">
            {[['male', 'ذكر'], ['female', 'أنثى']].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={p.gender === id}
                className={`choice choice-sm ${p.gender === id ? 'choice-on' : ''}`} onClick={() => setP({ ...p, gender: id })}>{label}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="row-line">
            <span>صوري</span>
            <span className="row-time">{ar(p.photos.length)} من ٦</span>
          </div>
          <div className="photo-grid">
            {p.photos.map((src, i) => (
              <div key={i} className="photo">
                <img src={src} alt="صورة من صوري" />
                <button type="button" aria-label="حذف الصورة" onClick={() => setP({ ...p, photos: p.photos.filter((_, j) => j !== i) })}><Close size={14} sw={2.6} /></button>
              </div>
            ))}
            {p.photos.length < 6 && (
              <label className="photo-add">
                <input type="file" accept="image/*" multiple onChange={onPhotos} aria-label="إضافة صور" className="file-hidden" />
                <Image size={24} />
                إضافة صور
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="save-bar">
        <button type="button" className="btn-primary" onClick={save}>حفظ البيانات</button>
      </div>
      {toast}
    </main>
  )
}
