import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Back, NOTIF_ICONS } from '../components/Icons.jsx'
import { Avatar, Tabs, useToast } from '../components/ui.jsx'
import { useAuth } from '../auth.jsx'
import { useNotifications, markAllRead, markNotifRead, notifTarget, notifAction, ago } from '../notifs.js'
import { colorIndex } from '../rooms.js'

const BADGE = { reply: '#1F5A75', dm: '#8A5A1C', mention: '#6A3A7E', react: '#B3261E', mod: '#2F6B3A' }
const CATS = { reply: 'mentions', mention: 'mentions', react: 'mentions', dm: 'dms', mod: 'mentions' }

export default function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const list = useNotifications(user.uid)
  const [toast, showToast] = useToast()
  const items = (list || []).filter((n) => tab === 'all' || CATS[n.type] === tab)

  function open(n) {
    if (!n.read) markNotifRead(user.uid, n.id)
    navigate(notifTarget(n))
  }

  return (
    <main className="screen">
      <header className="head head-col head-tight">
        <div className="head-row">
          <Link to="/rooms" aria-label="رجوع" className="icon-btn"><Back /></Link>
          <h1 className="h-mid">الإشعارات</h1>
          <button type="button" className="text-btn" onClick={() => markAllRead(user.uid, list || []).catch(() => showToast('حصلت مشكلة، جرب تاني'))}>قراءة الكل</button>
        </div>
        <div className="tabs-pad">
          <Tabs tabs={[['all', 'الكل'], ['mentions', 'الردود والإشارات'], ['dms', 'الخاص']]} value={tab} onChange={setTab} />
        </div>
      </header>

      <div className="kemet-bg list list-tight">
        {list === null && <p className="empty">بيحمّل...</p>}
        {items.map((n) => (
          <button key={n.id} type="button" className={`card notif notif-btn ${!n.read ? 'notif-new' : ''}`} onClick={() => open(n)}>
            <div className="avatar-wrap">
              <Avatar text={n.fromName.charAt(0)} c={colorIndex(n.from)} size={48} round />
              <span className="notif-badge" style={{ background: BADGE[n.type] }} aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={NOTIF_ICONS[n.type]} /></svg>
              </span>
            </div>
            <div className="row-body">
              <span className="notif-text"><b>{n.fromName}</b> {notifAction(n)}</span>
              {n.text && <span className="row-sub">{n.text}</span>}
              <span className="row-time">{ago(n.at)}</span>
            </div>
            {!n.read && <span className="new-dot" aria-label="جديد" />}
          </button>
        ))}
        {list && items.length === 0 && (
          <p className="empty">مفيش إشعارات هنا لسه.<br />لما حد يرد عليك أو يذكر اسمك بـ @ أو يبعتلك خاص هتلاقيه هنا.</p>
        )}
      </div>
      {toast}
    </main>
  )
}
