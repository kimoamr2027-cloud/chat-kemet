// 🔴 شاشة اللايف: المضيف بيبث بالكاميرا، والمتفرجين بيعلّقوا ويبعتوا قلوب وهدايا
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sheet, useToast } from '../components/ui.jsx'
import { Coin, fmtCoins } from '../components/Coins.jsx'
import GiftFX from '../components/GiftFX.jsx'
import { useAuth } from '../auth.jsx'
import { isAdminUid } from '../roles.js'
import { useLive, joinLive, endLive } from '../live.js'
import { GIFTS, sendGift, useGiftFeed, useGiftQueue } from '../gifts.js'
import { useFilter, hasBadWord } from '../filter.js'
import { reportUser } from '../dm.js'
import { logDiag } from '../diag.js'
import { ar } from '../utils.js'

const REPORTS = ['محتوى مش لايق 🔞', 'شتيمة أو إهانة', 'سن صغير', 'حاجة تانية']

export default function LiveView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile, roles } = useAuth()
  const admin = isAdminUid(roles, user.uid)
  const rec = useLive(id)
  const [toast, showToast] = useToast()
  const [st, setSt] = useState({ status: 'connecting', host: false, canPlay: true, mic: true, viewers: 0, err: '' })
  const [comments, setComments] = useState([])
  const [hearts, setHearts] = useState([])
  const [draft, setDraft] = useState('')
  const [sheet, setSheet] = useState(null)
  const [sureEnd, setSureEnd] = useState(false)
  const videoRef = useRef(null)
  const audioBox = useRef(null)
  const roomRef = useRef(null)
  const facing = useRef('user')
  const words = useFilter()
  const gq = useGiftQueue()
  useGiftFeed(id, gq.push)

  const addComment = (c) => setComments((x) => [...x.slice(-7), { id: Math.random(), ...c }])
  const heart = () => {
    const hid = Math.random().toString(36).slice(2)
    setHearts((h) => [...h.slice(-15), { id: hid, x: 10 + Math.random() * 60, e: ['❤️', '💛', '💜', '🧡'][Math.floor(Math.random() * 4)] }])
    setTimeout(() => setHearts((h) => h.filter((x) => x.id !== hid)), 2400)
  }

  // الاتصال (مرة واحدة لكل لايف)
  useEffect(() => {
    let dead = false
    let room = null
    ;(async () => {
      try {
        const [{ Room, RoomEvent, Track, VideoPresets }, j] = await Promise.all([import('livekit-client'), joinLive(id)])
        if (dead) return
        room = new Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: VideoPresets.h540.resolution } })
        roomRef.current = room
        const count = () => setSt((s) => ({ ...s, viewers: Math.max(0, room.remoteParticipants.size - (j.host ? 0 : 1)), canPlay: room.canPlaybackAudio }))
        room
          .on(RoomEvent.TrackSubscribed, (track) => {
            if (track.kind === Track.Kind.Video && videoRef.current) track.attach(videoRef.current)
            if (track.kind === Track.Kind.Audio) audioBox.current?.appendChild(track.attach())
          })
          .on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => { if (el !== videoRef.current) el.remove() }))
          .on(RoomEvent.ParticipantConnected, count)
          .on(RoomEvent.ParticipantDisconnected, count)
          .on(RoomEvent.AudioPlaybackStatusChanged, count)
          .on(RoomEvent.DataReceived, (payload, p) => {
            try {
              const d = JSON.parse(new TextDecoder().decode(payload))
              if (d.t === 'c' && typeof d.text === 'string') addComment({ name: p?.name || '', text: d.text.slice(0, 150) })
              if (d.t === 'h') heart()
            } catch {}
          })
          .on(RoomEvent.Disconnected, () => { if (!dead) setSt((s) => ({ ...s, status: 'off' })) })
        await room.connect(j.url, j.token)
        if (dead) { room.disconnect(); return }
        if (j.host) {
          await room.localParticipant.setCameraEnabled(true, { facingMode: 'user' })
          await room.localParticipant.setMicrophoneEnabled(true)
          room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack?.attach(videoRef.current)
        }
        setSt((s) => ({ ...s, status: 'on', host: j.host }))
        count()
      } catch (e) {
        logDiag('live.join', e)
        if (!dead) setSt((s) => ({ ...s, status: 'error', err: e?.response?.message || (e?.name === 'NotAllowedError' ? 'اسمح للشات يستخدم الكاميرا والمايك من إعدادات الموبايل' : 'مقدرناش نوصل للايف') }))
      }
    })()
    return () => { dead = true; room?.disconnect() }
  }, [id])

  const send = (obj) => roomRef.current?.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(obj)), { reliable: true }).catch(() => {})
  const say = () => {
    const t = draft.trim()
    if (!t) return
    if (hasBadWord(t, words)) return showToast('التعليق فيه كلمة ممنوعة')
    send({ t: 'c', text: t.slice(0, 150) }); addComment({ name: 'انت', text: t.slice(0, 150), mine: true }); setDraft('')
  }
  const like = () => { send({ t: 'h' }); heart() }
  const toggleMic = () => { const on = !st.mic; roomRef.current?.localParticipant.setMicrophoneEnabled(on).then(() => setSt((s) => ({ ...s, mic: on }))) }
  const flip = async () => {
    const { Track } = await import('livekit-client')
    facing.current = facing.current === 'user' ? 'environment' : 'user'
    const t = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack
    t?.restartTrack({ facingMode: facing.current }).catch(() => showToast('مقدرناش نقلب الكاميرا'))
  }
  const stop = () => endLive(id).then(() => navigate('/live')).catch(() => showToast('حصلت مشكلة'))
  const gift = (g) => sendGift(id, rec.host, g.id).then(() => setSheet(null)).catch((e) => showToast(e?.response?.message || (e?.status === 400 ? 'رصيدك مش مكفي 🪙' : 'حصلت مشكلة')))

  const ended = rec?.status === 'ended' || rec === null
  return (
    <main className="screen live-screen">
      <video ref={videoRef} className={`live-video ${st.host && facing.current === 'user' ? 'live-mirror' : ''}`} autoPlay playsInline muted={st.host} />
      <div ref={audioBox} hidden />
      <div className="live-shade" />

      <header className="live-top">
        <button type="button" className="live-x" aria-label="خروج" onClick={() => navigate('/live')}>✕</button>
        <div className="live-host"><b>{rec?.hostName || '...'}</b><small>{rec?.title}</small></div>
        <span className="live-badge">🔴 لايف</span>
        <span className="live-views">👁 {ar(Math.max(st.viewers, rec?.viewers || 0))}</span>
      </header>

      {st.status === 'connecting' && !ended && <p className="live-msg">بيتصل باللايف...</p>}
      {st.status === 'error' && <p className="live-msg">{st.err}</p>}
      {ended && (
        <div className="live-end">
          <b>اللايف خلص 👋</b>
          <button type="button" className="btn-primary" onClick={() => navigate('/live')}>شوف لايفات تانية</button>
        </div>
      )}
      {!st.canPlay && !st.host && !ended && <button type="button" className="v-unlock live-unlock" onClick={() => roomRef.current?.startAudio().then(() => setSt((s) => ({ ...s, canPlay: true })))}>🔊 دوس علشان تسمع</button>}

      <div className="live-hearts" aria-hidden="true">{hearts.map((h) => <span key={h.id} style={{ left: `${h.x}%` }}>{h.e}</span>)}</div>
      <div className="live-comments">
        {comments.map((c) => <p key={c.id} className={c.mine ? 'mine' : ''}><b>{c.name}</b> {c.text}</p>)}
      </div>

      {!ended && (
        <footer className="live-bar">
          <form className="live-inp" onSubmit={(e) => { e.preventDefault(); say() }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={150} placeholder="اكتب تعليق..." />
          </form>
          {st.host ? (
            <>
              <button type="button" className="live-btn" aria-label="المايك" onClick={toggleMic}>{st.mic ? '🎤' : '🔇'}</button>
              <button type="button" className="live-btn" aria-label="اقلب الكاميرا" onClick={flip}>🔄</button>
              <button type="button" className="live-btn live-stop" onClick={() => (sureEnd ? stop() : setSureEnd(true))}>{sureEnd ? 'متأكد؟' : '⏹'}</button>
            </>
          ) : (
            <>
              <button type="button" className="live-btn" aria-label="قلب" onClick={like}>❤️</button>
              <button type="button" className="live-btn" aria-label="هدية" onClick={() => setSheet('gift')}>🎁</button>
              <button type="button" className="live-btn" aria-label="بلّغ" onClick={() => setSheet('report')}>🚩</button>
            </>
          )}
          {admin && !st.host && <button type="button" className="live-btn live-stop" onClick={() => (sureEnd ? stop() : setSureEnd(true))}>{sureEnd ? 'اقفله؟' : '⛔'}</button>}
        </footer>
      )}

      {sheet === 'gift' && rec && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">🎁 ابعت هدية لـ {rec.hostName}</h2>
          <div className="gs-grid live-gifts">
            {GIFTS.map((g) => (
              <button key={g.id} type="button" className={`gs-g ${g.big ? 'big' : ''}`} onClick={() => gift(g)}>
                <span className="ic">{g.img ? <img src={g.img} alt="" /> : g.e}</span><b>{g.name}</b><small><Coin size="sm" /> {fmtCoins(g.price)}</small>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {sheet === 'report' && rec && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">🚩 بلّغ عن اللايف</h2>
          {REPORTS.map((r) => (
            <button key={r} type="button" className="menu-item" onClick={() => reportUser({ other: rec.host, otherName: rec.hostName, reason: `🔴 لايف: ${r}`, chatId: '' })
              .then(() => { showToast('شكرًا، الأدمن هيراجع اللايف'); setSheet(null) }).catch(() => showToast('حصلت مشكلة'))}>{r}</button>
          ))}
        </Sheet>
      )}
      <GiftFX cur={gq.cur} onStart={gq.started} />
      {toast}
    </main>
  )
}
