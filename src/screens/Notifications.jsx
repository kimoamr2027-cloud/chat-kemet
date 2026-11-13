import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Back, NOTIF_ICONS } from '../components/Icons.jsx'
import { Avatar, Tabs } from '../components/ui.jsx'
import { notifications } from '../data.js'

const BADGE = { reply: '#1F5A75', dm: '#8A5A1C', mention: '#6A3A7E', react: '#B3261E', mod: '#2F6B3A', room: '#6B6259' }

export default function Notifications() {
  const [tab, setTab] = useState('all')
  const [read, setRead] = useState(false)
  const items = notifications.filter((n) => tab === 'all' || n.cat === tab)

  return (
    <main className="screen">
      <header className="head head-col head-tight">
        <div className="head-row">
          <Link to="/rooms" aria-label="رجوع" className="icon-btn"><Back /></Link>
          <h1 className="h-mid">الإشعارات</h1>
          <button type="button" className="text-btn" onClick={() => setRead(true)}>قراءة الكل</button>
        </div>
        <div className="tabs-pad">
          <Tabs tabs={[['all', 'الكل'], ['mentions', 'الإشارات'], ['dms', 'الخاص'], ['rooms', 'الغرف']]} value={tab} onChange={setTab} />
        </div>
      </header>

      <div className="kemet-bg list list-tight">
        {items.map((n) => {
          const unread = n.unread && !read
          return (
            <Link key={n.id} to={n.to} className={`card notif ${unread ? 'notif-new' : ''}`}>
              <div className="avatar-wrap">
                <Avatar text={n.who.charAt(0)} c={n.t} size={48} round={n.type !== 'room'} />
                <span className="notif-badge" style={{ background: BADGE[n.type] }} aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={NOTIF_ICONS[n.type]} /></svg>
                </span>
              </div>
              <div className="row-body">
                <span className="notif-text"><b>{n.who}</b> {n.action}</span>
                {n.quote && <span className="row-sub">{n.quote}</span>}
                <span className="row-time">{n.time}</span>
              </div>
              {unread && <span className="new-dot" aria-label="جديد" />}
            </Link>
          )
        })}
        {items.length === 0 && <p className="empty">مفيش إشعارات هنا دلوقتي</p>}
      </div>
    </main>
  )
}
