import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Back } from '../components/Icons.jsx'
import { Avatar, Crown, Tabs, useToast } from '../components/ui.jsx'
import { useAuth } from '../auth.jsx'
import { useUser } from '../dm.js'
import { colorIndex, useRooms, renameRoom, removeRoom } from '../rooms.js'
import { ago } from '../notifs.js'
import { isAdminUid, useAdminList, appBan, appUnban, deleteReport, setMod } from '../roles.js'
import { useFilter, saveFilter, hasBadWord } from '../filter.js'
import { loadStats } from '../stats.js'
import RoomPhotoButton from '../components/RoomPhotoButton.jsx'
import { ar } from '../utils.js'

function Name({ uid, fallback }) {
  const u = useUser(uid)
  return <>{u?.name || fallback || '...'}</>
}


const n = (x) => (x == null ? '—' : ar(x))

function Stats({ roles }) {
  const { rooms } = useRooms()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pick, setPick] = useState(null)
  const refresh = () => {
    if (!rooms) return
    setBusy(true)
    loadStats(rooms).then(setData).catch(() => setData(null)).finally(() => setBusy(false))
  }
  useEffect(refresh, [rooms?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <p className="empty">{busy || !rooms ? 'بيحسب الإحصائيات...' : 'مقدرناش نجيب الإحصائيات'}</p>

  const mods = new Set(Object.values(roles.mods || {}).flat()).size
  const max = Math.max(1, ...data.daily.map((d) => d.count))
  const roomMax = Math.max(1, ...data.rooms.map((r) => r.today))
  const shown = pick ?? 6
  const dayName = (d, i) => (i === 6 ? 'النهارده' : i === 5 ? 'أمس' : d.toLocaleDateString('ar-EG', { weekday: 'short' }))

  return (
    <>
      <div className="stat-grid">
        <div className="card stat"><span className="stat-label">الأعضاء</span><b className="stat-num">{n(data.members)}</b>
          <span className="stat-sub">{n(data.newToday)} جديد النهارده · {n(data.newWeek)} الأسبوع ده</span></div>
        <div className="card stat"><span className="stat-label">متصلين دلوقتي</span><b className="stat-num stat-on">{n(data.online)}</b>
          <span className="stat-sub">في آخر ٥ دقايق</span></div>
        <div className="card stat"><span className="stat-label">رسايل الغرف النهارده</span><b className="stat-num">{n(data.today)}</b>
          <span className="stat-sub">{n(data.daily.reduce((a, d) => a + d.count, 0))} في آخر ٧ أيام</span></div>
        <div className="card stat"><span className="stat-label">بلاغات مفتوحة</span><b className={`stat-num ${data.reports ? 'stat-warn' : ''}`}>{n(data.reports)}</b>
          <span className="stat-sub">{n(data.bans)} محظور من التطبيق</span></div>
        <div className="card stat"><span className="stat-label">الغرف</span><b className="stat-num">{n(rooms.length)}</b>
          <span className="stat-sub">{n(mods)} مشرف</span></div>
      </div>

      <div className="card admin-card">
        <span className="row-title">رسايل الغرف — آخر ٧ أيام</span>
        <span className="chart-readout">{dayName(data.daily[shown].day, shown)}: <b>{n(data.daily[shown].count)}</b> رسالة</span>
        <div className="bars" role="img" aria-label={`رسايل آخر ٧ أيام: ${data.daily.map((d) => d.count).join('، ')}`}>
          {data.daily.map((d, i) => (
            <button key={i} type="button" className={`bar-col ${shown === i ? 'bar-on' : ''}`}
              onClick={() => setPick(i)} onMouseEnter={() => setPick(i)} aria-label={`${dayName(d.day, i)}: ${d.count} رسالة`}>
              <span className="bar-track"><span className="bar" style={{ height: `${Math.max(d.count ? 4 : 0, (d.count / max) * 100)}%` }} /></span>
              <span className="bar-day">{dayName(d.day, i)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card admin-card">
        <span className="row-title">أنشط الغرف النهارده</span>
        {data.rooms.map((r) => (
          <div key={r.id} className="hbar">
            <span className="hbar-name">{r.name}</span>
            <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(r.today / roomMax) * 100}%` }} /></span>
            <span className="hbar-val">{n(r.today)}</span>
          </div>
        ))}
      </div>

      <div className="card admin-card">
        <span className="row-title">أنشط الأعضاء النهارده</span>
        {data.topMembers.length === 0 && <span className="row-time">محدش كتب في الغرف النهارده لسه</span>}
        {data.topMembers.map((m, i) => (
          <Link key={m.uid} to={`/u/${m.uid}`} className="top-member">
            <span className="top-rank">{ar(i + 1)}</span>
            <span className="top-name">{m.name}</span>
            <span className="hbar-val">{n(m.count)} رسالة</span>
          </Link>
        ))}
      </div>

      <p className="admin-hint stat-foot">
        الرسايل الخاصة مش محسوبة، لأنها سرية بين الأعضاء وحتى الأدمن مايقدرش يشوفها.
        <br />آخر تحديث: {data.at.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })}
        <button type="button" className="pill-btn stat-refresh" onClick={refresh} disabled={busy}>{busy ? 'بيحسب...' : '↻ تحديث'}</button>
      </p>
    </>
  )
}

function Reports({ me, showToast }) {
  const reports = useAdminList('reports')
  const bans = useAdminList('bans')
  const banned = new Set((bans || []).map((b) => b.id))
  if (reports === null) return <p className="empty">بيحمّل...</p>
  if (!reports.length) return <p className="empty">مفيش بلاغات 🎉</p>
  return reports.map((r) => (
    <div key={r.id} className="card admin-card">
      <div className="admin-row">
        <Avatar text={(r.reportedName || '؟').charAt(0)} c={colorIndex(r.reported)} size={44} round />
        <div className="row-body">
          <span className="row-title">{r.reportedName || 'عضو'}</span>
          <span className="admin-reason">{r.reason}</span>
          <span className="row-time">بلّغ عنه <Name uid={r.reporter} /> · {ago(r.when)}</span>
        </div>
      </div>
      <div className="mod-tools">
        {banned.has(r.reported)
          ? <span className="status-muted">محظور من التطبيق</span>
          : <button type="button" className="pill-btn pill-danger" onClick={() => appBan(r.reported, r.reportedName, r.reason, me)
              .then(() => showToast(`اتحظر ${r.reportedName} من التطبيق`)).catch(() => showToast('حصلت مشكلة'))}>حظر من التطبيق</button>}
        <Link to={`/dm/${r.reported}`} className="pill-btn pill-link">كلّمه خاص</Link>
        <button type="button" className="pill-btn" onClick={() => deleteReport(r.id).then(() => showToast('اتشال البلاغ')).catch(() => showToast('حصلت مشكلة'))}>تجاهل</button>
      </div>
    </div>
  ))
}

function Mods({ roles, me, myName, showToast }) {
  const { rooms } = useRooms()
  return (
    <>
      <p className="admin-hint">علشان تعيّن مشرف: ادخل الغرفة ← دوس 👥 فوق ← «خليه مشرف» جنب اسمه.</p>
      {(rooms || []).map((room) => {
        const roomId = room.id
        const mods = roles.mods?.[roomId] || []
        return (
          <div key={roomId} className="card admin-card">
            <div className="row-line">
              <Link to={`/rooms/${roomId}`} className="row-title admin-room">{room.name}</Link>
              <span className="row-time">{mods.length ? `${mods.length} مشرف` : 'مفيش مشرفين'}</span>
            </div>
            {mods.map((uid) => (
              <div key={uid} className="admin-mod">
                <span><Name uid={uid} /></span>
                <button type="button" className="pill-btn" onClick={() => setMod(roomId, uid, false, me, myName, room.name)
                  .then(() => showToast('اتشال الإشراف')).catch(() => showToast('حصلت مشكلة'))}>شيل</button>
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}

function Rooms({ showToast }) {
  const { rooms } = useRooms()
  const [editing, setEditing] = useState(null)
  const [val, setVal] = useState('')
  const [confirm, setConfirm] = useState(null)
  if (rooms === null) return <p className="empty">بيحمّل...</p>
  return (
    <>
      <p className="admin-hint">علشان تعمل غرفة جديدة: صفحة الغرف ← «+ غرفة جديدة».</p>
      {rooms.map((r) => (
        <div key={r.id} className="card admin-card">
          {editing === r.id ? (
            <form className="admin-rename" onSubmit={(e) => {
              e.preventDefault()
              if (!val.trim()) return
              setEditing(null)
              renameRoom(r.id, val).then(() => showToast('اتغيّر الاسم')).catch(() => showToast('حصلت مشكلة'))
            }}>
              <input className="input" value={val} maxLength={30} onChange={(e) => setVal(e.target.value)} autoFocus />
              <button type="submit" className="pill-btn pill-gold">حفظ</button>
              <button type="button" className="pill-btn" onClick={() => setEditing(null)}>إلغاء</button>
            </form>
          ) : (
            <div className="row-line">
              <Link to={`/rooms/${r.id}`} className="row-title admin-room admin-room-name">
                <Avatar text={r.name.replace(/^غرفة /, '').replace(/^ال/, '').charAt(0)} c={(r.order || 1) - 1} size={36} src={r.photo || undefined} />
                {r.name}
              </Link>
              <div className="mod-tools admin-room-tools">
                <button type="button" className="pill-btn" onClick={() => { setEditing(r.id); setVal(r.name) }}>تغيير الاسم</button>
                <button type="button" className="pill-btn pill-danger" onClick={() => {
                  if (confirm !== r.id) { setConfirm(r.id); return }
                  setConfirm(null)
                  removeRoom(r.id).then(() => showToast(`اتمسحت «${r.name}»`)).catch(() => showToast('حصلت مشكلة'))
                }}>{confirm === r.id ? 'متأكد؟' : 'مسح'}</button>
              </div>
            </div>
          )}
          {editing !== r.id && (
            <div className="mod-tools"><RoomPhotoButton room={r} showToast={showToast} /></div>
          )}
        </div>
      ))}
    </>
  )
}

function Words({ showToast }) {
  const words = useFilter()
  const [val, setVal] = useState('')
  const [test, setTest] = useState('')
  function save(list, msg) {
    saveFilter(list).then(() => showToast(msg)).catch(() => showToast('حصلت مشكلة'))
  }
  function add(e) {
    e.preventDefault()
    const parts = val.split(/[،,\n]/).map((w) => w.trim()).filter(Boolean)
    if (!parts.length) return
    setVal('')
    save([...words, ...parts], parts.length > 1 ? `اتضافت ${parts.length} كلمات` : 'الكلمة اتضافت')
  }
  return (
    <>
      <p className="admin-hint">
        أي رسالة فيها كلمة من دول مش هتتبعت (في الغرف والخاص). الفلتر بيمسك المطّ (كـــلمة)، والمسافات بين الحروف،
        واختلاف ا/أ/إ و ه/ة و ي/ى، والبدايات زي «يا» و«ال». تقدر تكتب كذا كلمة مفصولين بفاصلة.
      </p>
      <form className="card admin-card words-add" onSubmit={add}>
        <input className="input" placeholder="كلمة ممنوعة..." value={val} onChange={(e) => setVal(e.target.value)} />
        <button type="submit" className="pill-btn pill-gold">إضافة</button>
      </form>
      <div className="card admin-card">
        <span className="row-time">{words.length ? `${words.length} كلمة ممنوعة` : 'مفيش كلمات ممنوعة لسه'}</span>
        <div className="words">
          {words.map((w) => (
            <span key={w} className="word-chip">
              {w}
              <button type="button" aria-label={`شيل ${w}`} onClick={() => save(words.filter((x) => x !== w), 'الكلمة اتشالت')}>✕</button>
            </span>
          ))}
        </div>
      </div>
      <div className="card admin-card">
        <span className="row-title">جرّب الفلتر</span>
        <input className="input" placeholder="اكتب رسالة تجريبية..." value={test} onChange={(e) => setTest(e.target.value)} />
        {test.trim() && (hasBadWord(test, words)
          ? <span className="status-muted">🚫 الرسالة دي هتتمنع</span>
          : <span className="status-on">✓ الرسالة دي هتتبعت عادي</span>)}
      </div>
    </>
  )
}

function Bans({ showToast }) {
  const bans = useAdminList('bans')
  if (bans === null) return <p className="empty">بيحمّل...</p>
  if (!bans.length) return <p className="empty">مفيش حد محظور من التطبيق</p>
  return bans.map((b) => (
    <div key={b.id} className="card admin-card">
      <div className="admin-row">
        <Avatar text={(b.name || '؟').charAt(0)} c={colorIndex(b.id)} size={44} round />
        <div className="row-body">
          <span className="row-title">{b.name || 'عضو'}</span>
          {b.reason && <span className="admin-reason">{b.reason}</span>}
          <span className="row-time">{ago(b.when)}</span>
        </div>
        <button type="button" className="pill-btn" onClick={() => appUnban(b.id).then(() => showToast(`اتلغى حظر ${b.name}`)).catch(() => showToast('حصلت مشكلة'))}>إلغاء الحظر</button>
      </div>
    </div>
  ))
}

export default function Admin() {
  const { user, profile, roles } = useAuth()
  const [tab, setTab] = useState('stats')
  const [toast, showToast] = useToast()
  if (!roles.loaded) return <main className="screen" />
  if (!isAdminUid(roles, user.uid)) return <Navigate to="/settings" replace />

  return (
    <main className="screen">
      <header className="head head-col head-tight">
        <div className="head-row">
          <Link to="/settings" aria-label="رجوع" className="icon-btn"><Back /></Link>
          <h1 className="h-mid admin-title"><Crown size={22} />لوحة الأدمن</h1>
        </div>
        <div className="tabs-pad">
          <Tabs tabs={[['stats', 'الإحصائيات'], ['reports', 'البلاغات'], ['rooms', 'الغرف'], ['mods', 'المشرفين'], ['words', 'الكلمات الممنوعة'], ['bans', 'المحظورين']]} value={tab} onChange={setTab} />
        </div>
      </header>
      <div className="kemet-bg list list-tight">
        {tab === 'stats' && <Stats roles={roles} />}
        {tab === 'reports' && <Reports me={user.uid} showToast={showToast} />}
        {tab === 'mods' && <Mods roles={roles} me={user.uid} myName={profile.name} showToast={showToast} />}
        {tab === 'rooms' && <Rooms showToast={showToast} />}
        {tab === 'words' && <Words showToast={showToast} />}
        {tab === 'bans' && <Bans showToast={showToast} />}
      </div>
      {toast}
    </main>
  )
}
