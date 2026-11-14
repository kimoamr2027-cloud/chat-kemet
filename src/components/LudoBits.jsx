// قطع لودو كيمت: القطعة (صورة البروفايل)، النرد، كارت الدعوة، ترتيب الأسبوع
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useUser } from '../dm.js'
import { useAuth } from '../auth.jsx'
import { Sheet } from './ui.jsx'
import { ar } from '../utils.js'
import { COLOR_HEX, colorIdx, useTable, useLudoBoard, joinTable } from '../ludo.js'

const SOFT = ['#FFD5CF', '#CFF5D8', '#FFF0BF', '#CFE2FF']

// القطعة: صورة صاحبها جوه دايرة بلونه
export function Pin({ uid, name, off = 0, tail = true, glow = false, size, className = '', onClick, badge }) {
  const u = useUser(uid)
  const ci = colorIdx(off)
  const src = u?.avatar
  return (
    <span className={`lpin ${tail ? '' : 'lpin-flat'} ${glow ? 'lpin-glow' : ''} ${className}`}
      style={{ '--c': COLOR_HEX[ci], '--bgc': SOFT[ci], ...(size ? { width: size, height: size } : {}) }}
      onClick={onClick} role={onClick ? 'button' : undefined}>
      <span className="lpin-face">{src ? <img src={src} alt="" /> : <b>{(name || u?.name || '؟').charAt(0)}</b>}</span>
      {badge > 1 && <span className="lpin-badge">{ar(badge)}</span>}
    </span>
  )
}

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
export function Dice({ n, rolling, small }) {
  const show = n || 6
  return (
    <span className={`ldice ${rolling ? 'ldice-roll' : ''} ${small ? 'ldice-sm' : ''} ${n ? '' : 'ldice-idle'}`} aria-label={n ? `النرد ${n}` : 'النرد'}>
      {Array.from({ length: 9 }, (_, i) => <span key={i} className={PIPS[show].includes(i) ? 'ldot' : ''} />)}
    </span>
  )
}

// كارت الدعوة جوه الشات (الغرف والخاص)
export function LudoInvite({ table: id }) {
  const t = useTable(id)
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  if (t === undefined) return <div className="linvite linvite-loading">🎲 ترابيزة لودو...</div>
  if (t === null) return <div className="linvite linvite-off">🎲 ترابيزة لودو اتقفلت</div>
  const seated = t.seats.includes(user.uid)
  const free = t.size - t.seats.length
  const sit = async () => {
    setBusy(true)
    try { await joinTable(id, user.uid, profile.name); navigate(`/ludo/${id}`) } catch { setBusy(false) }
  }
  return (
    <div className="linvite">
      <div className="linvite-top">
        <span className="linvite-ic">🎲</span>
        <div className="linvite-t">
          <b>ترابيزة {t.hostName} · {t.size === 2 ? '١ ضد ١' : `${ar(t.size)} لاعبين`}</b>
          <small>{t.status === 'waiting' ? (free === 1 ? 'فاضل كرسي واحد' : `فاضل ${ar(free)} كراسي`)
            : t.status === 'playing' ? 'اللعب شغال دلوقتي' : `🏆 ${t.winnerName} كسب`}</small>
        </div>
      </div>
      <div className="linvite-seats">
        {Array.from({ length: t.size }, (_, i) => (
          <span key={i} className={`linvite-seat ${t.seats[i] ? '' : 'free'}`}>
            {t.seats[i] ? <Pin uid={t.seats[i]} name={t.names[t.seats[i]]} off={t.colors[i]} tail={false} /> : <i>+</i>}
            <small>{t.seats[i] ? t.names[t.seats[i]] : 'فاضي'}</small>
          </span>
        ))}
      </div>
      {t.status === 'waiting' && !seated
        ? <button type="button" className="lbtn lbtn-orange" disabled={busy} onClick={sit}>{busy ? 'لحظة...' : 'اقعد والعب'}</button>
        : <button type="button" className="lbtn lbtn-orange" onClick={() => navigate(`/ludo/${id}`)}>{seated ? 'ادخل الترابيزة' : t.status === 'playing' ? 'اتفرّج' : 'شوف الترابيزة'}</button>}
    </div>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']
export function LudoBoardSheet({ onClose, me }) {
  const list = useLudoBoard(true)
  return (
    <Sheet onClose={onClose}>
      <span className="grabber" aria-hidden="true" />
      <h2 className="sheet-title">🏆 أبطال لودو الأسبوع</h2>
      <p className="sheet-sub">كل مكسب بنقطة، والترتيب بيبدأ من جديد كل أسبوع.</p>
      {list === null ? <p className="game-hint">بيحمّل...</p> : list.length === 0 ? (
        <p className="game-hint">لسه محدش كسب الأسبوع ده. كن أول بطل! 💪</p>
      ) : (
        <ol className="board">
          {list.map((s, i) => (
            <li key={s.uid} className={`board-row ${s.uid === me ? 'board-me' : ''}`}>
              <span className="board-rank">{MEDALS[i] || ar(i + 1)}</span>
              <span className="board-name">{s.name}{s.uid === me ? ' (انت)' : ''}</span>
              <span className="board-pts">{ar(s.wins)} {s.wins === 1 ? 'مكسب' : 'مكاسب'}</span>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  )
}
