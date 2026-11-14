// كارت "مسابقة كيمت" فوق الغرفة + شاشة البدء + ترتيب الأسبوع
import { useEffect, useRef, useState } from 'react'
import { Sheet } from './ui.jsx'
import { ar } from '../utils.js'
import { useNow } from '../presence.js'
import { logDiag } from '../diag.js'
import {
  GAME_TYPES, ROUND_MS, GAP_MS, displayAnswer, startGame, nextRound, timeoutRound, endGame, stopGame, useLeaderboard,
} from '../games.js'

export function GameCard({ roomId, game, iMod, me, myName, showToast, openBoard }) {
  const now = useNow(1000)
  const [hidden, setHidden] = useState(false)
  const acting = useRef('')
  const left = Math.min(ROUND_MS / 1000, Math.max(0, Math.ceil((game.roundAt + ROUND_MS - now) / 1000)))
  const doneAt = game.solvedAt || (game.status === 'open' ? now : game.roundAt + ROUND_MS)

  // اللي بدأ المسابقة بيحرّكها (ولو خرج، أي مشرف موجود يكمّل بعد شوية)
  useEffect(() => {
    if (!iMod) return
    const grace = game.startedBy === me ? 0 : 12000
    const key = `${game.round}-${game.status}`
    if (acting.current === key) return
    if (game.status === 'open' && now > game.roundAt + ROUND_MS + grace) {
      acting.current = key
      timeoutRound(roomId, game).catch((e) => logDiag('quiz.timeout', e))
    } else if ((game.status === 'solved' || game.status === 'timeout') && now > doneAt + GAP_MS + grace) {
      acting.current = key
      nextRound(roomId, game, me, myName).catch((e) => logDiag('quiz.next', e))
    }
  }, [now, game, iMod, me, myName, roomId, doneAt])

  useEffect(() => { if (game.status !== 'ended') setHidden(false) }, [game.status])
  if (hidden && game.status === 'ended') return null

  const t = GAME_TYPES[game.type] || GAME_TYPES.trivia
  const answer = game.status === 'solved' ? displayAnswer(game) : game.answer
  const skip = () => {
    acting.current = `${game.round}-skip`
    ;(game.status === 'open' ? timeoutRound(roomId, game) : nextRound(roomId, game, me, myName)).catch(() => showToast('حصلت مشكلة'))
  }

  if (game.status === 'ended') {
    return (
      <section className="game-card game-ended" aria-label="مسابقة كيمت">
        <div className="game-top">
          <span className="game-title">🏁 المسابقة خلصت!</span>
          <button type="button" className="game-x" aria-label="إخفاء" onClick={() => (iMod ? endGame(roomId) : setHidden(true))}>✕</button>
        </div>
        <button type="button" className="pill-btn pill-gold game-board-btn" onClick={openBoard}>🏆 شوف ترتيب الأسبوع</button>
      </section>
    )
  }

  return (
    <section className="game-card" aria-label="مسابقة كيمت">
      <div className="game-top">
        <span className="game-title">{t.icon} {t.label}</span>
        <span className="game-round">سؤال {ar(game.round)} من {ar(game.total)}</span>
        {game.status === 'open' && <span className={`game-timer ${left <= 10 ? 'game-timer-low' : ''}`}>⏱ {ar(left)}</span>}
        <button type="button" className="game-x" aria-label="الترتيب" onClick={openBoard}>🏆</button>
      </div>
      <p className="game-ask">{t.ask}{game.hint ? ` — ${game.hint}` : ''}</p>
      <p className={`game-prompt ${game.type === 'emoji' ? 'game-emoji' : ''}`} dir={game.type === 'emoji' ? 'ltr' : undefined}>{game.prompt}</p>
      {game.status === 'open' ? (
        <p className="game-hint">اكتب الإجابة في الشات، وأول واحد يجاوب صح ياخد نقطة ✨</p>
      ) : game.status === 'solved' ? (
        <p className="game-result game-win">🎉 <b>{game.winnerName}</b> جاوب صح! الإجابة: <b>{answer}</b></p>
      ) : (
        <p className="game-result">⏰ الوقت خلص! الإجابة كانت: <b>{answer}</b></p>
      )}
      {iMod && (
        <div className="game-tools">
          <button type="button" className="pill-btn" onClick={skip}>{game.round >= game.total && game.status !== 'open' ? '🏁 النتيجة' : '⏭ السؤال الجاي'}</button>
          <button type="button" className="pill-btn pill-danger" onClick={() => stopGame(roomId).catch(() => showToast('حصلت مشكلة'))}>⏹ إنهاء المسابقة</button>
        </div>
      )}
    </section>
  )
}

export function StartGameSheet({ roomId, me, myName, onClose, showToast, running }) {
  const [type, setType] = useState('mix')
  const [total, setTotal] = useState(10)
  const [busy, setBusy] = useState(false)
  const start = async () => {
    setBusy(true)
    try {
      await startGame(roomId, type, total, me, myName)
      onClose()
      showToast('🎮 المسابقة بدأت!')
    } catch {
      showToast('مقدرناش نبدأ المسابقة، جرب تاني')
    }
    setBusy(false)
  }
  return (
    <Sheet onClose={onClose}>
      <span className="grabber" aria-hidden="true" />
      <h2 className="sheet-title">🎮 مسابقة كيمت</h2>
      <p className="sheet-sub">السؤال هيظهر لكل اللي في الغرفة، وأول واحد يكتب الإجابة الصح في الشات ياخد نقطة.{running ? ' (المسابقة الحالية هتتقفل وتبدأ واحدة جديدة)' : ''}</p>
      <div className="game-pick" role="radiogroup" aria-label="نوع اللعبة">
        {Object.entries(GAME_TYPES).map(([k, v]) => (
          <button key={k} type="button" role="radio" aria-checked={type === k} className={`game-opt ${type === k ? 'on' : ''}`} onClick={() => setType(k)}>
            <span className="game-opt-ic">{v.icon}</span>{v.label}
          </button>
        ))}
      </div>
      <p className="game-label">عدد الأسئلة</p>
      <div className="game-counts" role="radiogroup" aria-label="عدد الأسئلة">
        {[5, 10, 15, 20].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={total === n} className={`game-opt game-count ${total === n ? 'on' : ''}`} onClick={() => setTotal(n)}>{ar(n)}</button>
        ))}
      </div>
      <button type="button" className="btn-primary" disabled={busy} onClick={start}>{busy ? 'لحظة...' : 'ابدأ المسابقة'}</button>
    </Sheet>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']
export function LeaderboardSheet({ onClose, me }) {
  const list = useLeaderboard(true)
  return (
    <Sheet onClose={onClose}>
      <span className="grabber" aria-hidden="true" />
      <h2 className="sheet-title">🏆 ترتيب الأسبوع</h2>
      <p className="sheet-sub">كل إجابة صح في مسابقة كيمت بنقطة. الترتيب بيبدأ من جديد كل أسبوع.</p>
      {list === null ? <p className="game-hint">بيحمّل...</p> : list.length === 0 ? (
        <p className="game-hint">لسه محدش جاوب الأسبوع ده. كن أول واحد! 💪</p>
      ) : (
        <ol className="board">
          {list.map((s, i) => (
            <li key={s.uid} className={`board-row ${s.uid === me ? 'board-me' : ''}`}>
              <span className="board-rank">{MEDALS[i] || ar(i + 1)}</span>
              <span className="board-name">{s.name}{s.uid === me ? ' (انت)' : ''}</span>
              <span className="board-pts">{ar(s.points)} {s.points === 1 ? 'نقطة' : s.points === 2 ? 'نقطتين' : 'نقط'}</span>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  )
}

