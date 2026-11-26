// 🔴 اللايفات الشغالة دلوقتي + ابدأ لايف (للمضيفين المعتمدين)
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Back } from '../components/Icons.jsx'
import { Avatar, Sheet, useToast } from '../components/ui.jsx'
import { useAuth } from '../auth.jsx'
import { isAdminUid } from '../roles.js'
import { useAvatar } from '../dm.js'
import { colorIndex } from '../rooms.js'
import { useLives, startLive, LIVE_CATS, LIVE_RULES } from '../live.js'
import { isGuest } from '../auth.jsx'
import { useLiveTop } from '../party.js'
import { PkBoard } from '../components/Pk.jsx'
import { ar } from '../utils.js'

// مربع اللايف: صورة المضيف كبيرة، ونوعه، وعدد المتفرجين، و«جديد» أو «🔥 الأعلى»
function LiveTile({ l, top }) {
  const src = useAvatar(l.host)
  return (
    <Link to={`/live/${l.id}`} className="lv-tile">
      {src ? <img src={src} alt="" /> : <span className="lv-ph"><Avatar text={(l.hostName || '؟').charAt(0)} c={colorIndex(l.host)} size={72} round /></span>}
      <span className="lv-cat">{LIVE_CATS[l.cat] || LIVE_CATS.chat}</span>
      {top ? <span className="lv-badge lv-top">🔥 الأعلى الساعة دي</span> : l.fresh ? <span className="lv-badge lv-new">🌱 جديد</span> : null}
      <span className="lv-live"><i />LIVE</span>
      <span className="lv-foot"><b>{l.hostName}</b><small>{l.title}</small><span className="lv-v">👁 {ar(l.viewers || 0)}</span></span>
    </Link>
  )
}

// محتوى اللايفات (بيتعرض في صفحة اللايف، وفي قسم «🔴 لايف» في صفحة الغرف)
export function LivesPanel({ showToast }) {
  // بنحمّل مكتبة الفيديو من دلوقتي علشان اللايف يفتح أسرع لما تدوس عليه
  useEffect(() => { const t = setTimeout(() => { import('livekit-client').catch(() => {}) }, 1200); return () => clearTimeout(t) }, [])
  const { user, profile, roles } = useAuth()
  const navigate = useNavigate()
  const lives = useLives()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [cat, setCat] = useState('chat')
  const [filter, setFilter] = useState('')
  const top = useLiveTop()
  const topId = Object.entries(top).sort((a, b) => b[1] - a[1])[0]?.[0]
  const shown = (lives || []).filter((l) => !filter || (l.cat || 'chat') === filter).sort((a, b) => (b.id === topId) - (a.id === topId) || (b.viewers || 0) - (a.viewers || 0))
  const admin = isAdminUid(roles, user.uid)
  const canHost = !isGuest(user, profile)
  const [rules, setRules] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const begin = () => (admin || profile?.livePledge || agreed ? setOpen(true) : setRules(true))
  const go = () => {
    setBusy(true)
    startLive(title.trim(), cat, agreed).then((r) => navigate(`/live/${r.id}`)).catch((e) => showToast(e?.response?.message || 'مقدرناش نبدأ اللايف')).finally(() => setBusy(false))
  }
  return (
    <>
        {canHost
          ? <button type="button" className="card my-room-cta" onClick={begin}>🎥 ابدأ لايف دلوقتي</button>
          : <p className="online-foot">سجّل حسابك علشان تقدر تفتح لايف 🎥</p>}
        {lives?.length > 0 && (
          <div className="tabs lv-cats">
            {[['', 'الكل'], ...Object.entries(LIVE_CATS)].map(([k, lbl]) => <button key={k} type="button" className={`tab ${filter === k ? 'tab-on' : ''}`} onClick={() => setFilter(k)}>{lbl}</button>)}
          </div>
        )}
        {lives === null && <p className="empty">بيحمّل...</p>}
        {lives?.length === 0 && <p className="empty">مفيش لايف دلوقتي 🌙</p>}
        {lives?.length > 0 && shown.length === 0 && <p className="empty">مفيش لايف من النوع ده دلوقتي</p>}
        {shown.length > 0 && <div className="lv-grid">{shown.map((l) => <LiveTile key={l.id} l={l} top={l.id === topId} />)}</div>}
        <div className="card top-sups"><PkBoard /></div>
      {rules && (
        <Sheet onClose={() => setRules(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">📜 قواعد اللايف</h2>
          <p className="sheet-sub">قبل أول لايف ليك لازم توافق على القواعد دي. اللايف بيتشاف من ناس كتير، فخليك محترم.</p>
          <ul className="lv-rules">{LIVE_RULES.map((x) => <li key={x}>{x}</li>)}</ul>
          <button type="button" className="btn-primary" onClick={() => { setAgreed(true); setRules(false); setOpen(true) }}>✅ موافق، يلا نبدأ</button>
        </Sheet>
      )}
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">🎥 ابدأ لايف</h2>
          <p className="sheet-sub">الكاميرا والمايك هيشتغلوا، وأي حد يقدر يتفرج ويعلّق ويبعت هدايا. خليك محترم — أي بلاغ ممكن يقفل اللايف والحساب.</p>
          <form className="new-room" onSubmit={(e) => { e.preventDefault(); go() }}>
            <input className="input" placeholder="عنوان اللايف (مثلًا: سهرة وأغاني)" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="lv-pick">{Object.entries(LIVE_CATS).map(([k, lbl]) => <button key={k} type="button" className={`pill-btn ${cat === k ? 'pill-gold' : ''}`} onClick={() => setCat(k)}>{lbl}</button>)}</div>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'لحظة...' : '🔴 ابدأ'}</button>
          </form>
        </Sheet>
      )}
    </>
  )
}

export default function Lives() {
  const [toast, showToast] = useToast()
  return (
    <main className="screen">
      <header className="head head-row">
        <Link to="/rooms" aria-label="رجوع" className="icon-btn"><Back /></Link>
        <h1 className="h-mid">🔴 لايف</h1>
      </header>
      <div className="kemet-bg list list-tight">
        <LivesPanel showToast={showToast} />
      </div>
      {toast}
    </main>
  )
}
