// خانة «المتصلين»: مين متصل دلوقتي وفي أنهي غرفة — تكلمه خاص، أو تدخل الغرفة معاه، أو تبعتله دعوة لغرفة
import { isBot } from '../bots.js'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { Avatar, SearchBox, Sheet, UserName, useToast } from '../components/ui.jsx'
import { useAuth } from '../auth.jsx'
import { isAdminUid } from '../roles.js'
import { useOnlineList, useUserPresence, ONLINE_MS, serverNow } from '../presence.js'
import { useFriends, friendAct } from '../social.js'
import { Tabs } from '../components/ui.jsx'
import { ago } from '../notifs.js'
import { useAvatar, useUser } from '../dm.js'
import { useRooms, colorIndex } from '../rooms.js'
import { pb } from '../pb/client.js'
import { ar } from '../utils.js'

function Person({ p, room, admin, onInvite }) {
  const src = useAvatar(p.uid)
  const navigate = useNavigate()
  return (
    <div className="card online-row">
      <button type="button" className="online-who" onClick={() => navigate(`/u/${p.uid}`)}>
        <span className="avatar-wrap">
          <Avatar text={(p.name || '؟').charAt(0)} c={colorIndex(p.uid)} size={48} round src={src || undefined} uid={p.uid} />
          <span className="online-dot" aria-label="متصل" />
        </span>
        <span className="row-body">
          <span className="row-title"><UserName name={p.name || '...'} role={admin ? 'admin' : null} uid={p.uid} /></span>
          <span className="row-sub">{room ? `في ${room.name}` : 'متصل دلوقتي'}</span>
        </span>
      </button>
      <div className="online-acts">
        <Link to={`/dm/${p.uid}`} className="pill-btn pill-link">💬 خاص</Link>
        {isBot(p.uid) ? <span className="online-bot">🤖 بوت بيرد على أسئلتك عن الشات</span> : <>
          {room && <Link to={`/rooms/${room.id}`} className="pill-btn pill-gold">ادخل معاه</Link>}
          <button type="button" className={`pill-btn ${room ? '' : 'pill-gold'}`} onClick={() => onInvite(p)}>{room ? '📨 ادعيه' : '📨 ادعيه لغرفة'}</button>
        </>}
      </div>
    </div>
  )
}

// صاحب في قايمة «أصحابي»: متصل ولا آخر ظهور، وخاص
function Friend({ f, admin, onAccept, onDecline }) {
  const src = useAvatar(f.other)
  const seen = useUserPresence(f.other)
  const navigate = useNavigate()
  const { user } = useAuth()
  const name = useFriendName(f.other)
  return (
    <div className="card online-row">
      <button type="button" className="online-who" onClick={() => navigate(`/u/${f.other}`)}>
        <span className="avatar-wrap">
          <Avatar text={(name || '؟').charAt(0)} c={colorIndex(f.other)} size={48} round src={src || undefined} uid={f.other} />
          {seen.online && <span className="online-dot" aria-label="متصل" />}
        </span>
        <span className="row-body">
          <span className="row-title"><UserName name={name || '...'} role={admin ? 'admin' : null} uid={f.other} /></span>
          <span className="row-sub">{f.status !== 'ok' ? (f.mine ? '⏳ مستني يقبل طلبك' : '🤝 بعتلك طلب صداقة') : seen.online ? '🟢 متصل دلوقتي' : seen.at ? `آخر ظهور ${ago(new Date(seen.at))}` : ''}</span>
        </span>
      </button>
      <div className="online-acts">
        {f.status === 'ok' && <Link to={`/dm/${f.other}`} className="pill-btn pill-gold">💬 خاص</Link>}
        {f.status !== 'ok' && !f.mine && <button type="button" className="pill-btn pill-gold" onClick={() => onAccept(f)}>✅ قبول</button>}
        {f.status !== 'ok' && <button type="button" className="pill-btn" onClick={() => onDecline(f)}>{f.mine ? 'إلغاء الطلب' : 'رفض'}</button>}
      </div>
    </div>
  )
}
function useFriendName(uid) { const u = useUser(uid); return u?.name || '' }

export default function Online() {
  const { user, roles, privacy } = useAuth()
  const list = useOnlineList(true)
  const { rooms } = useRooms()
  const mine = useUserPresence(user.uid)
  const [q, setQ] = useState('')
  const [inviting, setInviting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, showToast] = useToast()
  const [tab, setTab] = useState('online')
  const friends = useFriends(user.uid)
  const reqs = (friends || []).filter((f) => f.status !== 'ok' && !f.mine).length
  const friendsSorted = [...(friends || [])].sort((a, b) => (a.status === 'ok') - (b.status === 'ok'))
  const fAct = (f, action, ok) => friendAct(f.other, action).then(() => showToast(ok)).catch((e) => showToast(e?.response?.message || 'حصلت مشكلة'))

  const blocked = privacy?.blocked || {}
  const roomOf = (p) => (p.room && serverNow() - p.roomAt < ONLINE_MS ? (rooms || []).find((r) => r.id === p.room) : null)
  const people = (list || []).filter((p) => p.uid !== user.uid && !blocked[p.uid] && (!q.trim() || (p.name || '').includes(q.trim())))
    .sort((a, b) => isBot(b.uid) - isBot(a.uid))
  const humans = people.filter((p) => !isBot(p.uid)).length
  // الغرفة اللي انا فيها الأول في قايمة الدعوة
  const myRoom = mine.room
  const pickRooms = [...(rooms || [])].sort((a, b) => (b.id === myRoom) - (a.id === myRoom))

  function invite(room) {
    const p = inviting
    setBusy(true)
    pb.send('/api/kemet/notify', { method: 'POST', body: { to: p.uid, type: 'invite', roomId: room.id } })
      .then(() => { showToast(`📨 بعتنا لـ ${p.name} دعوة لـ ${room.name}`); setInviting(null) })
      .catch((e) => showToast(e?.response?.message || 'مقدرناش نبعت الدعوة، جرب تاني'))
      .finally(() => setBusy(false))
  }

  return (
    <main className="screen">
      <header className="head head-col">
        <h1 className="h-big">المتصلين دلوقتي{list ? ` (${ar(humans)})` : ''}</h1>
        <Tabs tabs={[['online', 'المتصلين'], ['friends', reqs ? `أصحابي (${ar(reqs)} طلب)` : 'أصحابي']]} value={tab} onChange={setTab} />
        {tab === 'online' && <SearchBox value={q} onChange={setQ} placeholder="ابحث عن عضو" />}
      </header>

      {tab === 'friends' ? (
        <div className="kemet-bg list list-tight">
          {friends === null && <p className="empty">بيحمّل...</p>}
          {friends?.length === 0 && <p className="empty">لسه مالكش أصحاب 🤝<br />افتح بروفايل أي حد ودوس «أضف صديق»، ولما يدخل الشات هيوصلك إشعار.</p>}
          {friendsSorted.map((f) => <Friend key={f.id} f={f} admin={isAdminUid(roles, f.other)} onAccept={(x) => fAct(x, 'accept', '🎉 بقيتوا أصحاب')} onDecline={(x) => fAct(x, 'remove', 'تمام')} />)}
        </div>
      ) : (
      <div className="kemet-bg list list-tight">
        {list === null && <p className="empty">بيحمّل...</p>}
        {list && humans === 0 && <p className="empty">{q.trim() ? 'مفيش حد متصل بالاسم ده' : 'محدش متصل غيرك دلوقتي 🌙'}<br />ابعت لينك الدعوة لصحابك من الإعدادات.</p>}
        {people.map((p) => <Person key={p.uid} p={p} room={roomOf(p)} admin={isAdminUid(roles, p.uid)} onInvite={setInviting} />)}
        {list && <p className="online-foot">اللي قافل «يظهر إني متصل» من الإعدادات مش بيظهر هنا.</p>}
      </div>
      )}

      {inviting && (
        <Sheet onClose={() => setInviting(null)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">ادعي {inviting.name} لغرفة</h2>
          <p className="sheet-sub">هيوصله إشعار «بيدعوك تدخل الغرفة»، ولو دوس عليه يدخلها على طول.</p>
          <div className="online-rooms">
            {pickRooms.map((r) => (
              <button key={r.id} type="button" className="online-room" disabled={busy} onClick={() => invite(r)}>
                <Avatar text={r.name.replace(/^غرفة /, '').replace(/^ال/, '').charAt(0)} c={(r.order || 1) - 1} size={36} src={r.photo || undefined} />
                <span>{r.name}{r.id === myRoom && <small> · انت فيها</small>}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {toast}
      <BottomNav />
    </main>
  )
}
