// الغرفة الصوتية "الملوك القدماء" — شكل الدايرة:
// النص (مجلس العرش) للأدمن والمشرفين، والدايرة اللي برّه للأعضاء، واللي تحت بيسمعوا
// الصوت مباشر عن طريق LiveKit (على سيرفرنا)، والكلام والتفاعلات بتتبعت جوه الغرفة ومش بتتحفظ
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, Sheet, useToast } from '../components/ui.jsx'
import { useAuth } from '../auth.jsx'
import { useUser } from '../dm.js'
import { colorIndex } from '../rooms.js'
import { hasBadWord, useFilter } from '../filter.js'
import { logDiag } from '../diag.js'
import { ar } from '../utils.js'
import { useVoiceRoom, joinVoice, voiceAct, seatOf, REACTS } from '../voice.js'

function Face({ uid, name, size }) {
  const u = useUser(uid)
  return <Avatar text={(name || '؟').charAt(0)} c={colorIndex(uid)} size={size} round src={u?.avatar} />
}

// مكان كراسي الدايرة (٨ كراسي حوالين العرش، أولهم فوق)
const RING_POS = Array.from({ length: 8 }, (_, k) => {
  const a = (-90 + k * 45) * (Math.PI / 180)
  return { left: `${50 + 43 * Math.cos(a)}%`, top: `${50 + 43 * Math.sin(a)}%` }
})

function Seat({ s, side, locked, speaking, muted, hand, big, onTap }) {
  return (
    <button type="button" className={`vs ${big ? 'vs-big' : ''} ${side === 'center' ? 'vs-royal' : ''} ${s && speaking && !muted ? 'vs-talk' : ''}`} onClick={onTap}>
      <span className="vs-av">
        {s ? <Face uid={s.uid} name={s.name} size={big ? 84 : side === 'center' ? 58 : 54} />
          : <span className="vs-empty">{locked ? '🔒' : side === 'center' ? '👑' : '+'}</span>}
        {s && muted && <i className="vs-mic vs-off">🔇</i>}
        {s && !muted && speaking && <i className="vs-mic vs-on">🔊</i>}
        {hand && <i className="vs-hand">✋</i>}
      </span>
      <span className="vs-nm">{s ? s.name : locked ? 'مقفول' : side === 'center' ? 'للمشرفين' : 'فاضي'}</span>
    </button>
  )
}

// الاتصال بالصوت (LiveKit) — بيتحمّل بس لما تدخل الغرفة
function useLiveVoice(roomId, me, onSys) {
  const roomRef = useRef(null)
  const audioBox = useRef(null)
  const [key, setKey] = useState(0)
  const [st, setSt] = useState({ status: 'connecting', speakers: new Set(), people: [], canPlay: true, canPublish: false, mic: false, royal: false, error: '' })
  const [chat, setChat] = useState([])
  const [flies, setFlies] = useState([])
  const sysRef = useRef(onSys)
  sysRef.current = onSys

  useEffect(() => {
    let dead = false
    setSt((s) => ({ ...s, status: 'connecting', error: '' }))
    ;(async () => {
      try {
        const [{ Room, RoomEvent, Track }, j] = await Promise.all([import('livekit-client'), joinVoice(roomId)])
        if (dead) return
        // صلاحيات المشرف من السيرفر على طول (حتى لو الصوت لسه بيتصل)
        setSt((s) => ({ ...s, royal: !!j.royal }))
        const room = new Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        roomRef.current = room
        const refresh = () => {
          if (roomRef.current !== room) return
          const lp = room.localParticipant
          setSt((s) => ({
            ...s,
            people: [lp, ...room.remoteParticipants.values()].map((p) => ({ uid: p.identity, name: p.name || '' })),
            canPlay: room.canPlaybackAudio, canPublish: !!lp.permissions?.canPublish, mic: lp.isMicrophoneEnabled,
          }))
        }
        const fly = (emoji) => {
          const id = Math.random().toString(36).slice(2)
          setFlies((f) => [...f.slice(-12), { id, emoji, x: 10 + Math.random() * 70 }])
          setTimeout(() => setFlies((f) => f.filter((x) => x.id !== id)), 2600)
        }
        room
          .on(RoomEvent.ParticipantConnected, (p) => { refresh(); sysRef.current?.(`👋 ${p.name || 'حد'} دخل القاعة`) })
          .on(RoomEvent.ParticipantDisconnected, refresh)
          .on(RoomEvent.ActiveSpeakersChanged, (sp) => setSt((s) => ({ ...s, speakers: new Set(sp.map((p) => p.identity)) })))
          .on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === Track.Kind.Audio) audioBox.current?.appendChild(track.attach()) })
          .on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()))
          .on(RoomEvent.AudioPlaybackStatusChanged, refresh)
          .on(RoomEvent.LocalTrackPublished, refresh)
          .on(RoomEvent.LocalTrackUnpublished, refresh)
          .on(RoomEvent.TrackMuted, refresh)
          .on(RoomEvent.TrackUnmuted, refresh)
          .on(RoomEvent.ParticipantPermissionsChanged, (_, p) => {
            if (p && p !== room.localParticipant) return
            if (!room.localParticipant.permissions?.canPublish) room.localParticipant.setMicrophoneEnabled(false).catch(() => {})
            refresh()
          })
          .on(RoomEvent.DataReceived, (payload, p) => {
            try {
              const d = JSON.parse(new TextDecoder().decode(payload))
              if (d.t === 'chat' && typeof d.text === 'string') setChat((c) => [...c.slice(-40), { id: Math.random(), name: p?.name || '', uid: p?.identity, text: d.text.slice(0, 200) }])
              if (d.t === 'react' && REACTS.includes(d.e)) fly(d.e)
            } catch {}
          })
          .on(RoomEvent.Reconnecting, () => setSt((s) => ({ ...s, status: 'reconnecting' })))
          .on(RoomEvent.Reconnected, () => { setSt((s) => ({ ...s, status: 'on' })); refresh() })
          .on(RoomEvent.Disconnected, () => { if (roomRef.current === room) setSt((s) => ({ ...s, status: 'off' })) })
        room.fly = fly
        await room.connect(j.url, j.token)
        if (dead) { room.disconnect(); return }
        setSt((s) => ({ ...s, status: 'on', royal: !!j.royal }))
        refresh()
      } catch (e) {
        if (dead) return
        logDiag('voice.join', e, { status: e?.status })
        setSt((s) => ({ ...s, status: 'error', error: e?.status === 503 ? 'الصوت لسه بيتجهّز على السيرفر، جرب كمان شوية' : 'مقدرناش نوصل للغرفة الصوتية، اتأكد من النت وجرب تاني' }))
      }
    })()
    return () => {
      dead = true
      const r = roomRef.current
      roomRef.current = null
      if (r) r.disconnect()
      if (audioBox.current) audioBox.current.innerHTML = ''
    }
  }, [roomId, key])

  const room = () => roomRef.current
  const send = (obj) => room()?.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(obj)), { reliable: true }).catch(() => {})
  return {
    st, chat, flies, audioBox,
    reconnect: () => setKey((k) => k + 1),
    startAudio: () => room()?.startAudio().then(() => setSt((s) => ({ ...s, canPlay: true }))).catch(() => {}),
    setMic: (on) => room()?.localParticipant.setMicrophoneEnabled(on).then(() => setSt((s) => ({ ...s, mic: on }))),
    say: (text) => { send({ t: 'chat', text }); setChat((c) => [...c.slice(-40), { id: Math.random(), name: 'انت', uid: me, text, mine: true }]) },
    react: (e) => { send({ t: 'react', e }); room()?.fly?.(e) },
  }
}

export default function VoiceRoom() {
  const { id = 'kings' } = useParams()
  const { user, profile, myBan } = useAuth()
  const me = user.uid
  const navigate = useNavigate()
  const v = useVoiceRoom(id)
  const [toast, showToast] = useToast()
  const [sys, setSys] = useState([])
  const lk = useLiveVoice(id, me, (text) => setSys((s) => [...s.slice(-3), { id: Math.random(), text }]))
  const { st } = lk
  const badWords = useFilter()
  const [draft, setDraft] = useState('')
  const [sheet, setSheet] = useState(null) // { kind: 'seat'|'person'|'topic'|'react', ... }
  const [topic, setTopic] = useState('')
  const royal = st.royal
  const mySeat = seatOf(v, me)
  const iMuted = !!v?.muted?.[me]
  const myHand = !!v?.hands?.[me]

  // اتنزّلت من الكرسي أو اتكتمت: المايك يتقفل
  useEffect(() => { if ((!mySeat || iMuted) && st.mic) lk.setMic(false).catch(() => {}) }, [!!mySeat, iMuted]) // eslint-disable-line react-hooks/exhaustive-deps

  const seatedUids = useMemo(() => new Set(v ? [...v.seats.center, ...v.seats.ring].filter(Boolean).map((s) => s.uid) : []), [v])
  const listeners = st.people.filter((p) => !seatedUids.has(p.uid))
  const lines = [...sys.map((x) => ({ ...x, sys: true })), ...lk.chat].slice(-6)

  const act = (action, body, ok) => voiceAct(id, action, body).then(() => ok && showToast(ok)).catch((e) => showToast(e?.response?.message || e?.message || 'حصلت مشكلة'))

  async function toggleMic() {
    if (!mySeat) return showToast('اقعد على كرسي فاضي في الدايرة الأول علشان تتكلم 🎤')
    if (iMuted) return showToast('المشرف كاتم صوتك 🔇')
    if (!st.canPublish) { lk.reconnect(); return showToast('لحظة... بنجهّز المايك') }
    try { await lk.setMic(!st.mic) } catch (e) { logDiag('voice.mic', e); showToast('المايك مش شغال. اسمح للشات يستخدم المايك من إعدادات الموبايل') }
  }
  function tapSeat(side, i) {
    const s = v.seats[side][i]
    const locked = side === 'ring' && v.seats.locked.includes(i)
    if (!s) {
      if (side === 'center' && !royal) return showToast('مجلس العرش للأدمن والمشرفين بس 👑')
      if (royal && side === 'ring') return setSheet({ kind: 'seat', side, i, locked })
      if (locked) return showToast('الكرسي ده مقفول 🔒')
      if (myBan) return
      return act('sit', { side, seat: i }, side === 'center' ? '👑 قعدت في مجلس العرش' : 'قعدت على الكرسي 🎤 دوس المايك علشان تتكلم')
    }
    setSheet({ kind: 'person', uid: s.uid, name: s.name, side, i, seated: true })
  }
  function leave() {
    if (mySeat) voiceAct(id, 'leave').catch(() => {})
    navigate('/rooms')
  }
  function sendText() {
    const t = draft.trim()
    if (!t) return
    if (hasBadWord(t, badWords)) return showToast('فيها كلمة ممنوعة 🚫')
    lk.say(t.slice(0, 200)); setDraft('')
  }

  if (v === null) return <main className="screen voice-screen"><p className="v-msg">الغرفة دي مش موجودة</p></main>
  const center = v?.seats.center || [null, null, null]
  const ring = v?.seats.ring || []
  const speaking = (uid) => st.speakers.has(uid)

  return (
    <main className="screen voice-screen">
      <div ref={lk.audioBox} className="v-audio" aria-hidden="true" />
      <header className="v-top">
        <button type="button" className="v-ic" aria-label="رجوع" onClick={leave}>›</button>
        <div className="v-t"><b>👑 {v?.name || 'الملوك القدماء'}</b><small>🎙 غرفة صوتية · {ar(st.people.length || v?.here || 0)} موجودين{st.status === 'reconnecting' ? ' · بيرجع يتصل...' : ''}</small></div>
        {royal ? <button type="button" className="v-ic" aria-label="الموضوع" onClick={() => { setTopic(v?.topic || ''); setSheet({ kind: 'topic' }) }}>📜</button> : <span className="v-ic v-ic-off" />}
      </header>
      {v?.topic ? <div className="v-topic">📜 موضوع النهارده: <b>{v.topic}</b></div> : null}

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
              <Seat key={i} s={center[i]} side="center" big={i === 0} speaking={center[i] && speaking(center[i].uid)}
                muted={center[i] && v?.muted?.[center[i].uid]} onTap={() => v && tapSeat('center', i)} />
            ))}
          </div>
        </div>
        {ring.map((s, i) => (
          <div key={i} className="v-pos" style={RING_POS[i]}>
            <Seat s={s} side="ring" locked={v.seats.locked.includes(i)} speaking={s && speaking(s.uid)} muted={s && v.muted[s.uid]} onTap={() => tapSeat('ring', i)} />
          </div>
        ))}
        {lk.flies.map((f) => <span key={f.id} className="v-fly" style={{ left: `${f.x}%` }}>{f.emoji}</span>)}
      </div>

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
        <button type="button" className={`v-btn ${myHand ? 'v-on' : ''}`} aria-label="ارفع إيدك" onClick={() => (mySeat ? showToast('انت قاعد على كرسي بالفعل 🎤') : act('hand', { up: !myHand }, myHand ? 'نزّلت إيدك' : '✋ رفعت إيدك، المشرف هيطلّعك'))}>✋</button>
        <button type="button" className="v-btn" aria-label="تفاعل" onClick={() => setSheet({ kind: 'react' })}>😀</button>
        <button type="button" className="v-btn" aria-label="هدية" onClick={() => showToast('🎁 الهدايا جاية قريب، هنختارها مع بعض')}>🎁</button>
        <button type="button" className={`v-btn v-mic-btn ${st.mic ? 'v-mic-on' : ''}`} aria-label="المايك" onClick={toggleMic}>{st.mic ? '🎤' : '🎙'}</button>
      </footer>

      {sheet?.kind === 'react' && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="v-reacts">{REACTS.map((e) => <button key={e} type="button" onClick={() => { lk.react(e); setSheet(null) }}>{e}</button>)}</div>
        </Sheet>
      )}
      {sheet?.kind === 'topic' && (
        <Sheet onClose={() => setSheet(null)}>
          <h2 className="sheet-title">📜 موضوع الغرفة</h2>
          <input className="input" maxLength={120} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثلًا: مين أعظم ملك في تاريخ مصر؟" />
          <button type="button" className="btn-primary" onClick={() => { act('topic', { text: topic }, 'اتغيّر الموضوع'); setSheet(null) }}>حفظ</button>
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
              <button type="button" className="menu-item" onClick={() => navigate(`/u/${sheet.uid}`)}>👤 البروفايل</button>
              {royal && sheet.seated && (
                <>
                  <button type="button" className="menu-item" onClick={() => { act('mute', { uid: sheet.uid, on: !v.muted[sheet.uid] }, v.muted[sheet.uid] ? 'اتفك الكتم' : 'اتكتم 🔇'); setSheet(null) }}>{v.muted[sheet.uid] ? '🔊 فك الكتم' : '🔇 اكتم صوته'}</button>
                  <button type="button" className="menu-item danger" onClick={() => { act('kick', { uid: sheet.uid }, 'نزل من الكرسي'); setSheet(null) }}>⬇️ نزّله من الكرسي</button>
                </>
              )}
              {royal && !sheet.seated && (
                <button type="button" className="menu-item" onClick={() => { act('invite', { uid: sheet.uid }, `${sheet.name} طلع على الكرسي 🎤`); setSheet(null) }}>🎤 طلّعه على كرسي{v?.hands?.[sheet.uid] ? ' (رافع إيده ✋)' : ''}</button>
              )}
            </>
          )}
        </Sheet>
      )}
      {toast}
    </main>
  )
}
