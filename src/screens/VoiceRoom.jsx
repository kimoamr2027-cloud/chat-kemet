import { useIsGuest, GuestWall } from '../components/Signup.jsx'
import { usePk, pkAct, pkRose, pkSideOf } from '../pk.js'
import { PkBar, PkResult, pkMark, SupportBoard } from '../components/Pk.jsx'
import { DayChest } from '../components/Fun.jsx'
import BottomNav from '../components/BottomNav.jsx'
// الغرفة الصوتية "الملوك القدماء" — شكل الدايرة:
// النص (مجلس العرش) للأدمن والمشرفين، والدايرة اللي برّه للأعضاء، واللي تحت بيسمعوا
// الصوت مباشر عن طريق LiveKit (على سيرفرنا)، والكلام والتفاعلات بتتبعت جوه الغرفة ومش بتتحفظ
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, Sheet, UserName, useToast } from '../components/ui.jsx'
import { isAdminUid } from '../roles.js'
import { useAuth } from '../auth.jsx'
import { useUser } from '../dm.js'
import { colorIndex } from '../rooms.js'
import { hasBadWord, useFilter } from '../filter.js'
import { logDiag } from '../diag.js'
import { ar } from '../utils.js'
import { useVoiceRoom, voiceAct, seatOf, REACTS, THROWS, THROWS_DAY } from '../voice.js'
import { useVoiceSession } from '../voiceSession.jsx'
import { GIFTS, GIFTS_ON, giftOf, sendGift, useGiftFeed, useGiftQueue } from '../gifts.js'
import GiftFX from '../components/GiftFX.jsx'
import { VipEntry } from '../components/Vip.jsx'
import { useWish, useWishDone, WishBar, SeatGot } from '../components/Wish.jsx'
import { closeParty, renameParty } from '../party.js'

import { useMyCoins, fmtCoins, Coin } from '../components/Coins.jsx'

function Face({ uid, name, size }) {
  const u = useUser(uid)
  return <Avatar text={(name || '؟').charAt(0)} c={colorIndex(uid)} size={size} round src={u?.avatar} uid={uid} />
}

// مكان كراسي الدايرة (٨ كراسي حوالين العرش، أولهم فوق)
const RING_POS = Array.from({ length: 8 }, (_, k) => {
  const a = (-90 + k * 45) * (Math.PI / 180)
  return { left: `${50 + 43 * Math.cos(a)}%`, top: `${50 + 43 * Math.sin(a)}%` }
})

function Seat({ s, side, locked, speaking, muted, hand, big, onTap, hits, mark, team, got }) {
  const talking = s && speaking && !muted
  return (
    <button type="button" className={`vs ${big ? 'vs-big' : ''} ${side === 'center' ? 'vs-royal' : ''} ${talking ? 'vs-talk' : ''} ${team ? `vs-team-${team}` : ''}`} onClick={onTap}>
      <span className="vs-av">
        {talking && <><i className="vs-wave" /><i className="vs-wave vs-wave2" /></>}
        {s ? <Face uid={s.uid} name={s.name} size={big ? 84 : side === 'center' ? 58 : 54} />
          : <span className="vs-empty">{locked ? '🔒' : side === 'center' ? '👑' : '+'}</span>}
        {s && muted && <i className="vs-mic vs-off">🔇</i>}
        {s && !muted && speaking && <i className="vs-mic vs-on">🔊</i>}
        {hand && <i className="vs-hand">✋</i>}
        {s && <SeatGot n={got} />}
        {mark === 'win' && <i className="vs-pkwin" aria-label="بطل التحدي">⚔️👑</i>}
        {mark === 'lose' && <i className="vs-pklose" aria-hidden="true">🍅</i>}
        {(hits || []).map((h) => <i key={h.id} className={`vs-hit ${h.e === '🍅' ? 'vs-splat' : 'vs-rose'}`} aria-hidden="true">{h.e}</i>)}
      </span>
      <span className="vs-nm">{s ? s.name : locked ? 'مقفول' : side === 'center' ? 'للمشرفين' : 'فاضي'}</span>
      {talking && <span className="vs-saying">🎙 بيتكلم...</span>}
    </button>
  )
}

// ✏️ صاحب الحفلة يغيّر اسمها
function PartyRename({ v, showToast }) {
  const [name, setName] = useState(v.name)
  const [busy, setBusy] = useState(false)
  return (
    <>
    <p className="rename-lbl">✏️ اسم الحفلة</p>
    <form className="rename-row" onSubmit={(e) => {
      e.preventDefault()
      setBusy(true)
      renameParty(v.id, name).then(() => showToast('✅ اتغيّر اسم الحفلة')).catch((err) => showToast(err?.response?.message || 'حصلت مشكلة')).finally(() => setBusy(false))
    }}>
      <input className="input" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} aria-label="اسم الحفلة" />
      <button type="submit" className="pill-btn pill-gold" disabled={busy || name.trim() === v.name}>غيّر الاسم</button>
    </form>
    </>
  )
}

export default function VoiceRoom() {
  const guest = useIsGuest()
  if (guest) return <main className="screen"><GuestWall icon="🎙🔒" title="الغرفة الصوتية للأعضاء المسجّلين" why="سجّل حسابك ببلاش في ثانية، وتقدر تتكلم وتسمع وتبعت هدايا" /><BottomNav /></main>
  return <VoiceRoomInner />
}

function VoiceRoomInner() {
  const { id = 'kings' } = useParams()
  const { user, profile, myBan, roles } = useAuth()
  const me = user.uid
  const navigate = useNavigate()
  const v = useVoiceRoom(id)
  const [toast, showToast] = useToast()
  // الصوت شغال من مكان عام (voiceSession) علشان يفضل شغال لو رحت أي شاشة تانية
  const { lk, sys, enter, exit } = useVoiceSession()
  useEffect(() => { enter(id) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  // الحفلة اتقفلت وانت جوه: نخرج من الصوت
  useEffect(() => { if (v === null) exit() }, [v === null]) // eslint-disable-line react-hooks/exhaustive-deps
  const { st } = lk
  const badWords = useFilter()
  const [draft, setDraft] = useState('')
  const [sheet, setSheet] = useState(null) // { kind: 'seat'|'person'|'topic'|'react', ... }
  const [topic, setTopic] = useState('')
  // الهدايا: أي هدية بتتبعت في الغرفة بتظهر للكل
  const gq = useGiftQueue()
  const wish = useWish(id)
  useWishDone(wish.w, showToast)
  useGiftFeed(id, (r) => { gq.push(r); wish.tick() })
  const { wallet, admin: iAdmin } = useMyCoins()
  const [giftTo, setGiftTo] = useState('')
  const [giftId, setGiftId] = useState(GIFTS[0].id)
  const [sending, setSending] = useState(false)
  const royal = st.royal
  const mySeat = seatOf(v, me)
  const iMuted = !!v?.muted?.[me]

  // اتنزّلت من الكرسي أو اتكتمت: المايك يتقفل
  useEffect(() => { if ((!mySeat || iMuted) && st.mic) lk.setMic(false).catch(() => {}) }, [!!mySeat, iMuted]) // eslint-disable-line react-hooks/exhaustive-deps

  const requests = useMemo(() => Object.entries(v?.hands || {}).map(([uid, h]) => ({ uid, ...h })).sort((a, b) => a.at - b.at), [v])
  const seenReq = useRef(null)
  useEffect(() => {
    const ids = requests.map((r) => r.uid)
    if (royal && seenReq.current) for (const r of requests) if (!seenReq.current.includes(r.uid)) showToast(`✋ ${r.name} طالب كرسي`)
    seenReq.current = ids
  }, [requests, royal]) // eslint-disable-line react-hooks/exhaustive-deps
  const seatedUids = useMemo(() => new Set(v ? [...v.seats.center, ...v.seats.ring].filter(Boolean).map((s) => s.uid) : []), [v])
  const listeners = st.people.filter((p) => !seatedUids.has(p.uid))
  // كل اللي في الغرفة (اللي بيسمعوا + اللي على الكراسي) — علشان شريط «منوّر» بتاع الـ VIP
  const roomPeople = useMemo(() => {
    const m = new Map(st.people.map((p) => [p.uid, p]))
    if (v) for (const s of [...v.seats.center, ...v.seats.ring]) if (s && !m.has(s.uid)) m.set(s.uid, { uid: s.uid, name: s.name })
    return [...m.values()]
  }, [st.people, v])
  const lines = [...sys.map((x) => ({ ...x, sys: true })), ...lk.chat].slice(-6)

  const pk = usePk(id)
  // ورد وطماطم: ٣٠ رمية في اليوم لكل واحد
  const throwAt = (uid, name, e) => {
    const k = `kemet-throws-${new Date().toISOString().slice(0, 10)}`
    let n = 0
    try { n = Number(localStorage.getItem(k)) || 0 } catch {}
    if (n >= THROWS_DAY) return showToast('خلصت رمياتك النهارده 😄 استنى لبكرة')
    try { localStorage.setItem(k, String(n + 1)) } catch {}
    lk.throwAt(uid, name, e)
    // وقت التحدي: الوردة على واحد من الاتنين بنقطة ليه
    if (e === '🌹' && pk.cur?.status === 'live' && pkSideOf(pk.cur, uid)) pkRose(pk.cur.id, uid)
    setSheet(null)
  }
  const act = (action, body, ok) => voiceAct(id, action, body).then(() => ok && showToast(ok)).catch((e) => showToast(e?.response?.message || e?.message || 'حصلت مشكلة'))

  async function toggleMic() {
    if (!mySeat) return showToast('اقعد على كرسي الأول علشان تتكلم 🎤')
    if (iMuted) return showToast('المشرف كاتم صوتك 🔇')
    if (!st.canPublish) { lk.reconnect(); return showToast('لحظة... بنجهّز المايك') }
    try { await lk.setMic(!st.mic) } catch (e) { logDiag('voice.mic', e); showToast('المايك مش شغال. اسمح للشات يستخدم المايك من إعدادات الموبايل') }
  }
  // اقعد على أول كرسي فاضي في الدايرة
  function sitAnywhere() {
    if (mySeat) return showToast('انت قاعد على كرسي بالفعل 🎤')
    if (myBan) return
    const i = v ? v.seats.ring.findIndex((s, k) => !s && !v.seats.locked.includes(k)) : -1
    if (i < 0) return showToast('مفيش كرسي فاضي دلوقتي')
    act('sit', { side: 'ring', seat: i }, '🎤 قعدت على الكرسي — دوس المايك علشان تتكلم')
  }
  function tapSeat(side, i) {
    const s = v.seats[side][i]
    const locked = side === 'ring' && v.seats.locked.includes(i)
    if (!s) {
      if (side === 'center' && !royal) return showToast('مجلس العرش للأدمن والمشرفين بس 👑')
      if (royal && side === 'ring') return setSheet({ kind: 'seat', side, i, locked })
      if (locked) return showToast('الكرسي ده مقفول 🔒')
      if (myBan) return
      if (side === 'center') return act('sit', { side, seat: i }, '👑 قعدت في مجلس العرش')
      // أي عضو يقعد على الكرسي الفاضي على طول
      return act('sit', { side, seat: i }, '🎤 قعدت على الكرسي — دوس المايك علشان تتكلم')
    }
    setSheet({ kind: 'person', uid: s.uid, name: s.name, side, i, seated: true })
  }
  // ممكن نبعت هدية لأي حد في الغرفة (قاعد على كرسي أو بيسمع)
  const giftPeople = useMemo(() => {
    const m = new Map()
    if (v) for (const s of [...v.seats.center, ...v.seats.ring]) if (s && s.uid !== me) m.set(s.uid, s.name)
    for (const p of st.people) if (p.uid !== me && !m.has(p.uid)) m.set(p.uid, p.name)
    return [...m].map(([uid, name]) => ({ uid, name }))
  }, [v, st.people, me])
  function openGift(uid) {
    if (!GIFTS_ON) return showToast('🎁 الهدايا جاية قريب')
    setGiftTo(uid || giftTo || giftPeople[0]?.uid || '')
    setSheet({ kind: 'gift' })
  }
  async function doGift() {
    const g = giftOf(giftId)
    if (!giftTo) return showToast('اختار تبعت لمين')
    if (!iAdmin && (wallet?.coins ?? 0) < g.price) return showToast('رصيدك مش مكفي 🪙')
    setSending(true)
    try { await sendGift(id, giftTo, giftId) } catch (e) { showToast(e?.response?.message || 'الهدية ماتبعتتش، جرب تاني') }
    setSending(false)
  }
  // خروج: بيقفل الصوت وبينزل من الكرسي
  function leave() {
    exit()
    navigate('/rooms')
  }
  function sendText() {
    const t = draft.trim()
    if (!t) return
    if (hasBadWord(t, badWords)) return showToast('فيها كلمة ممنوعة 🚫')
    lk.say(t.slice(0, 200)); setDraft('')
  }

  if (v === null) return <main className="screen voice-screen"><p className="v-msg">الحفلة دي اتقفلت أو الغرفة مش موجودة 🌙</p><button type="button" className="v-btn-gold" style={{ margin: '0 auto' }} onClick={() => navigate('/rooms')}>ارجع للغرف</button></main>
  const center = v?.seats.center || [null, null, null]
  const ring = v?.seats.ring || []
  const speaking = (uid) => st.speakers.has(uid)
  // أسامي اللي بيتكلموا دلوقتي (اللي قاعدين على كراسي ومش مكتومين)
  const talkers = [...center, ...ring].filter((s) => s && speaking(s.uid) && !v?.muted?.[s.uid]).map((s) => (s.uid === me ? 'انت' : s.name))

  return (
    <main className="screen voice-screen">
      <header className="v-top">
        <button type="button" className="v-ic" aria-label="رجوع" onClick={() => navigate('/rooms')}>›</button>
        <div className="v-t"><b>{v?.owner ? '🎉' : '👑'} {v?.name || 'الملوك القدماء'}</b><small>{v?.owner ? `🎙 حفلة ${v.ownerName}` : '🎙 غرفة صوتية'} · {ar(st.people.length || v?.here || 0)} موجودين{st.status === 'reconnecting' ? ' · بيرجع يتصل...' : ''}</small></div>
        <button type="button" className="v-ic v-ic-people" aria-label="الموجودين" onClick={() => setSheet({ kind: 'people' })}>👥<i>{ar(roomPeople.length)}</i></button>
        <button type="button" className="v-ic" aria-label="الداعمين" onClick={() => setSheet({ kind: 'support' })}>💪</button>
        {royal && !pk.cur && <button type="button" className="v-ic" aria-label="تحدي فرق" onClick={() => setSheet({ kind: 'teams' })}>⚔️</button>}
        {royal && <button type="button" className="v-ic" aria-label="الموضوع" onClick={() => { setTopic(v?.topic || ''); setSheet({ kind: 'topic' }) }}>📜</button>}
      </header>
      <WishBar w={wish.w} dark onGift={() => openGift()} />
      {v?.topic ? <div className="v-topic">📜 موضوع النهارده: <b>{v.topic}</b></div> : null}
      <PkBar room={id} pk={pk.cur} me={me} royal={royal} showToast={showToast} onSupport={(side, g) => {
        // الفرق: الدعم لأول واحد في الفريق (وبيتحسب للفريق كله)
        const c = pk.cur
        const to = side === 'A' ? ((c.teamA || [])[0] || c.a) : ((c.teamB || [])[0] || c.b)
        const name = side === 'A' ? c.aName : c.bName
        if (!to || to === me) { showToast('مينفعش تدعم نفسك 😄'); return false }
        if (g.id === 'rose') { throwAt(to, name, '🌹'); return true }
        return sendGift(id, to, g.id).then(() => true).catch((e) => { showToast(e?.response?.message || 'رصيدك مش مكفي 🪙'); return false })
      }} />
      {!pk.cur && <PkResult pk={pk.last} />}

      <div className={`v-now ${talkers.length ? 'v-now-on' : ''}`}>
        {talkers.length ? <><span className="v-eq"><i /><i /><i /><i /></span> بيتكلم دلوقتي: <b>{talkers.join('، ')}</b></> : '🔇 محدش بيتكلم دلوقتي'}
      </div>
      {st.status === 'error' && (
        <div className="v-error"><span>{st.error}</span><button type="button" className="v-btn-gold" onClick={lk.reconnect}>جرب تاني</button></div>
      )}
      {st.status === 'on' && !st.canPlay && (
        <button type="button" className="v-unlock" onClick={lk.startAudio}>🎧 دوس هنا علشان تسمع الصوت</button>
      )}

      {/* الدايرة: النص لمجلس العرش، وحواليه كراسي الأعضاء */}
      <div className="v-circle">
        <div className="v-ring" />
        <div className="v-center">
          <span className="v-ankh">☥</span>
          <div className="v-throne">
            {[1, 0, 2].map((i) => (
              <Seat key={i} s={center[i]} mark={center[i] && pkMark(pk.last, center[i].uid)} hits={center[i] && lk.hits[center[i].uid]} side="center" big={i === 0} speaking={center[i] && speaking(center[i].uid)}
                got={center[i] && wish.w?.received?.[center[i].uid]} muted={center[i] && v?.muted?.[center[i].uid]} onTap={() => v && tapSeat('center', i)} />
            ))}
          </div>
        </div>
        {ring.map((s, i) => (
          <div key={i} className="v-pos" style={RING_POS[i]}>
            <Seat s={s} team={s && pk.cur?.status === 'live' && (pk.cur.teamA || []).length ? pkSideOf(pk.cur, s.uid) : ''} mark={s && pkMark(pk.last, s.uid)} hits={s && lk.hits[s.uid]} side="ring" got={s && wish.w?.received?.[s.uid]} locked={v.seats.locked.includes(i)} speaking={s && speaking(s.uid)} muted={s && v.muted[s.uid]} onTap={() => tapSeat('ring', i)} />
          </div>
        ))}
        {lk.flies.map((f) => <span key={f.id} className="v-fly" style={{ left: `${f.x}%` }}>{f.emoji}</span>)}
      </div>

      {royal && requests.length > 0 && (
        <button type="button" className="v-reqs" onClick={() => setSheet({ kind: 'reqs' })}>✋ طلبات الكراسي ({ar(requests.length)})</button>
      )}

      <section className="v-listen">
        <h4>🎧 بيسمعوا ({ar(listeners.length)})</h4>
        <div className="v-lrow">
          {listeners.slice(0, 40).map((p) => (
            <button key={p.uid} type="button" className="v-l" onClick={() => setSheet({ kind: 'person', uid: p.uid, name: p.name, seated: false })}>
              <Face uid={p.uid} name={p.name} size={38} />
              {v?.hands?.[p.uid] && <i className="v-l-hand">✋</i>}
            </button>
          ))}
          {listeners.length === 0 && <small className="v-none">لسه محدش بيسمع بس</small>}
        </div>
      </section>

      <div className="v-chat">
        {lines.map((l) => <div key={l.id} className={`v-cm ${l.sys ? 'v-sys' : ''}`}>{l.sys ? l.text : <><b>{l.name}:</b> {l.text}</>}</div>)}
      </div>

      <footer className="v-bar">
        <button type="button" className="v-leave" onClick={leave}>خروج</button>
        <form className="v-inp" onSubmit={(e) => { e.preventDefault(); sendText() }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} placeholder="اكتب حاجة..." />
        </form>
        <button type="button" className="v-btn" aria-label="اقعد على كرسي" onClick={sitAnywhere}>🪑</button>
        <button type="button" className="v-btn" aria-label="تفاعل" onClick={() => setSheet({ kind: 'react' })}>😀</button>
        <button type="button" className="v-btn" aria-label="هدية" onClick={() => openGift()}>🎁</button>
        <button type="button" className={`v-btn v-mic-btn ${st.mic ? 'v-mic-on' : ''}`} aria-label="المايك" onClick={toggleMic}>{st.mic ? '🎤' : '🎙'}</button>
      </footer>
      <DayChest showToast={showToast} />

      {sheet?.kind === 'teams' && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">🔴🔵 تحدي فرق</h2>
          <p className="sheet-sub">كراسي ١–٤ الفريق الأحمر، وكراسي ٥–٨ الفريق الأزرق. أي هدية أو وردة لحد في الفريق بتتحسب للفريق كله، وآخر دقيقة بالضعف 🔥</p>
          <div className="v-throws">
            {[3, 5, 10].map((m) => (
              <button key={m} type="button" className="pill-btn pill-gold" onClick={() => { pkAct(id, { action: 'teams', mins: m }).then(() => showToast('⚔️ تحدي الفرق بدأ!')).catch((er) => showToast(er?.response?.message || 'حصلت مشكلة')); setSheet(null) }}>⚔️ {ar(m)} دقايق</button>
            ))}
          </div>
        </Sheet>
      )}
      {sheet?.kind === 'support' && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="grabber" aria-hidden="true" />
          <SupportBoard />
        </Sheet>
      )}
      {sheet?.kind === 'react' && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="v-reacts">{REACTS.map((e) => <button key={e} type="button" onClick={() => { lk.react(e); setSheet(null) }}>{e}</button>)}</div>
        </Sheet>
      )}
      {sheet?.kind === 'topic' && (
        <Sheet onClose={() => setSheet(null)}>
          <h2 className="sheet-title">{v?.owner ? '📜 إعدادات الحفلة' : '📜 موضوع الغرفة'}</h2>
          {v?.owner && <p className="rename-lbl">📜 موضوع الكلام</p>}
          <input className="input" maxLength={120} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثلًا: مين أعظم ملك في تاريخ مصر؟" />
          <button type="button" className="btn-primary" onClick={() => { act('topic', { text: topic }, 'اتغيّر الموضوع'); setSheet(null) }}>حفظ</button>
          {v?.owner && (v.owner === me || isAdminUid(roles, me)) && <PartyRename v={v} showToast={showToast} />}
          {v?.owner && (v.owner === me || isAdminUid(roles, me)) && <button type="button" className="pill-btn pill-danger" style={{ marginTop: 8 }} onClick={() => {
            if (!window.confirm('تقفل الحفلة؟ كل اللي جوه هيخرجوا')) return
            closeParty(v.id).then(() => { exit?.(); navigate('/rooms') }).catch((e) => showToast(e?.response?.message || 'حصلت مشكلة'))
          }}>⏻ اقفل الحفلة خالص</button>}
        </Sheet>
      )}
      {sheet?.kind === 'people' && (
        <Sheet onClose={() => setSheet(null)}>
          <h2 className="sheet-title">👥 الموجودين في الغرفة ({ar(roomPeople.length)})</h2>
          {[['على الكراسي 🎤', roomPeople.filter((p) => seatedUids.has(p.uid))], ['بيسمعوا 🎧', roomPeople.filter((p) => !seatedUids.has(p.uid))]].map(([title, list]) => list.length > 0 && (
            <div key={title} className="vp-sec">
              <p className="vp-h">{title} ({ar(list.length)})</p>
              {list.map((p) => (
                <button key={p.uid} type="button" className="vp-row" onClick={() => setSheet({ kind: 'person', uid: p.uid, name: p.name, seated: seatedUids.has(p.uid) })}>
                  <Face uid={p.uid} name={p.name} size={40} />
                  <span className="vp-name"><UserName name={p.uid === me ? `${p.name} (انت)` : p.name} uid={p.uid} role={isAdminUid(roles, p.uid) ? 'admin' : null} /></span>
                  <span className="vp-st">{speaking(p.uid) ? '🗣 بيتكلم' : v?.muted?.[p.uid] ? '🔇' : v?.hands?.[p.uid] ? '✋' : ''}</span>
                </button>
              ))}
            </div>
          ))}
          {roomPeople.length === 0 && <p className="game-hint">محدش في الغرفة دلوقتي</p>}
        </Sheet>
      )}
      {sheet?.kind === 'reqs' && (
        <Sheet onClose={() => setSheet(null)}>
          <h2 className="sheet-title">✋ طلبات الكراسي</h2>
          {requests.length === 0 && <p className="game-hint">مفيش طلبات دلوقتي</p>}
          {requests.map((r) => (
            <div key={r.uid} className="v-req">
              <Face uid={r.uid} name={r.name} size={42} />
              <span className="v-req-n"><b>{r.name}</b>{r.seat != null && <small>طالب كرسي {ar(r.seat + 1)}</small>}</span>
              <button type="button" className="v-req-ok" onClick={() => act('invite', { uid: r.uid }, `${r.name} طلع على الكرسي 🎤`)}>قبول</button>
              <button type="button" className="v-req-no" onClick={() => act('clearhand', { uid: r.uid }, 'اترفض الطلب')}>رفض</button>
            </div>
          ))}
        </Sheet>
      )}
      {sheet?.kind === 'seat' && (
        <Sheet onClose={() => setSheet(null)}>
          <h2 className="sheet-title">كرسي فاضي</h2>
          {!sheet.locked && <button type="button" className="menu-item" onClick={() => { act('sit', { side: 'ring', seat: sheet.i }); setSheet(null) }}>🎤 اقعد عليه</button>}
          <button type="button" className="menu-item" onClick={() => { act('lock', { seat: sheet.i, on: !sheet.locked }, sheet.locked ? 'الكرسي اتفتح' : 'الكرسي اتقفل 🔒'); setSheet(null) }}>{sheet.locked ? '🔓 افتح الكرسي' : '🔒 اقفل الكرسي'}</button>
        </Sheet>
      )}
      {sheet?.kind === 'person' && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="v-person"><Face uid={sheet.uid} name={sheet.name} size={64} /><b>{sheet.uid === me ? profile.name : sheet.name}</b></div>
          {sheet.uid === me ? (
            sheet.seated && <button type="button" className="menu-item" onClick={() => { act('leave', {}, 'نزلت من الكرسي'); setSheet(null) }}>⬇️ انزل من الكرسي</button>
          ) : (
            <>
              {GIFTS_ON && <button type="button" className="menu-item" onClick={() => openGift(sheet.uid)}>🎁 ابعتله هدية</button>}
              {mySeat && sheet.seated && !pk.cur && (
                <div className="v-throws">
                  {[3, 5, 10].map((m) => (
                    <button key={m} type="button" className="pill-btn pill-gold" onClick={() => { pkAct(id, { action: 'invite', to: sheet.uid, mins: m }).then(() => showToast(`⚔️ بعتنا التحدي لـ ${sheet.name}`)).catch((er) => showToast(er?.response?.message || 'حصلت مشكلة')); setSheet(null) }}>⚔️ تحداه {ar(m)} د</button>
                  ))}
                </div>
              )}
              <div className="v-throws">
                {Object.entries(THROWS).map(([e, label]) => (
                  <button key={e} type="button" className="pill-btn" onClick={() => throwAt(sheet.uid, sheet.name, e)}>{e} ارمي {label}</button>
                ))}
              </div>
              <button type="button" className="menu-item" onClick={() => navigate(`/u/${sheet.uid}`)}>👤 البروفايل</button>
              {royal && sheet.seated && (
                <>
                  <button type="button" className="menu-item" onClick={() => { act('mute', { uid: sheet.uid, on: !v.muted[sheet.uid] }, v.muted[sheet.uid] ? 'اتفك الكتم' : 'اتكتم 🔇'); setSheet(null) }}>{v.muted[sheet.uid] ? '🔊 فك الكتم' : '🔇 اكتم صوته'}</button>
                  <button type="button" className="menu-item danger" onClick={() => { act('kick', { uid: sheet.uid }, 'نزل من الكرسي'); setSheet(null) }}>⬇️ نزّله من الكرسي</button>
                </>
              )}
              {royal && !sheet.seated && (
                <button type="button" className="menu-item" onClick={() => { act('invite', { uid: sheet.uid }, `${sheet.name} طلع على الكرسي 🎤`); setSheet(null) }}>🎤 طلّعه على كرسي{v?.hands?.[sheet.uid] ? ' (طالب كرسي ✋)' : ''}</button>
              )}
            </>
          )}
        </Sheet>
      )}
      {sheet?.kind === 'gift' && (
        <Sheet onClose={() => setSheet(null)}>
          <h2 className="gs-title">🎁 ابعت هدية</h2>
          <p className="gs-lbl">لمين؟</p>
          {giftPeople.length === 0 ? <p className="game-hint">لسه مفيش حد غيرك في الغرفة</p> : (
            <div className="gs-to">
              {giftPeople.map((p) => (
                <button key={p.uid} type="button" className={`gs-p ${giftTo === p.uid ? 'on' : ''}`} onClick={() => setGiftTo(p.uid)}>
                  <span><Face uid={p.uid} name={p.name} size={46} /></span>{p.name}
                </button>
              ))}
            </div>
          )}
          <p className="gs-lbl">اختار الهدية</p>
          <div className="gs-grid">
            {GIFTS.map((g) => (
              <button key={g.id} type="button" className={`gs-g ${g.big ? 'big' : ''} ${giftId === g.id ? 'on' : ''}`} onClick={() => setGiftId(g.id)}>
                <span className="ic">{g.img ? <img src={g.img} alt="" /> : g.e}</span><b>{g.name}</b><small><Coin size="sm" /> {fmtCoins(g.price)}</small>
              </button>
            ))}
          </div>
          <div className="gs-bot">
            <span className="gs-bal">{iAdmin ? '👑 انت الأدمن: الهدايا ببلاش' : <>رصيدك: <Coin size="sm" /> {fmtCoins(wallet?.coins)}</>}</span>
            <button type="button" className="btn-primary" style={{ width: 'auto', padding: '0 20px' }} disabled={sending || !giftTo} onClick={doGift}>
              {sending ? 'لحظة...' : `ابعت ${giftOf(giftId).name}`}
            </button>
          </div>
        </Sheet>
      )}
      <GiftFX cur={gq.cur} onStart={gq.started} />
      <VipEntry people={roomPeople} Face={Face} />
      {toast}
    </main>
  )
}
