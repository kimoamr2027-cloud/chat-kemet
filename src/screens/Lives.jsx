// 🔴 اللايفات الشغالة دلوقتي + ابدأ لايف (للمضيفين المعتمدين)
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Back } from '../components/Icons.jsx'
import { Avatar, Sheet, useToast } from '../components/ui.jsx'
import { useAuth } from '../auth.jsx'
import { isAdminUid } from '../roles.js'
import { useAvatar } from '../dm.js'
import { colorIndex } from '../rooms.js'
import { useLives, startLive } from '../live.js'
import { PkBoard } from '../components/Pk.jsx'
import { ar } from '../utils.js'

function LiveRow({ l }) {
  const src = useAvatar(l.host)
  return (
    <Link to={`/live/${l.id}`} className="card live-row">
      <span className="live-av"><Avatar text={(l.hostName || '؟').charAt(0)} c={colorIndex(l.host)} size={56} round src={src || undefined} uid={l.host} /><i className="live-dot">لايف</i></span>
      <span className="row-body"><b className="row-title">{l.title}</b><small className="row-sub">{l.hostName} · 👁 {ar(l.viewers || 0)} بيتفرجوا</small></span>
    </Link>
  )
}

export default function Lives() {
  const { user, profile, roles } = useAuth()
  const navigate = useNavigate()
  const lives = useLives()
  const [toast, showToast] = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const canHost = !!profile?.liveHost || isAdminUid(roles, user.uid)
  const go = () => {
    setBusy(true)
    startLive(title.trim()).then((r) => navigate(`/live/${r.id}`)).catch((e) => showToast(e?.response?.message || 'مقدرناش نبدأ اللايف')).finally(() => setBusy(false))
  }
  return (
    <main className="screen">
      <header className="head head-row">
        <Link to="/rooms" aria-label="رجوع" className="icon-btn"><Back /></Link>
        <h1 className="h-mid">🔴 لايف</h1>
      </header>
      <div className="kemet-bg list list-tight">
        {canHost
          ? <button type="button" className="card my-room-cta" onClick={() => setOpen(true)}>🎥 ابدأ لايف دلوقتي</button>
          : <p className="online-foot">اللايف للمضيفين المعتمدين (١٨ سنة وفوق). عايز تبقى مضيف؟ كلّم الأدمن.</p>}
        {lives === null && <p className="empty">بيحمّل...</p>}
        {lives?.length === 0 && <p className="empty">مفيش لايف دلوقتي 🌙</p>}
        {lives?.map((l) => <LiveRow key={l.id} l={l} />)}
        <div className="card top-sups"><PkBoard /></div>
      </div>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">🎥 ابدأ لايف</h2>
          <p className="sheet-sub">الكاميرا والمايك هيشتغلوا، وأي حد يقدر يتفرج ويعلّق ويبعت هدايا. خليك محترم — أي بلاغ ممكن يقفل اللايف والحساب.</p>
          <form className="new-room" onSubmit={(e) => { e.preventDefault(); go() }}>
            <input className="input" placeholder="عنوان اللايف (مثلًا: سهرة وأغاني)" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'لحظة...' : '🔴 ابدأ'}</button>
          </form>
        </Sheet>
      )}
      {toast}
    </main>
  )
}
