// 🎁 ابعت هدية في غرفة الكتابة: تختار لمين (من اللي في الغرفة) وأنهي هدية
import { useState } from 'react'
import { Avatar, Sheet } from './ui.jsx'
import { Coin, fmtCoins, useMyCoins } from './Coins.jsx'
import { useAvatar } from '../dm.js'
import { colorIndex } from '../rooms.js'
import { GIFTS, giftOf, sendGift } from '../gifts.js'

function Who({ p, on, onPick }) {
  const src = useAvatar(p.uid)
  return (
    <button type="button" className={`gs-p ${on ? 'on' : ''}`} onClick={onPick}>
      <span><Avatar text={(p.name || '؟').charAt(0)} c={colorIndex(p.uid)} size={46} round src={src || undefined} uid={p.uid} /></span>{p.name}
    </button>
  )
}

export default function GiftSheet({ room, people, to, onClose, showToast }) {
  const { wallet, admin } = useMyCoins()
  const [giftTo, setGiftTo] = useState(to || people[0]?.uid || '')
  const [giftId, setGiftId] = useState(GIFTS[0].id)
  const [sending, setSending] = useState(false)
  const send = async () => {
    const g = giftOf(giftId)
    if (!giftTo) return showToast('اختار تبعت لمين')
    if (!admin && (wallet?.coins ?? 0) < g.price) return showToast('رصيدك مش مكفي 🪙')
    setSending(true)
    try { await sendGift(room, giftTo, giftId); onClose() } catch (e) { showToast(e?.response?.message || 'الهدية ماتبعتتش، جرب تاني') }
    setSending(false)
  }
  return (
    <Sheet onClose={onClose}>
      <h2 className="gs-title">🎁 ابعت هدية</h2>
      <p className="gs-lbl">لمين؟</p>
      {people.length === 0 ? <p className="game-hint">لسه مفيش حد غيرك في الغرفة</p> : (
        <div className="gs-to">{people.map((p) => <Who key={p.uid} p={p} on={giftTo === p.uid} onPick={() => setGiftTo(p.uid)} />)}</div>
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
        <span className="gs-bal">{admin ? '👑 انت الأدمن: الهدايا ببلاش' : <>رصيدك: <Coin size="sm" /> {fmtCoins(wallet?.coins)}</>}</span>
        <button type="button" className="btn-primary" style={{ width: 'auto', padding: '0 20px' }} disabled={sending || !giftTo} onClick={send}>
          {sending ? 'لحظة...' : `ابعت ${giftOf(giftId).name}`}
        </button>
      </div>
    </Sheet>
  )
}
