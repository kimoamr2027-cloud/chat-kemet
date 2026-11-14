import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Back, Chat, User } from '../components/Icons.jsx'
import { Avatar, UserName, useToast } from '../components/ui.jsx'
import { useAuth } from '../auth.jsx'
import { useUser } from '../dm.js'
import { usePhotos } from '../media.js'
import { useUserOnline } from '../presence.js'
import { useRooms, colorIndex } from '../rooms.js'
import { isAdminUid, appBan, appUnban, useAdminList } from '../roles.js'
import { ar } from '../utils.js'
import { createTable, inviteDM } from '../ludo.js'
import { GiftButton } from '../components/Coins.jsx'

// بروفايل أي عضو
export default function UserProfile() {
  const { uid } = useParams()
  const navigate = useNavigate()
  const { user, profile, roles } = useAuth()
  const person = useUser(uid)
  const photos = usePhotos(uid) || []
  const online = useUserOnline(uid)
  const { rooms } = useRooms()
  const [view, setView] = useState(null)
  const [toast, showToast] = useToast()
  const me = uid === user.uid
  const iAdmin = isAdminUid(roles, user.uid)
  const admin = isAdminUid(roles, uid)

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/rooms'))

  if (person === null) {
    return (
      <main className="screen">
        <header className="head head-row">
          <button type="button" aria-label="رجوع" className="icon-btn" onClick={back}><Back /></button>
          <h1 className="h-small">البروفايل</h1>
        </header>
        <p className="empty">العضو ده مش موجود.</p>
      </main>
    )
  }

  const name = person?.name || '...'
  const details = person
    ? [person.city, person.age ? `${ar(person.age)} سنة` : '', person.gender === 'female' ? 'أنثى' : 'ذكر'].filter(Boolean).join(' · ')
    : ''
  const modRooms = (rooms || []).filter((r) => (roles.mods?.[r.id] || []).includes(uid))

  return (
    <main className="screen">
      <header className="head head-row">
        <button type="button" aria-label="رجوع" className="icon-btn" onClick={back}><Back /></button>
        <h1 className="h-small">البروفايل</h1>
      </header>

      <div className="scroll profile-page">
        <div className={`profile-avatar ${admin ? 'profile-avatar-admin' : ''}`}>
          <Avatar text={name.charAt(0)} c={colorIndex(uid)} size={120} round src={person?.avatar} />
          {online && <span className="online-dot big" aria-label="متصل" />}
        </div>
        <h2 className="profile-name"><UserName name={name} role={admin ? 'admin' : null} /></h2>
        <span className={online ? 'status-on' : 'row-time'}>{online ? <><span className="green-dot" /> متصل الآن</> : 'مش متصل دلوقتي'}</span>
        {details && <span className="profile-details">{details}</span>}
        {modRooms.length > 0 && (
          <div className="profile-roles">
            {modRooms.map((r) => <span key={r.id} className="mod-chip">🛡 مشرف في {r.name}</span>)}
          </div>
        )}

        {person?.bio && <p className="profile-bio card">{person.bio}</p>}

        <div className="profile-actions">
          {me
            ? <Link to="/profile" className="btn-primary profile-btn"><User size={20} />تعديل بياناتي</Link>
            : <Link to={`/dm/${uid}`} className="btn-primary profile-btn"><Chat size={20} />رسالة خاصة</Link>}
          {!me && (
            <button type="button" className="btn-outline profile-btn" onClick={async () => {
              try {
                const id = await createTable({ uid: user.uid, name: profile.name, size: 2 })
                await inviteDM(user.uid, profile.name, uid, id).catch(() => showToast(`${name} قافل الخاص، ابعتله الترابيزة من الغرفة`))
                navigate(`/ludo/${id}`)
              } catch { showToast('مقدرناش نفتح الترابيزة') }
            }}>🎲 العب لودو معاه</button>
          )}
          {iAdmin && !me && <GiftButton uid={uid} name={name} showToast={showToast} />}
          {iAdmin && !me && !admin && <AdminBan uid={uid} name={name} me={user.uid} showToast={showToast} />}
        </div>

        {photos.length > 0 && (
          <>
            <h3 className="profile-section">الصور</h3>
            <div className="photo-grid">
              {photos.map((ph) => (
                <button key={ph.id} type="button" className="photo photo-btn" onClick={() => setView(ph.src)}><img src={ph.src} alt="صورة" /></button>
              ))}
            </div>
          </>
        )}
      </div>

      {view && <div className="viewer" role="dialog" onClick={() => setView(null)}><img src={view} alt="صورة" /></div>}
      {toast}
    </main>
  )
}

function AdminBan({ uid, name, me, showToast }) {
  const bans = useAdminList('bans')
  const banned = (bans || []).some((b) => b.id === uid)
  return banned
    ? <button type="button" className="btn-outline" onClick={() => appUnban(uid).then(() => showToast(`اتلغى حظر ${name}`)).catch(() => showToast('حصلت مشكلة'))}>إلغاء الحظر من التطبيق</button>
    : <button type="button" className="btn-outline danger-text" onClick={() => appBan(uid, name, '', me).then(() => showToast(`اتحظر ${name} من التطبيق`)).catch(() => showToast('حصلت مشكلة'))}>حظر من التطبيق</button>
}
