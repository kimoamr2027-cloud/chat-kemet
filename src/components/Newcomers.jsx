// صفحة الغرف: نجم الأسبوع، ومهام أول أسبوع، و«مين جديد النهارده»
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from './ui.jsx'
import { Coin } from './Coins.jsx'
import { useAuth } from '../auth.jsx'
import { useAvatar } from '../dm.js'
import { colorIndex } from '../rooms.js'
import { useStar } from '../star.js'
import { useTribeOf } from '../tribes.js'
import { pb } from '../pb/client.js'
import { ar } from '../utils.js'

// ===== نجم الأسبوع =====
export function StarBanner() {
  const star = useStar()
  if (!star) return null
  return (
    <Link to={`/u/${star.uid}`} className="star-banner">
      <span className="star-ic" aria-hidden="true">🔥</span>
      <span><b>نجم الأسبوع: {star.name}</b><small>أنشط واحد في الغرف الأسبوع اللي فات ({ar(star.n)} رسالة)</small></span>
    </Link>
  )
}

// ===== مهام أول أسبوع =====
const TASKS = {
  msg: ['💬', 'ابعت أول رسالة في غرفة', '/rooms/pyramids'],
  game: ['🎲', 'العب أول لعبة للآخر', '/games'],
  dm: ['✉️', 'كلّم حد خاص', '/online'],
  avatar: ['📷', 'حط صورة لبروفايلك', '/profile'],
  invite: ['🤝', 'ادعي صاحب يسجّل', '/settings'],
}
const HIDE = 'kemet-tasks-hide'
export function FirstTasks({ showToast }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState('')
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDE) === '1' } catch { return false } })
  const load = () => pb.send('/api/kemet/tasks', { method: 'GET' }).then(setData).catch(() => {})
  useEffect(() => { if (!hidden) load() }, [user?.uid, hidden]) // eslint-disable-line react-hooks/exhaustive-deps
  if (hidden || !data || data.expired) return null
  const open = data.tasks.filter((t) => !t.claimed && !t.locked)
  if (!open.length) return null
  const doneN = data.tasks.filter((t) => t.claimed).length
  const claim = (t) => {
    setBusy(t.key)
    pb.send('/api/kemet/tasks/claim', { method: 'POST', body: { task: t.key } })
      .then(() => { showToast?.(`🎉 خدت ${ar(t.coins)} كوين`); load() })
      .catch((e) => showToast?.(e?.response?.message || 'حصلت مشكلة، جرب تاني'))
      .finally(() => setBusy(''))
  }
  return (
    <div className="card tasks-card">
      <div className="tasks-head">
        <b>🎯 مهام أول أسبوع</b>
        <small>{ar(doneN)} من {ar(data.tasks.length)} · فاضل {ar(data.daysLeft)} {data.daysLeft > 2 ? 'أيام' : 'يوم'}</small>
        <button type="button" className="tasks-x" aria-label="اخفي المهام" onClick={() => { setHidden(true); try { localStorage.setItem(HIDE, '1') } catch {} }}>✕</button>
      </div>
      {data.tasks.map((t) => {
        const [ic, label, to] = TASKS[t.key] || ['•', t.key, '/rooms']
        return (
          <div key={t.key} className={`task-row ${t.claimed ? 'task-done' : ''}`}>
            <span className="task-ic" aria-hidden="true">{t.claimed ? '✅' : ic}</span>
            <span className="task-label">{label}<small><Coin size="sm" /> {ar(t.coins)}</small></span>
            {t.claimed ? <span className="task-st">تمام</span>
              : t.locked ? <span className="task-st">🔒 للمسجّلين</span>
              : t.done ? <button type="button" className="pill-btn pill-gold" disabled={busy === t.key} onClick={() => claim(t)}>خد الكوينز</button>
              : <Link to={to} className="pill-btn">يلا</Link>}
          </div>
        )
      })}
    </div>
  )
}

// ===== مين جديد النهارده =====
function Newbie({ n, onWelcome, busy }) {
  const src = useAvatar(n.uid)
  return (
    <div className="newbie">
      <Link to={`/u/${n.uid}`} className="newbie-face">
        <Avatar text={(n.name || '؟').charAt(0)} c={colorIndex(n.uid)} size={52} round src={src || undefined} uid={n.uid} />
      </Link>
      <span className="newbie-name">{n.name}</span>
      {n.welcomed ? <span className="newbie-done">✓ رحّبت</span>
        : <button type="button" className="newbie-btn" disabled={busy} onClick={() => onWelcome(n)}>👋 رحّب</button>}
    </div>
  )
}
export function Newcomers({ showToast }) {
  const { user } = useAuth()
  const [list, setList] = useState(null)
  const [busy, setBusy] = useState('')
  useEffect(() => {
    let alive = true
    const load = () => pb.send('/api/kemet/newcomers', { method: 'GET' }).then((r) => alive && setList(r)).catch(() => {})
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 120000)
    return () => { alive = false; clearInterval(t) }
  }, [user?.uid])
  if (!list?.length) return null
  const welcome = (n) => {
    setBusy(n.uid)
    pb.send('/api/kemet/notify', { method: 'POST', body: { to: n.uid, type: 'welcome' } })
      .then(() => { setList((l) => l.map((x) => (x.uid === n.uid ? { ...x, welcomed: true } : x))); showToast?.(`👋 رحّبت بـ ${n.name}`) })
      .catch((e) => showToast?.(e?.response?.message || 'حصلت مشكلة، جرب تاني'))
      .finally(() => setBusy(''))
  }
  return (
    <div className="card newcomers">
      <div className="newcomers-head"><b>👋 جداد النهارده</b><small>رحّب بيهم علشان يحسّوا إنهم في بيتهم</small></div>
      <div className="newcomers-row">
        {list.map((n) => <Newbie key={n.uid} n={n} busy={busy === n.uid} onWelcome={welcome} />)}
      </div>
    </div>
  )
}

// ===== القبايل =====
export function TribeBanner() {
  const { user } = useAuth()
  const tribe = useTribeOf(user?.uid)
  return (
    <Link to="/tribes" className="tribe-banner">
      <span className="star-ic" aria-hidden="true">{tribe ? tribe.icon : '🏺'}</span>
      <span><b>{tribe ? `قبيلتك: ${tribe.name}` : 'القبايل 🏺 انضم لقبيلتك'}</b><small>{tribe ? 'شوف ترتيب الأسبوع وكسّب قبيلتك نقط' : 'القبيلة الأولى كل أسبوع أعضاؤها ياخدوا كوينز'}</small></span>
      <span className="tribe-go" aria-hidden="true">‹</span>
    </Link>
  )
}
