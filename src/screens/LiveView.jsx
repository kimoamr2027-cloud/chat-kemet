// 🔴 شاشة اللايف: المضيف بيبث بالكاميرا، والمتفرجين بيعلّقوا ويبعتوا قلوب وهدايا
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sheet, useToast } from '../components/ui.jsx'
import { Coin, fmtCoins } from '../components/Coins.jsx'
import GiftFX from '../components/GiftFX.jsx'
import { useAuth } from '../auth.jsx'
import { isAdminUid } from '../roles.js'
import { useLive, useLives, joinLive, endLive } from '../live.js'
import { useLivePk, livePkAct, pkRose, PUNISH_MS } from '../pk.js'
import { PkBar, PkResult, getQuickGift } from '../components/Pk.jsx'
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
  const peerRef = useRef(null)
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t) }, [])
  const pk = useLivePk(id)
  const lives = useLives()
  // المنافس في التحدي (وبيفضل ظاهر دقيقة وقت العقاب)
  const pkShown = pk.cur?.status === 'live' ? pk.cur : pk.last && Date.now() - pk.last.endAt < PUNISH_MS ? pk.last : null
  const peerId = pkShown ? (pkShown.liveA === id ? pkShown.liveB : pkShown.liveA) : null
  const iAmB = pkShown?.liveB === id
  const peerName = pkShown ? (pkShown.liveA === id ? pkShown.bName : pkShown.aName) : ''
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

  // ⚔️ وقت التحدي: بنتفرج على لايف المنافس كمان (فيديو وصوت)
  useEffect(() => {
    if (!peerId) return
    let dead = false
    let room = null
    ;(async () => {
      try {
        const [{ Room, RoomEvent, Track }, j] = await Promise.all([import('livekit-client'), joinLive(peerId)])
        if (dead) return
        room = new Room({ adaptiveStream: true })
        room
          .on(RoomEvent.TrackSubscribed, (track) => {
            if (track.kind === Track.Kind.Video && peerRef.current) track.attach(peerRef.current)
            if (track.kind === Track.Kind.Audio) audioBox.current?.appendChild(track.attach())
          })
          .on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => { if (el !== peerRef.current) el.remove() }))
        await room.connect(j.url, j.token, { autoSubscribe: true })
        if (dead) room.disconnect()
      } catch (e) { logDiag('live.peer', e) }
    })()
    return () => { dead = true; room?.disconnect() }
  }, [peerId])

  const send = (obj) => roomRef.current?.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(obj)), { reliable: true }).catch(() => {})
  const say = () => {
    const t = draft.trim()
    if (!t) return
    if (hasBadWord(t, words)) return showToast('التعليق فيه كلمة ممنوعة')
    send({ t: 'c', text: t.slice(0, 150) }); addComment({ name: 'انت', text: t.slice(0, 150), mine: true }); setDraft('')
  }
  const like = () => {
    send({ t: 'h' }); heart()
    // وقت التحدي: القلب نقطة للمضيف بتاع اللايف ده
    if (pk.cur?.status === 'live' && rec?.host) pkRose(pk.cur.id, rec.host)
  }
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
      <div className={peerId ? 'live-split' : 'live-one'}>
        {/* اللي بدأ التحدي (الأحمر) يمين، والتاني (الأزرق) شمال — زي الشريط */}
        <div className={`live-half ${iAmB ? 'live-second' : ''}`}>
          <video ref={videoRef} className={`live-video ${st.host && facing.current === 'user' ? 'live-mirror' : ''}`} autoPlay playsInline muted={st.host} />
          {peerId && <span className={`live-tag ${iAmB ? 'live-tag-b' : ''}`}>{rec?.hostName}</span>}
        </div>
        {peerId && <div className="live-half"><video ref={peerRef} className="live-video" autoPlay playsInline /><span className={`live-tag ${iAmB ? '' : 'live-tag-b'}`}>{peerName}</span></div>}
      </div>
      <div ref={audioBox} hidden />
      <div className="live-shade" />

      <header className="live-top">
        <button type="button" className="live-x" aria-label="خروج" onClick={() => navigate('/live')}>✕</button>
        <div className="live-host"><b>{rec?.hostName || '...'}</b><small>{rec?.title}</small></div>
        <span className="live-badge">🔴 لايف</span>
        <span className="live-views">👁 {ar(Math.max(st.viewers, rec?.viewers || 0))}</span>
      </header>

      <div className="live-pk">
        <PkBar pk={pk.cur} me={user.uid} royal={admin || st.host} showToast={showToast} act={livePkAct} onSupport={st.host ? undefined : (side) => {
          // في اللايف: الدعم لمضيف اللايف ده بس (الهدية بتروح لصاحب اللايف)
          const g = getQuickGift()
          const sideUid = side === 'A' ? pk.cur.a : pk.cur.b
          if (sideUid !== rec?.host) { showToast('👈 ادعمه من اللايف بتاعه'); return false }
          if (g.id === 'rose') { like(); return true }
          return sendGift(id, rec.host, g.id).then(() => true).catch((e) => { showToast(e?.response?.message || 'رصيدك مش مكفي 🪙'); return false })
        }} />
        {!pk.cur && <PkResult pk={pk.last} />}
      </div>
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
              {!pk.cur && <button type="button" className="live-btn" aria-label="تحدي" onClick={() => setSheet('pk')}>⚔️</button>}
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
      {sheet === 'pk' && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">⚔️ تحدي لايف</h2>
          <p className="sheet-sub">اختار مضيف عنده لايف دلوقتي. لو قبل، الشاشة هتتقسم نصين والجمهورين يدعموكم بالهدايا والقلوب. آخر دقيقة الهدايا بالضعف 🔥، والخسران عليه عقاب 🎭</p>
          <button type="button" className="card my-room-cta" onClick={() => { livePkAct({ action: 'random', live: id, mins: 5 }).then(() => showToast('🎲 لقينالك منافس! مستنيين يقبل')).catch((e) => showToast(e?.response?.message || 'حصلت مشكلة')); setSheet(null) }}>🎲 دوّرلي على منافس (٥ دقايق)</button>
          {(lives || []).filter((l) => l.id !== id).length === 0 && <p className="empty">مفيش لايف تاني شغال دلوقتي</p>}
          {(lives || []).filter((l) => l.id !== id).map((l) => (
            <div key={l.id} className="card admin-card">
              <div className="row-line"><b className="row-title">{l.hostName}</b><span className="row-time">👁 {ar(l.viewers || 0)}</span></div>
              <div className="mod-tools">
                {[3, 5, 10].map((m) => (
                  <button key={m} type="button" className="pill-btn pill-gold" onClick={() => { livePkAct({ action: 'invite', live: id, to: l.id, mins: m }).then(() => showToast(`⚔️ بعتنا التحدي لـ ${l.hostName}`)).catch((e) => showToast(e?.response?.message || 'حصلت مشكلة')); setSheet(null) }}>⚔️ {ar(m)} دقايق</button>
                ))}
              </div>
            </div>
          ))}
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
