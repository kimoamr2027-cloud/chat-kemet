// كارت الغرفة الصوتية في قايمة الغرف
import { Link } from 'react-router-dom'
import { Avatar } from './ui.jsx'
import { colorIndex } from '../rooms.js'
import { ar } from '../utils.js'
import { useVoiceRoom, seatedCount, VOICE_ROOM } from '../voice.js'

export default function VoiceCard() {
  const v = useVoiceRoom(VOICE_ROOM)
  if (!v) return null
  const seated = [...v.seats.center, ...v.seats.ring].filter(Boolean)
  const n = seatedCount(v)
  const listening = Math.max(0, (v.here || 0) - n)
  return (
    <Link to={`/voice/${v.id}`} className="voice-card">
      <span className="voice-thumb">👑</span>
      <span className="voice-b">
        <b>{v.name}{n > 0 && <span className="voice-live"><i />مباشر</span>}</b>
        <small>🎙 غرفة صوتية{n ? ` · ${ar(n)} على الكراسي` : ''}{listening ? ` · ${ar(listening)} بيسمعوا` : ''}{!n && !listening ? ' · ادخل وابدأ الكلام' : ''}</small>
        {seated.length > 0 && (
          <span className="voice-faces">{seated.slice(0, 5).map((s) => <Avatar key={s.uid} text={s.name.charAt(0)} c={colorIndex(s.uid)} size={24} round />)}</span>
        )}
      </span>
      <span className="voice-join">ادخل 🎧</span>
    </Link>
  )
}
