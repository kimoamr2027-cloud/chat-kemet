import { useEffect, useState } from 'react'
import { recordVisit, useFriends, friendState, friendAct } from '../social.js'
import { isBot } from '../bots.js'
import { supportersOf } from '../pk.js'
import { setLiveHost } from '../live.js'
import { toHiero, loadHieroFont } from '../hiero.js'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Back, Chat, User } from '../components/Icons.jsx'
import { Avatar, UserName, useToast } from '../components/ui.jsx'
import { useAuth } from '../auth.jsx'
import { useUser } from '../dm.js'
import { usePhotos } from '../media.js'
import { useUserPresence } from '../presence.js'
import { ago } from '../notifs.js'
import { useRooms, colorIndex } from '../rooms.js'
import { isAdminUid, appBan, appUnban, useAdminList } from '../roles.js'
import { useVip, grantVip, VIP_LEVELS, vipVars } from '../vip.js'
import { ar } from '../utils.js'
import { createTable, inviteDM } from '../ludo.js'
import { GiftButton } from '../components/Coins.jsx'
import { CoupleLine, RingButton } from '../components/Perks.jsx'
import { useQuizTitles, titleOf, nextTitle } from '../titles.js'

// بروفايل أي عضو
// 💪 أكبر ٣ داعمين للعضو ده الشهر ده
function TopSupporters({ uid }) {
  const [list, setList] = useState(null)
  useEffect(() => { supportersOf(uid).then(setList).catch(() => setList([])) }, [uid])
  if (!list?.length) return null
  return (
    <div className="card top-sups">
      <b>💪 أكبر الداعمين الشهر ده</b>
      {list.map((s, i) => <Link key={s.uid} to={`/u/${s.uid}`} className="top-member"><span className="top-rank">{['🥇', '🥈', '🥉'][i]}</span><span className="top-name">{s.name}</span><span className="hbar-val">{Number(s.n).toLocaleString('ar-EG')} 🪙</span></Link>)}
    </div>
  )
}

// الاسم بالهيروغليفي جوه خرطوش فرعوني
function HieroName({ name }) {
  useEffect(() => { loadHieroFont() }, [])
  const h = toHiero(name)
  return (
    <div className="hiero-box">
      <small className="hiero-label"><span className="hiero-eye">𓂀</span> اسمه بالهيروغليفي (لغة الفراعنة)</small>
      <div className="hiero-name" dir="ltr" style={{ fontSize: h.length <= 7 ? 38 : h.length <= 11 ? 30 : h.length <= 15 ? 24 : 19 }}>{h}</div>
    </div>
  )
}

export default function UserProfile() {
  const { uid } = useParams()
  const navigate = useNavigate()
  const { user, profile, roles } = useAuth()
  const person = useUser(uid)
  const photos = usePhotos(uid) || []
  const seen = useUserPresence(uid)
  const online = seen.online
  const { rooms } = useRooms()
  const [view, setView] = useState(null)
  const [toast, showToast] = useToast()
  const me = uid === user.uid
  // زيارة البروفايل (لصاحبه يشوف مين زاره)
  useEffect(() => { if (uid && !me) recordVisit(uid) }, [uid, me])
  const friends = useFriends(user.uid)
  const fstate = friendState(friends, uid)
  const [fbusy, setFbusy] = useState(false)
  const fact = (action, ok) => { setFbusy(true); friendAct(uid, action).then(() => ok && showToast(ok)).catch((e) => showToast(e?.response?.message || 'حصلت مشكلة، جرب تاني')).finally(() => setFbusy(false)) }
  const iAdmin = isAdminUid(roles, user.uid)
  const admin = isAdminUid(roles, uid)
  const { t: quizPts } = useQuizTitles()

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
  const pts = quizPts[uid] || 0
  const myTitle = titleOf(pts)
  const next = nextTitle(pts)
  const details = person
    ? [person.city, person.age ? `${ar(person.age)} سنة` : '', person.gender === 'female' ? 'أنثى' : person.gender === 'male' ? 'ذكر' : ''].filter(Boolean).join(' · ')
    : ''
  // الغرفة اللي هو فيها دلوقتي (لو ظاهرة)
  const seenRoom = seen.room ? (rooms || []).find((r) => r.id === seen.room) : null
  const modRooms = (rooms || []).filter((r) => (roles.mods?.[r.id] || []).includes(uid))

  return (
    <main className="screen">
      <header className="head head-row">
        <button type="button" aria-label="رجوع" className="icon-btn" onClick={back}><Back /></button>
        <h1 className="h-small">البروفايل</h1>
      </header>

      <div className="scroll profile-page">
        <div className={`profile-avatar ${admin ? 'profile-avatar-admin' : myTitle ? `profile-avatar-t${myTitle.level}` : ''}`}>
          <Avatar text={name.charAt(0)} c={colorIndex(uid)} size={120} round src={person?.avatar} uid={uid} />
          {online && <span className="online-dot big" aria-label="متصل" />}
        </div>
        <h2 className="profile-name"><UserName name={name} role={admin ? 'admin' : null} uid={uid} /></h2>
        {person?.name && toHiero(person.name) && <HieroName name={person.name} />}
        <span className={online ? 'status-on' : 'row-time'}>
          {online ? <><span className="green-dot" /> متصل الآن{seenRoom && <> · في <Link to={`/rooms/${seenRoom.id}`}>{seenRoom.name}</Link></>}</>
            : seen.at ? `آخر ظهور ${ago(new Date(seen.at))}` : 'مش متصل دلوقتي'}
        </span>
        {details && <span className="profile-details">{details}</span>}
        <CoupleLine uid={uid} />
        {pts > 0 && (
          <div className="title-card">
            <b>❓ {ar(pts)} {pts === 1 ? 'نقطة' : pts === 2 ? 'نقطتين' : 'نقطة'} في مسابقة كيمت</b>
            {next ? (
              <>
                <div className="title-bar"><i style={{ width: `${Math.round((pts / next.min) * 100)}%` }} /></div>
                <small>اللقب الجاي: {next.icon} {next.name} — {me ? 'فاضلّك' : 'فاضله'} {ar(next.min - pts)} {next.min - pts === 1 ? 'نقطة' : 'نقط'}</small>
              </>
            ) : <small>☥ وصل لأعلى لقب في المسابقة</small>}
          </div>
        )}
        {modRooms.length > 0 && (
          <div className="profile-roles">
            {modRooms.map((r) => <span key={r.id} className="mod-chip">🛡 مشرف في {r.name}</span>)}
          </div>
        )}

        {person?.bio && <p className="profile-bio card">{person.bio}</p>}
        <TopSupporters uid={uid} />

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
          {!me && !isBot(uid) && (
            fstate === 'ok' ? <button type="button" className="btn-outline profile-btn" disabled={fbusy} onClick={() => { if (window.confirm(`تشيل ${name} من أصحابك؟`)) fact('remove', 'اتشال من أصحابك') }}>✅ صاحبك</button>
            : fstate === 'sent' ? <button type="button" className="btn-outline profile-btn" disabled={fbusy} onClick={() => fact('remove', 'اتلغى الطلب')}>⏳ بعتّ طلب صداقة (إلغاء)</button>
            : fstate === 'got' ? <button type="button" className="btn-primary profile-btn" disabled={fbusy} onClick={() => fact('accept', `🎉 بقيت صاحب ${name}`)}>🤝 قبول طلب الصداقة</button>
            : <button type="button" className="btn-outline profile-btn" disabled={fbusy} onClick={() => fact('add', '🤝 بعتنا طلب الصداقة')}>🤝 أضف صديق</button>
          )}
          <RingButton uid={uid} name={name} showToast={showToast} />
          {iAdmin && !me && <GiftButton uid={uid} name={name} showToast={showToast} />}
          {iAdmin && !me && <AdminVip uid={uid} name={name} showToast={showToast} />}
          {iAdmin && !me && !isBot(uid) && (
            <button type="button" className="btn-outline profile-btn" onClick={() => setLiveHost(uid, !person?.liveHost).then(() => showToast(person?.liveHost ? `اتشال ${name} من مضيفين اللايف` : `🎥 ${name} بقى مضيف لايف معتمد`)).catch(() => showToast('حصلت مشكلة'))}>
              {person?.liveHost ? '🎥 شيله من مضيفين اللايف' : '🎥 خليه مضيف لايف'}
            </button>
          )}
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

// الأدمن يدّي أو يشيل VIP (ببلاش)
function AdminVip({ uid, name, showToast }) {
  const lv = useVip(uid)
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState(lv || 1)
  const [days, setDays] = useState(30)
  const save = (level) => grantVip(uid, level, days).then(() => { showToast(level ? `👑 ${name} بقى VIP ${VIP_LEVELS[level - 1].name}` : `اتشال الـ VIP من ${name}`); setOpen(false) }).catch(() => showToast('حصلت مشكلة'))
  if (!open) return <button type="button" className="btn-outline" onClick={() => setOpen(true)}>👑 {lv ? `VIP ${VIP_LEVELS[lv - 1].name} — غيّر` : 'خليه VIP'}</button>
  return (
    <div className="vip-admin">
      <div className="vip-admin-lv">{VIP_LEVELS.map((l) => <button key={l.level} type="button" className={pick === l.level ? 'on' : ''} style={vipVars(l.level)} onClick={() => setPick(l.level)}>{l.icon} {l.name}</button>)}</div>
      <div className="vip-admin-days">{[[30, 'شهر'], [90, '٣ شهور'], [3650, 'على طول']].map(([d, t]) => <button key={d} type="button" className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{t}</button>)}</div>
      <div className="vip-admin-act">
        <button type="button" className="btn-primary" onClick={() => save(pick)}>حفظ</button>
        {lv > 0 && <button type="button" className="btn-outline" onClick={() => save(0)}>شيل الـ VIP</button>}
        <button type="button" className="btn-outline" onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </div>
  )
}

function AdminBan({ uid, name, me, showToast }) {
  const bans = useAdminList('bans')
  const banned = (bans || []).some((b) => b.id === uid)
  return banned
    ? <button type="button" className="btn-outline" onClick={() => appUnban(uid).then(() => showToast(`اتلغى حظر ${name}`)).catch(() => showToast('حصلت مشكلة'))}>إلغاء الحظر من التطبيق</button>
    : <button type="button" className="btn-outline danger-text" onClick={() => appBan(uid, name, '', me).then(() => showToast(`اتحظر ${name} من التطبيق`)).catch(() => showToast('حصلت مشكلة'))}>حظر من التطبيق</button>
}
