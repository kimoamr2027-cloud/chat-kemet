// مين زار بروفايلك (آخر ٣٠ يوم)
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Back } from '../components/Icons.jsx'
import { Avatar } from '../components/ui.jsx'
import { useAuth } from '../auth.jsx'
import { useAvatar } from '../dm.js'
import { colorIndex } from '../rooms.js'
import { ago } from '../notifs.js'
import { useVisitors, markVisitsSeen } from '../social.js'
import { ar } from '../utils.js'

function Row({ v }) {
  const src = useAvatar(v.uid)
  return (
    <Link to={`/u/${v.uid}`} className="card row-card">
      <Avatar text={(v.name || '؟').charAt(0)} c={colorIndex(v.uid)} size={48} round src={src || undefined} uid={v.uid} />
      <div className="row-body">
        <span className="row-title">{v.name}</span>
        <span className="row-sub">{v.at ? `زارك ${ago(v.at)}` : ''}{v.n > 1 ? ` · ${ar(v.n)} مرات` : ''}</span>
      </div>
    </Link>
  )
}

export default function Visitors() {
  const { user } = useAuth()
  const list = useVisitors(user.uid)
  useEffect(() => { markVisitsSeen() }, [])
  return (
    <main className="screen">
      <header className="head head-row">
        <Link to="/profile" aria-label="رجوع" className="icon-btn"><Back /></Link>
        <h1 className="h-mid">👀 مين زار بروفايلك</h1>
      </header>
      <div className="kemet-bg list list-tight">
        {list === null && <p className="empty">بيحمّل...</p>}
        {list?.length === 0 && <p className="empty">محدش زار بروفايلك لسه 🙈<br />حط صورة حلوة واكتب نبذة، وادخل الغرف واتكلم مع الناس.</p>}
        {list?.map((v) => <Row key={v.uid} v={v} />)}
        {list?.length > 0 && <p className="online-foot">الزيارات في آخر ٣٠ يوم. اللي قافل «يظهر إني متصل» زياراته مابتظهرش.</p>}
      </div>
    </main>
  )
}
