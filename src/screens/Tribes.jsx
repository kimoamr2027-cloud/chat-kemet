// القبايل: ترتيب الأسبوع، وانضم لقبيلتك
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Back } from '../components/Icons.jsx'
import { useToast } from '../components/ui.jsx'
import { useAuth, isGuest } from '../auth.jsx'
import { loadTribes, joinTribe } from '../tribes.js'
import { ar } from '../utils.js'
import { LiveMap } from '../components/Fun.jsx'

export default function Tribes() {
  const { user, profile } = useAuth()
  const guest = isGuest(user, profile)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState('')
  const [toast, showToast] = useToast()
  const load = () => loadTribes().then(setData).catch(() => setData((d) => d || { tribes: [] }))
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [])
  const max = Math.max(1, ...(data?.tribes || []).map((t) => t.points))
  const join = (t) => {
    if (guest) return showToast('سجّل حسابك الأول علشان تنضم لقبيلة')
    setBusy(t.id)
    joinTribe(t.id).then(() => { showToast(`${t.icon} انضميت لـ ${t.name}`); load() })
      .catch((e) => showToast(e?.response?.message || 'حصلت مشكلة، جرب تاني')).finally(() => setBusy(''))
  }
  return (
    <main className="screen">
      <header className="head head-row">
        <Link to="/rooms" aria-label="رجوع" className="icon-btn"><Back /></Link>
        <h1 className="h-mid">🏺 القبايل</h1>
      </header>
      <div className="scroll kemet-bg tribes-page">
        <p className="tribes-how">
          انضم لقبيلتك وكسّبها نقط: كل رسالة في الغرف بنقطة، وكل لعبة بتخلص بـ ٥، وكل صاحب تدعيه بـ ٢٠.
          كل اتنين القبيلة الأولى كل عضو نشيط فيها (كتب {ar(data?.activeMsgs || 10)} رسايل في الأسبوع) ياخد <b>{ar(data?.prize || 100)} كوين</b>.
        </p>
        <LiveMap tribes={data?.tribes} />
        {data?.last && <div className="tribes-last">🏆 كسبت الأسبوع اللي فات: <b>{data.last.icon} {data.last.name}</b> بـ {ar(data.last.points)} نقطة</div>}
        {!data && <p className="empty">بيحمّل...</p>}
        {data?.tribes.map((t, i) => {
          const mine = data.mine === t.id
          return (
            <div key={t.id} className={`card tribe-row ${mine ? 'tribe-mine' : ''}`}>
              <span className="tribe-rank">{i === 0 && t.points ? '👑' : ar(i + 1)}</span>
              <span className="tribe-ic" aria-hidden="true">{t.icon}</span>
              <div className="tribe-body">
                <b>{t.name}{mine && <small> · قبيلتك</small>}</b>
                <small>{t.desc}</small>
                <span className="tribe-bar"><span style={{ width: `${(t.points / max) * 100}%` }} /></span>
                <small>{ar(t.points)} نقطة الأسبوع ده · {ar(t.members)} عضو</small>
              </div>
              {!mine && (data.canChange || !data.mine) && (
                <button type="button" className="pill-btn pill-gold" disabled={busy === t.id} onClick={() => join(t)}>{data.mine ? 'انقل' : 'انضم'}</button>
              )}
            </div>
          )
        })}
        {data?.mine && !data.canChange && <p className="tribes-how">تقدر تغيّر قبيلتك مرة كل ١٤ يوم.</p>}
      </div>
      {toast}
    </main>
  )
}
