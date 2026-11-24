import { useEffect, useState } from 'react'
import { StarBanner, FirstTasks, Newcomers } from '../components/Newcomers.jsx'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { Bell, User } from '../components/Icons.jsx'
import { Avatar, SearchBox, Sheet, Tabs, useToast } from '../components/ui.jsx'
import { roomInitial } from '../data.js'
import { useRooms, useLastMessage, fmtWhen, preview, createRoom, createMyRoom } from '../rooms.js'
import { isGuest } from '../auth.jsx'
import { isAdminUid } from '../roles.js'
import { useAuth } from '../auth.jsx'
import { useUnreadNotifs } from '../notifs.js'
import { PushPrompt } from '../components/PushPrompt.jsx'
import { IosInstallCard } from '../components/InstallPrompt.jsx'
import VoiceCard from '../components/VoiceCard.jsx'

function RoomCard({ room, onLast }) {
  const last = useLastMessage(room.id)
  useEffect(() => { onLast(room.id, last?.at?.getTime() || 0) }, [last?.at?.getTime()])
  const lastText = last === undefined ? '...'
    : last === null ? 'مفيش رسايل لسه — ابدأ انت'
    : `${last.name}: ${preview(last)}`
  return (
    <Link to={`/rooms/${room.id}`} className="card row-card">
      <Avatar text={roomInitial(room.name)} c={(room.order || 1) - 1} size={52} src={room.photo || undefined} />
      <div className="row-body">
        <div className="row-line">
          <span className="row-title">{room.name}{room.owner && <small className="room-owner"> · 🏠 {room.ownerName}</small>}</span>
          <span className="row-time">{last ? fmtWhen(last.at) : ''}</span>
        </div>
        <span className="row-sub">{lastText}</span>
      </div>
    </Link>
  )
}

export default function Rooms() {
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const { rooms, error } = useRooms()
  const { user, profile, myBan, roles } = useAuth()
  const iAdmin = isAdminUid(roles, user.uid)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [toast, showToast] = useToast()
  const navigate = useNavigate()
  const guest = isGuest(user, profile)
  // غرفتي (غرف الأعضاء)
  const myRoom = (rooms || []).find((r) => r.owner === user.uid)
  const [myOpen, setMyOpen] = useState(false)
  const [myName, setMyName] = useState('')
  const [myBusy, setMyBusy] = useState(false)
  function makeMyRoom() {
    const n = myName.trim()
    if (n.length < 2) return showToast('اكتب اسم الغرفة (حرفين على الأقل)')
    setMyBusy(true)
    createMyRoom(n).then((id) => { setMyOpen(false); setMyName(''); navigate(`/rooms/${id}`) })
      .catch((e) => showToast(e?.response?.message || 'مقدرناش نعمل الغرفة، جرب تاني'))
      .finally(() => setMyBusy(false))
  }
  function addRoom() {
    const n = newName.trim()
    if (!n) return showToast('اكتب اسم الغرفة')
    const order = Math.max(0, ...(rooms || []).map((r) => r.order || 0)) + 1
    setNewOpen(false); setNewName('')
    createRoom(n, order, user.uid).then(() => showToast(`اتعملت غرفة «${n}»`)).catch(() => showToast('مقدرناش نعمل الغرفة'))
  }
  const unreadNotifs = useUnreadNotifs(user.uid)
  const [lastAt, setLastAt] = useState({})
  const onLast = (id, t) => setLastAt((m) => (m[id] === t ? m : { ...m, [id]: t }))

  let list = rooms || []
  if (tab === 'members') list = list.filter((r) => r.owner)
  else if (tab !== 'mine') list = list.filter((r) => !r.owner)
  if (tab === 'active') list = [...list].sort((a, b) => (lastAt[b.id] || 0) - (lastAt[a.id] || 0))
  if (tab === 'mine') { const mine = profile.rooms || []; list = list.filter((r) => mine.includes(r.id)) }
  if (q.trim()) list = list.filter((r) => r.name.includes(q.trim()))

  return (
    <main className="screen">
      <header className="head head-col">
        <div className="head-row">
          <h1 className="h-big">غرف الدردشة</h1>
          <Link to="/notifications" aria-label={unreadNotifs ? 'الإشعارات، فيه جديد' : 'الإشعارات'} className="circle-btn">
            <Bell size={22} />{unreadNotifs > 0 && <span className="red-dot" aria-hidden="true" />}
          </Link>
          <Link to="/profile" aria-label="الملف الشخصي" className="circle-btn circle-gold"><User size={22} /></Link>
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="ابحث عن غرفة" />
        <div className="tabs-row">
          <Tabs tabs={[['all', 'الكل'], ['active', 'الأكثر نشاطًا'], ['members', '🏠 غرف الأعضاء'], ['mine', 'غرفي']]} value={tab} onChange={setTab} />
          {iAdmin && <button type="button" className="tab tab-add" onClick={() => setNewOpen(true)}>+ غرفة جديدة</button>}
        </div>
      </header>

      {myBan && <p className="ban-banner">حسابك اتحظر من الأدمن — تقدر تقرا بس</p>}
      <div className="kemet-bg list">
        <IosInstallCard />
        <PushPrompt showToast={showToast} />
        {tab === 'all' && !q.trim() && <><StarBanner /><FirstTasks showToast={showToast} /><Newcomers showToast={showToast} /><VoiceCard /></>}
        {error && <p className="empty">مقدرناش نجيب الغرف. اتأكد من النت وجرب تاني.</p>}
        {!error && rooms === null && <p className="empty">بيحمّل الغرف...</p>}
        {tab === 'members' && !guest && (myRoom
          ? <Link to={`/rooms/${myRoom.id}`} className="card my-room-cta">🏠 ادخل غرفتك «{myRoom.name}» وادعي صحابك</Link>
          : <button type="button" className="card my-room-cta" onClick={() => setMyOpen(true)}>🏠 اعمل غرفتك باسمك وادعي صحابك — انت مشرفها</button>)}
        {tab === 'members' && guest && <p className="empty">سجّل حسابك علشان تعمل غرفتك 🏠</p>}
        {list.map((r) => <RoomCard key={r.id} room={r} onLast={onLast} />)}
        {rooms && list.length === 0 && (
          <p className="empty">{tab === 'members' && !q.trim() ? 'لسه محدش عمل غرفة — كن أول واحد!' : tab === 'mine' && !q.trim() ? 'لسه مادخلتش أي غرفة' : rooms.length ? 'مفيش غرف بالاسم ده' : 'مفيش غرف لسه'}</p>
        )}
      </div>

      <BottomNav />

      {newOpen && (
        <Sheet onClose={() => setNewOpen(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">غرفة جديدة</h2>
          <p className="sheet-sub">الغرفة هتظهر لكل الأعضاء على طول.</p>
          <form className="new-room" onSubmit={(e) => { e.preventDefault(); addRoom() }}>
            <input className="input" placeholder="اسم الغرفة" maxLength={30} value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            <button type="submit" className="btn-primary">اعمل الغرفة</button>
          </form>
        </Sheet>
      )}
      {myOpen && (
        <Sheet onClose={() => setMyOpen(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">🏠 اعمل غرفتك</h2>
          <p className="sheet-sub">غرفة واحدة باسمك، وانت مشرفها: تثبّت إعلان، وتكتم أو تطرد اللي يضايق. لو فضيت أسبوع بتتقفل لوحدها.</p>
          <form className="new-room" onSubmit={(e) => { e.preventDefault(); makeMyRoom() }}>
            <input className="input" placeholder="مثلًا: قعدة كريم" maxLength={30} value={myName} onChange={(e) => setMyName(e.target.value)} autoFocus />
            <button type="submit" className="btn-primary" disabled={myBusy}>{myBusy ? 'لحظة...' : 'اعمل الغرفة'}</button>
          </form>
        </Sheet>
      )}
      {toast}
    </main>
  )
}
