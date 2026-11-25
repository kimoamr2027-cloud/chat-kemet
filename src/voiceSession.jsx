// جلسة الغرفة الصوتية: الصوت (LiveKit) شغال من هنا للتطبيق كله
// علشان اللي قاعد على الكرسي يفضل المايك مفتوح وهو بيتنقّل في الشات (الألعاب، الخاص، البروفايل...)
// وبيخرج من الصوت بس لما يدوس «خروج» أو يدخل غرفة دردشة تانية
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import { joinVoice, voiceAct, useVoiceRoom, seatOf, REACTS, THROWS } from './voice.js'
import { tierOf, SUPPORT_TIERS } from './pk.js'
import { logDiag } from './diag.js'

// الاتصال بالصوت (LiveKit) — بيتحمّل بس لما تدخل الغرفة
export function useLiveVoice(roomId, me, onSys) {
  const roomRef = useRef(null)
  const audioBox = useRef(null)
  const [key, setKey] = useState(0)
  const [st, setSt] = useState({ status: 'connecting', speakers: new Set(), people: [], canPlay: true, canPublish: false, mic: false, royal: false, error: '' })
  const [chat, setChat] = useState([])
  const [flies, setFlies] = useState([])
  // الورد والطماطم اللي اترمت على كل واحد (بتختفي بعد ثانيتين)
  const [hits, setHits] = useState({})
  const hitRef = useRef(null)
  hitRef.current = (uid, e) => {
    const id = Math.random().toString(36).slice(2)
    setHits((h) => ({ ...h, [uid]: [...(h[uid] || []).slice(-4), { id, e }] }))
    setTimeout(() => setHits((h) => ({ ...h, [uid]: (h[uid] || []).filter((x) => x.id !== id) })), 2200)
  }
  const sysRef = useRef(onSys)
  sysRef.current = onSys

  useEffect(() => {
    if (!roomId) { setSt((s) => ({ ...s, status: 'off', people: [], speakers: new Set(), mic: false, canPublish: false })); setChat([]); return }
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
          .on(RoomEvent.ParticipantConnected, (p) => {
            refresh()
            // الداعم الدهبي والماسي: دخول مميز
            const t = tierOf(p.identity)
            sysRef.current?.(t >= 3 ? `${SUPPORT_TIERS[t].icon} ${SUPPORT_TIERS[t].name} ${p.name || ''} نوّر القاعة ✨` : `👋 ${p.name || 'حد'} دخل القاعة`)
          })
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
              if (d.t === 'throw' && THROWS[d.e] && typeof d.to === 'string') {
                hitRef.current?.(d.to, d.e)
                sysRef.current?.(`${d.e} ${p?.name || 'حد'} رمى ${THROWS[d.e]} على ${String(d.toName || '').slice(0, 30)}`)
              }
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
    st, chat, flies, hits, audioBox,
    reconnect: () => setKey((k) => k + 1),
    startAudio: () => room()?.startAudio().then(() => setSt((s) => ({ ...s, canPlay: true }))).catch(() => {}),
    setMic: (on) => room()?.localParticipant.setMicrophoneEnabled(on).then(() => setSt((s) => ({ ...s, mic: on }))),
    say: (text) => { send({ t: 'chat', text }); setChat((c) => [...c.slice(-40), { id: Math.random(), name: 'انت', uid: me, text, mine: true }]) },
    react: (e) => { send({ t: 'react', e }); room()?.fly?.(e) },
    throwAt: (to, toName, e) => { send({ t: 'throw', e, to, toName }); hitRef.current?.(to, e); sysRef.current?.(`${e} انت رميت ${THROWS[e]} على ${toName}`) },
  }
}


const Ctx = createContext(null)
export const useVoiceSession = () => useContext(Ctx)

export function VoiceProvider({ children }) {
  const { user } = useAuth()
  const [roomId, setRoomId] = useState(null)
  const [sys, setSys] = useState([])
  const lk = useLiveVoice(user ? roomId : null, user?.uid, (text) => setSys((s) => [...s.slice(-3), { id: Math.random(), text }]))
  const { pathname } = useLocation()
  const cur = useRef(null)
  cur.current = roomId
  const exit = () => {
    const r = cur.current
    if (r) voiceAct(r, 'leave').catch(() => {})
    setRoomId(null); setSys([])
  }
  const enter = (id) => {
    const r = cur.current
    if (r === id) return
    if (r) voiceAct(r, 'leave').catch(() => {})
    setSys([]); setRoomId(id)
  }
  // دخل غرفة دردشة تانية: يخرج من الصوت
  useEffect(() => { if (cur.current && /^\/rooms\/[^/]+/.test(pathname)) exit() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Ctx.Provider value={{ roomId, lk, sys, enter, exit }}>
      {children}
      <div ref={lk.audioBox} className="v-audio" aria-hidden="true" />
      {roomId && pathname !== `/voice/${roomId}` && <VoiceMiniBar roomId={roomId} lk={lk} exit={exit} me={user?.uid} />}
    </Ctx.Provider>
  )
}

// الشريط اللي تحت: انت لسه في الغرفة الصوتية وانت بتتنقّل
function VoiceMiniBar({ roomId, lk, exit, me }) {
  const navigate = useNavigate()
  const v = useVoiceRoom(roomId)
  const seated = !!seatOf(v, me)
  const { st } = lk
  return (
    <div className="vmini" role="region" aria-label="الغرفة الصوتية">
      <button type="button" className="vmini-main" onClick={() => navigate(`/voice/${roomId}`)}>
        <span className={`vmini-dot ${st.mic ? 'on' : ''}`} />
        <span className="vmini-t"><b>🎙 {v?.name || 'الملوك القدماء'}</b><small>{st.status === 'error' ? 'الصوت مش متصل — دوس هنا ترجع للغرفة' : st.status !== 'on' ? 'بيتصل...' : seated ? (st.mic ? 'المايك مفتوح — بيسمعوك' : 'قاعد على الكرسي · المايك مقفول') : 'بتسمع'}</small></span>
      </button>
      {seated && st.canPublish && <button type="button" className={`vmini-btn ${st.mic ? 'on' : ''}`} aria-label="المايك" onClick={() => lk.setMic(!st.mic).catch(() => {})}>{st.mic ? '🎤' : '🎙'}</button>}
      <button type="button" className="vmini-btn vmini-x" aria-label="خروج من الغرفة الصوتية" onClick={exit}>✕</button>
    </div>
  )
}
