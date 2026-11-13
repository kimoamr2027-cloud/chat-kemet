import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Back, Gear, User, Camera, Image, Close } from '../components/Icons.jsx'
import { useToast } from '../components/ui.jsx'
import { loadLocalPhotos } from '../store.js'
import { compressImage, usePhotos, savePhoto, deletePhoto } from '../media.js'
import { useAuth, saveProfile } from '../auth.jsx'
import { ar } from '../utils.js'

export default function Profile() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [p, setP] = useState(() => ({
    name: profile.name || '', gender: profile.gender || 'male', bio: profile.bio || '',
    city: profile.city || '', age: profile.age ?? '',
    // لو كان في صورة بروفايل قديمة على الجهاز بس، بنستخدمها لحد ما تحفظ
    avatar: profile.avatar || loadLocalPhotos(user.uid).avatar || '',
  }))
  const photos = usePhotos(user.uid) || []
  const [photoBusy, setPhotoBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, showToast] = useToast()
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value })

  async function onAvatar(e) {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    try {
      const { dataUrl } = await compressImage(f, 320, 78000)
      setP((x) => ({ ...x, avatar: dataUrl }))
    } catch { showToast('الصورة دي مش نافعة، جرب صورة تانية') }
  }
  // صوري بتترفع على طول (من غير ما تدوس حفظ)
  async function onPhotos(e) {
    const used = new Set(photos.map((x) => x.id))
    const free = ['0', '1', '2', '3', '4', '5'].filter((x) => !used.has(x))
    const files = Array.from(e.target.files || []).slice(0, free.length)
    e.target.value = ''
    if (!files.length) return
    setPhotoBusy(true)
    let failed = 0
    for (let i = 0; i < files.length; i++) {
      try {
        const { dataUrl } = await compressImage(files[i], 720, 290000)
        await savePhoto(user.uid, free[i], dataUrl)
      } catch { failed++ }
    }
    setPhotoBusy(false)
    if (failed) showToast('في صور ماترفعتش، جرب تاني')
  }
  async function save() {
    if (!p.name.trim()) return showToast('الاسم مينفعش يبقى فاضي')
    const age = p.age === '' ? null : parseInt(p.age, 10)
    if (age !== null && !(age >= 13 && age <= 100)) return showToast('السن لازم يكون بين ١٣ و ١٠٠')
    setBusy(true)
    try {
      await saveProfile(user.uid, { ...p, age })
      showToast('اتحفظت بياناتك')
      setTimeout(() => navigate('/rooms'), 700)
    } catch {
      showToast('مقدرناش نحفظ، اتأكد من النت وجرب تاني')
    }
    setBusy(false)
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
            <span className="row-time">{photoBusy ? 'بتترفع...' : `${ar(photos.length)} من ٦`}</span>
          </div>
          <div className="photo-grid">
            {photos.map((ph) => (
              <div key={ph.id} className="photo">
                <img src={ph.src} alt="صورة من صوري" />
                <button type="button" aria-label="حذف الصورة" onClick={() => deletePhoto(user.uid, ph.id).catch(() => showToast('مقدرناش نمسح الصورة'))}><Close size={14} sw={2.6} /></button>
              </div>
            ))}
            {photos.length < 6 && !photoBusy && (
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
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>{busy ? 'بيتحفظ...' : 'حفظ البيانات'}</button>
      </div>
      {toast}
    </main>
  )
}
