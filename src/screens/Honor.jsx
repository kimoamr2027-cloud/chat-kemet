// 🏆 لوحة الشرف: الأغنى (بعتوا هدايا) + النجوم (استلموا) + أنشط الغرف — النهارده والأسبوع ده
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Back } from '../components/Icons.jsx'
import { Avatar, Tabs } from '../components/ui.jsx'
import { useAvatar } from '../dm.js'
import { colorIndex } from '../rooms.js'
import { useAuth } from '../auth.jsx'
import { ar } from '../utils.js'
import { useHonor } from '../party.js'

const fmt = (n) => (n >= 10000 ? `${ar(Math.round(n / 100) / 10)}k` : ar(n))

function Face({ uid, name, size }) {
  const src = useAvatar(uid)
  return <Avatar text={(name || '؟').charAt(0)} c={colorIndex(uid)} size={size} round src={src || undefined} uid={uid} />
}

function Podium({ top, unit }) {
  const order = [1, 0, 2] // التاني، الأول، التالت
  const medal = ['🥇', '🥈', '🥉']
  return (
    <div className="hn-podium">
      {order.map((k) => {
        const x = top[k]
        if (!x) return <span key={k} className="hn-pod hn-pod-empty" />
        const name = x.name
        return (
          <Link key={k} to={`/u/${x.uid}`} className={`hn-pod hn-pod-${k + 1}`}>
            {k === 0 && <span className="hn-crown">👑</span>}
            <span className="hn-ring"><Face uid={x.uid} name={name} size={k === 0 ? 76 : 60} /></span>
            <b>{medal[k]} {name}</b>
            <small>{unit} {fmt(x.n)}</small>
            <span className="hn-step">{ar(k + 1)}</span>
          </Link>
        )
      })}
    </div>
  )
}

export default function Honor() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [p, setP] = useState('day')
  const [kind, setKind] = useState('givers')
  const d = useHonor(p)
  const list = d ? d[kind] || [] : null
  const unit = kind === 'rooms' ? '💬' : '🪙'
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/rooms'))
  const mine = list && kind !== 'rooms' ? list.findIndex((x) => x.uid === user.uid) : -1
  return (
    <main className="screen">
      <header className="head head-col hn-head">
        <div className="head-row">
          <button type="button" aria-label="رجوع" className="icon-btn" onClick={back}><Back /></button>
          <h1 className="h-mid">🏆 لوحة الشرف</h1>
        </div>
        <Tabs tabs={[['day', 'النهارده'], ['week', 'الأسبوع ده']]} value={p} onChange={setP} />
      </header>
      <div className="kemet-bg list hn-list">
        <div className="hn-kinds">
          {[['givers', '💎 الأغنى'], ['takers', '⭐ النجوم'], ['rooms', '🔥 الغرف']].map(([k, l]) => (
            <button key={k} type="button" className={`hn-kind ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{l}</button>
          ))}
        </div>
        <p className="hn-hint">{kind === 'givers' ? 'اللي بعتوا هدايا أكتر' : kind === 'takers' ? 'اللي جالهم هدايا أكتر' : 'الغرف اللي فيها كلام أكتر'} {p === 'day' ? 'النهارده' : 'الأسبوع ده'}</p>
        {list === null && <p className="empty">بيحمّل...</p>}
        {list?.length === 0 && <p className="empty">لسه مفيش حد هنا {p === 'day' ? 'النهارده' : 'الأسبوع ده'} — كن الأول! 🔥</p>}
        {list && kind !== 'rooms' && list.length > 0 && <Podium top={list} unit={unit} />}
        {list && kind !== 'rooms' && list.slice(3).map((x, i) => (
          <Link key={x.uid} to={`/u/${x.uid}`} className={`card hn-row ${x.uid === user.uid ? 'hn-me' : ''}`}>
            <span className="hn-rank">{ar(i + 4)}</span>
            <Face uid={x.uid} name={x.name} size={40} />
            <b className="hn-name">{x.name}</b>
            <span className="hn-n">{unit} {fmt(x.n)}</span>
          </Link>
        ))}
        {list && kind === 'rooms' && [...list, ...(d.voice || []).map((v) => ({ ...v, voice: true }))].map((r, i) => (
          <Link key={r.id} to={r.voice ? `/voice/${r.id}` : `/rooms/${r.id}`} className="card hn-row">
            <span className="hn-rank">{i < 3 && !r.voice ? ['🥇', '🥈', '🥉'][i] : ar(i + 1)}</span>
            <Avatar text={(r.name || '؟').replace(/^غرفة /, '').charAt(0)} c={i} size={40} src={r.photo || undefined} />
            <b className="hn-name">{r.voice ? '🎙 ' : ''}{r.name}</b>
            <span className="hn-n">{r.voice ? `🎁 ${fmt(r.n)}` : `💬 ${fmt(r.n)}`}</span>
          </Link>
        ))}
        {list && kind !== 'rooms' && (
          <p className="hn-mine">{mine >= 0 ? `🎉 انت رقم ${ar(mine + 1)} ${p === 'day' ? 'النهارده' : 'الأسبوع ده'}!` : kind === 'givers' ? 'ابعت هدية في أي غرفة وادخل اللوحة 🎁' : 'اتكلم واتفاعل في الغرف علشان الناس تهاديك ⭐'}</p>
        )}
      </div>
    </main>
  )
}
