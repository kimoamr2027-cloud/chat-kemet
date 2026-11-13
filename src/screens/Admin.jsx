import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Back } from '../components/Icons.jsx'
import { Avatar, Crown, Tabs, useToast } from '../components/ui.jsx'
import { useAuth } from '../auth.jsx'
import { useUser } from '../dm.js'
import { colorIndex, useRooms, renameRoom, removeRoom } from '../rooms.js'
import { ago } from '../notifs.js'
import { isAdminUid, useAdminList, appBan, appUnban, deleteReport, setMod } from '../roles.js'

function Name({ uid, fallback }) {
  const u = useUser(uid)
  return <>{u?.name || fallback || '...'}</>
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
              <Link to={`/rooms/${r.id}`} className="row-title admin-room">{r.name}</Link>
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
        </div>
      ))}
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
  const [tab, setTab] = useState('reports')
  const [toast, showToast] = useToast()
  if (!isAdminUid(roles, user.uid)) return <Navigate to="/settings" replace />

  return (
    <main className="screen">
      <header className="head head-col head-tight">
        <div className="head-row">
          <Link to="/settings" aria-label="رجوع" className="icon-btn"><Back /></Link>
          <h1 className="h-mid admin-title"><Crown size={22} />لوحة الأدمن</h1>
        </div>
        <div className="tabs-pad">
          <Tabs tabs={[['reports', 'البلاغات'], ['rooms', 'الغرف'], ['mods', 'المشرفين'], ['bans', 'المحظورين']]} value={tab} onChange={setTab} />
        </div>
      </header>
      <div className="kemet-bg list list-tight">
        {tab === 'reports' && <Reports me={user.uid} showToast={showToast} />}
        {tab === 'mods' && <Mods roles={roles} me={user.uid} myName={profile.name} showToast={showToast} />}
        {tab === 'rooms' && <Rooms showToast={showToast} />}
        {tab === 'bans' && <Bans showToast={showToast} />}
      </div>
      {toast}
    </main>
  )
}
