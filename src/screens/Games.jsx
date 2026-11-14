// صالة الألعاب: لودو كيمت (والباقي جاي)
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { Sheet, useToast } from '../components/ui.jsx'
import { Pin, LudoBoardSheet } from '../components/LudoBits.jsx'
import { useAuth } from '../auth.jsx'
import { useRooms } from '../rooms.js'
import { useChats, useUser } from '../dm.js'
import { ar } from '../utils.js'
import { logDiag } from '../diag.js'
import {
  useOpenTables, useMyTables, useLudoBoard, createTable, joinTable, inviteRoom, inviteDM, GAME_NAMES,
} from '../ludo.js'

function TableRow({ t, me, onSit, mine }) {
  const ic = t.kind === 'snakes' ? '🐍' : '🎲'
  const free = t.size - t.seats.length
  return (
    <div className="lrow">
      <Pin uid={t.host} name={t.hostName} off={0} tail={false} />
      <div className="lrow-b">
        <b>{mine ? (t.status === 'playing' ? `${ic} لعبتك شغالة` : '⏳ مستني لاعبين') : `${ic} ترابيزة ${t.hostName}`}</b>
        <small>{t.roomName ? `${t.roomName} · ` : ''}{t.size === 2 ? '١ ضد ١' : `${ar(t.size)} لاعبين`}{t.status === 'waiting' ? ` · فاضل ${free === 1 ? 'كرسي' : `${ar(free)} كراسي`}` : ''}</small>
      </div>
      <button type="button" className="lbtn lbtn-orange lbtn-sm" onClick={() => onSit(t)}>{mine || t.seats.includes(me) ? 'ادخل' : 'اقعد'}</button>
    </div>
  )
}

function FriendRow({ uid, onPick }) {
  const u = useUser(uid)
  if (!u) return null
  return (
    <button type="button" className="lfriend" onClick={() => onPick(uid, u.name)}>
      <Pin uid={uid} name={u.name} off={26} tail={false} />
      <span>{u.name}</span>
      <i>تحدّي 🎲</i>
    </button>
  )
}

export default function Games() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  // اللعبة المختارة (لودو أو السلم والتعبان) بتتفتكر
  const [game, setGameRaw] = useState(() => { try { return localStorage.getItem('kemet-game') === 'snakes' ? 'snakes' : 'ludo' } catch { return 'ludo' } })
  const setGame = (g) => { setGameRaw(g); try { localStorage.setItem('kemet-game', g) } catch {} }
  const open = useOpenTables(game)
  const mineL = useMyTables(user.uid, 'ludo')
  const mineS = useMyTables(user.uid, 'snakes')
  const mine = [...mineL, ...mineS]
  const board = useLudoBoard(true, game)
  const { rooms } = useRooms()
  const { chats } = useChats(user.uid)
  const [toast, showToast] = useToast()
  const [sheet, setSheet] = useState(null)
  const [size, setSize] = useState(4)
  const [room, setRoom] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef(null)

  const myRank = board ? board.findIndex((s) => s.uid === user.uid) : -1
  const myWins = board?.[myRank]?.wins || 0
  const myRooms = rooms || []
  const friends = useMemo(() => (chats || []).map((c) => c.members.find((m) => m !== user.uid)).filter(Boolean).slice(0, 30), [chats, user.uid])
  const others = (open || []).filter((t) => !t.seats.includes(user.uid))

  async function newTable() {
    setBusy(true)
    try {
      const r = myRooms.find((x) => x.id === room)
      const id = await createTable({ uid: user.uid, name: profile.name, size, room: r?.id || '', roomName: r?.name || '', kind: game })
      if (r) await inviteRoom(r.id, profile, user.uid, id, size, game).catch((e) => logDiag('ludo.inviteRoom', e))
      navigate(`/${game}/${id}`)
    } catch (e) {
      logDiag('ludo.create', e)
      showToast('مقدرناش نفتح الترابيزة، جرب تاني')
      setBusy(false)
    }
  }
  async function challenge(uid, name) {
    setBusy(true)
    try {
      const id = await createTable({ uid: user.uid, name: profile.name, size: 2, kind: game })
      await inviteDM(user.uid, profile.name, uid, id, game).catch((e) => logDiag('ludo.inviteDM', e) || showToast(`${name} قافل الخاص، ابعتله الدعوة من الغرفة`))
      navigate(`/${game}/${id}`)
    } catch {
      showToast('مقدرناش نفتح الترابيزة، جرب تاني')
      setBusy(false)
    }
  }
  async function sit(t) {
    if (t.seats.includes(user.uid)) return navigate(`/${t.kind}/${t.id}`)
    try { await joinTable(t.id, user.uid, profile.name, t.kind); navigate(`/${t.kind}/${t.id}`) } catch (e) { logDiag('ludo.joinHub', e); showToast('الترابيزة كملت أو اتقفلت') }
  }

  return (
    <main className="screen games-screen">
      <div className="g-scroll" ref={listRef}>
        <div className="g-top">
          <Pin uid={user.uid} name={profile.name} off={13} tail={false} className="g-me" onClick={() => navigate('/profile')} />
          <span className="g-chip" onClick={() => setSheet('board')} role="button">🏆 {myRank >= 0 ? `ترتيبك: ${ar(myRank + 1)}` : 'الترتيب'}</span>
          <span className="g-chip">⭐ {ar(myWins)} {myWins === 1 ? 'مكسب' : 'مكاسب'}</span>
        </div>
        {game === 'ludo'
          ? <div className="g-logo" aria-label="لودو كيمت"><b><span>L</span><span>U</span><span>D</span><span>O</span></b><small>لودو كيمت</small></div>
          : <div className="g-logo g-logo-sn" aria-label="السلم والتعبان"><b>🐍🪜</b><small>السلم والتعبان</small></div>}

        <div className="g-cards">
          <button type="button" className="g-card g-c1" onClick={() => setSheet('new')}>
            <span className="g-art"><span className="g-bigdice">{[0, 2, 3, 5, 6, 8].map((i) => <i key={i} style={{ gridArea: `${Math.floor(i / 3) + 1}/${(i % 3) + 1}` }} />)}</span></span>
            <b>٢ و ٤ لاعبين</b>
          </button>
          <button type="button" className="g-card g-c2" onClick={() => setSheet('friend')}>
            <span className="g-art g-vs"><Pin uid={user.uid} name={profile.name} off={0} /><em>VS</em><span className="g-q">?</span></span>
            <b>تحدّي صاحبك</b>
          </button>
        </div>
        <div className="g-cards g-small">
          <button type="button" className="g-card g-c3" onClick={() => setSheet('board')}><span className="g-emo">🏆</span><b>ترتيب الأسبوع</b></button>
          <button type="button" className="g-card g-c4" onClick={() => listRef.current?.querySelector('.g-tables')?.scrollIntoView({ behavior: 'smooth' })}><span className="g-emo">🪑</span><b>ترابيزات مفتوحة</b></button>
          <button type="button" className="g-card g-c5" onClick={() => setSheet('rules')}><span className="g-emo">📜</span><b>قواعد اللعب</b></button>
        </div>
        <div className="g-tabs">
          <span className={game === 'ludo' ? 'on' : ''} role="button" onClick={() => setGame('ludo')}><i>🎲</i>لودو</span>
          <span className={game === 'snakes' ? 'on' : ''} role="button" onClick={() => setGame('snakes')}><i>🐍</i>السلم والتعبان</span>
          <span role="button" onClick={() => setSheet('quiz')}><i>🎬</i>مسابقة كيمت</span>
        </div>

        {mine.length > 0 && (
          <section className="g-tables">
            <h3>ترابيزاتي</h3>
            {mine.map((t) => <TableRow key={t.id} t={t} me={user.uid} mine onSit={sit} />)}
          </section>
        )}
        <section className="g-tables">
          <h3>ترابيزات مفتوحة دلوقتي</h3>
          {open === null ? <p className="g-empty">بيحمّل...</p>
            : others.length === 0 ? <p className="g-empty">مفيش ترابيزات مفتوحة دلوقتي. افتح انت واحدة واعزم صحابك! 🎲</p>
            : others.map((t) => <TableRow key={t.id} t={t} me={user.uid} onSit={sit} />)}
        </section>
      </div>
      <BottomNav />

      {sheet === 'new' && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">{game === 'snakes' ? '🐍' : '🎲'} ترابيزة {GAME_NAMES[game]} جديدة</h2>
          <p className="sheet-sub">اختار عدد اللاعبين، ولو حابب ننزّل دعوة في غرفة علشان الناس تقعد معاك.</p>
          <div className="game-counts" role="radiogroup" aria-label="عدد اللاعبين">
            {[[2, '١ ضد ١'], [4, '٤ لاعبين']].map(([n, l]) => (
              <button key={n} type="button" role="radio" aria-checked={size === n} className={`game-opt game-count ${size === n ? 'on' : ''}`} onClick={() => setSize(n)}>{l}</button>
            ))}
          </div>
          <p className="game-label">ابعت الدعوة في غرفة</p>
          <div className="l-rooms">
            <button type="button" className={`game-opt ${room === '' ? 'on' : ''}`} onClick={() => setRoom('')}>من غير دعوة</button>
            {myRooms.map((r) => (
              <button key={r.id} type="button" className={`game-opt ${room === r.id ? 'on' : ''}`} onClick={() => setRoom(r.id)}>{r.name}</button>
            ))}
          </div>
          <button type="button" className="btn-primary" disabled={busy} onClick={newTable}>{busy ? 'لحظة...' : 'افتح الترابيزة'}</button>
        </Sheet>
      )}
      {sheet === 'friend' && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">⚔️ تحدّي صاحبك</h2>
          <p className="sheet-sub">هنفتح ترابيزة ١ ضد ١ ونبعتله الدعوة في الخاص. وتقدر كمان تتحدّى أي حد من بروفايله.</p>
          {friends.length === 0 ? <p className="game-hint">لسه مكلمتش حد في الخاص. افتح بروفايل أي عضو ودوس «العب لودو معاه».</p>
            : <div className="lfriends">{friends.map((uid) => <FriendRow key={uid} uid={uid} onPick={(u, n) => !busy && challenge(u, n)} />)}</div>}
        </Sheet>
      )}
      {sheet === 'board' && <LudoBoardSheet me={user.uid} kind={game} onClose={() => setSheet(null)} />}
      {sheet === 'rules' && game === 'snakes' && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">📜 قواعد السلم والتعبان</h2>
          <ul className="g-rules">
            <li>🎲 كل لاعب بيرمي النرد وقطعته بتمشي بعدد النقط، وأول واحد يوصل لخانة <b>١٠٠</b> يكسب.</li>
            <li>🪜 لو وقفت على أول <b>السلم</b> بتطلع لآخره.</li>
            <li>🐍 لو وقفت على راس <b>التعبان</b> بتنزل لديله.</li>
            <li>6️⃣ الـ٦ بتديك دور كمان.</li>
            <li>🎯 لازم توصل ١٠٠ بالظبط، لو الرقم أكبر بتفضل مكانك.</li>
            <li>⏱ لكل دور ٤٥ ثانية، ولو اتأخرت دورك بيعدّي.</li>
          </ul>
        </Sheet>
      )}
      {sheet === 'rules' && game === 'ludo' && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">📜 قواعد لودو كيمت</h2>
          <ul className="g-rules">
            <li>🎲 كل لاعب معاه ٤ قطع، وأول واحد يوصّل الأربعة لنص اللوحة يكسب.</li>
            <li>6️⃣ لازم تجيب <b>٦</b> علشان تطلّع قطعة من البيت، والـ٦ بتديك دور كمان.</li>
            <li>💥 لو وقفت على قطعة خصم بتضربها وترجعها البيت، وتلعب تاني.</li>
            <li>⭐ المربعات اللي عليها نجمة وخانات الخروج <b>أمان</b>، محدش يتضرب فيها.</li>
            <li>👆 لو عندك أكتر من قطعة تتحرك، القطع اللي ينفع تمشي بتنوّر، دوس على واحدة.</li>
            <li>⏱ لكل دور ٤٥ ثانية، ولو اتأخرت دورك بيعدّي.</li>
            <li>🏆 كل مكسب بيتحسب في ترتيب الأسبوع.</li>
          </ul>
        </Sheet>
      )}
      {sheet === 'quiz' && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">🎬 مسابقة كيمت</h2>
          <ul className="g-rules">
            <li>المسابقة بتتلعب <b>جوه الغرف</b> مع كل اللي موجودين.</li>
            <li>الأدمن أو مشرف الغرفة بيبدأها: يدخل الغرفة ← <b>«الأعضاء»</b> ← <b>«🎮 ابدأ مسابقة»</b>.</li>
            <li>السؤال بيظهر فوق في الغرفة، وأول واحد يكتب الإجابة الصح في الشات ياخد نقطة.</li>
            <li>أنواع الأسئلة: خمّن الفيلم بالإيموجي، الكلمة المخفية، كمّل المثل، وأسئلة عن مصر.</li>
          </ul>
          <button type="button" className="btn-primary" onClick={() => navigate('/rooms')}>روح للغرف</button>
        </Sheet>
      )}
      {toast}
    </main>
  )
}
