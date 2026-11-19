// فقاعات الرسايل والارتباط: المتجر، طلب الارتباط، الرد عليه، وإعلان «مبروك»
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BUBBLES, RINGS, ringInfo, usePerks, bubbleOf, coupleOf, buyBubble, propose, answerProposal, cancelProposal, breakUp, useProposals, useCoupleEvents } from '../perks.js'
import { useAuth } from '../auth.jsx'
import { ar } from '../utils.js'
import { Sheet } from './ui.jsx'
import { Coin } from './Coins.jsx'

const fmt = (n) => Number(n || 0).toLocaleString('ar-EG')
const daysLeft = (until) => Math.max(0, Math.ceil((until - Date.now()) / 86400000))
const errMsg = (e) => e?.response?.message || e?.data?.message || 'مقدرناش نكمّل، جرب تاني'

// ===== متجر الفقاعات (جوه المحفظة) =====
export function BubbleShop({ uid, wallet, admin, showToast }) {
  const all = usePerks()
  const cur = bubbleOf(all, uid)
  const until = all[uid]?.bubbleUntil || 0
  const [busy, setBusy] = useState(null)
  const coins = wallet?.coins ?? 0
  async function buy(b) {
    setBusy(b.id)
    try { await buyBubble(b.id); showToast?.(`💬 رسايلك بقت بشكل ${b.name}`) } catch (e) { showToast?.(errMsg(e)) }
    setBusy(null)
  }
  return (
    <div className="bub-shop">
      <p className="vip-hint">{cur ? <>شكل رسايلك دلوقتي: <b>{BUBBLES.find((b) => b.id === cur)?.name}</b> — فاضل {ar(daysLeft(until))} يوم</> : 'شكل رسايلك يبقى مميز في كل الغرف والخاص — لمدة ٣٠ يوم'}</p>
      <div className="bub-grid">
        {BUBBLES.map((b) => {
          const same = cur === b.id
          const poor = !admin && coins < b.price
          return (
            <div key={b.id} className={`bub-item ${same ? 'on' : ''}`}>
              <span className={`bub bub-${b.id} bub-demo`}>أهلًا 👋</span>
              <b>{b.name}{b.shine && ' ✨'}</b>
              <button type="button" className="vip-buy" disabled={!!busy || poor} onClick={() => buy(b)}>
                {busy === b.id ? 'لحظة...' : <>{same ? 'جدّد' : 'اشتري'}<span><Coin size="sm" /> {admin ? 'ببلاش' : fmt(b.price)}</span></>}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ===== في بروفايل أي عضو: الارتباط =====
export function CoupleLine({ uid }) {
  const all = usePerks()
  const c = coupleOf(all, uid)
  const navigate = useNavigate()
  if (!c) return null
  const r = ringInfo(c.ring)
  const days = Math.max(0, Math.floor((Date.now() - c.since) / 86400000))
  return (
    <button type="button" className={`couple-line ring-${c.ring}`} onClick={() => navigate(`/u/${c.partner}`)}>
      {r?.icon} مرتبط بـ <b>{c.partnerName}</b> · {days ? `من ${ar(days)} يوم` : 'من النهارده'}
    </button>
  )
}

export function RingButton({ uid, name, showToast }) {
  const { user } = useAuth()
  const all = usePerks()
  const props = useProposals(user.uid)
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState(2)
  const [busy, setBusy] = useState(false)
  const [sure, setSure] = useState(false)
  const mine = coupleOf(all, user.uid)
  const his = coupleOf(all, uid)
  const sent = props.find((p) => p.asker === user.uid && p.target === uid)
  const got = props.find((p) => p.asker === uid && p.target === user.uid)
  const run = async (fn, ok) => { setBusy(true); try { await fn(); if (ok) showToast(ok) } catch (e) { showToast(errMsg(e)) } setBusy(false) }

  if (mine && (mine.partner === uid || uid === user.uid)) {
    return (
      <button type="button" className="btn-outline danger-text" disabled={busy} onClick={() => { if (!sure) { setSure(true); return } setSure(false); run(breakUp, '💔 الارتباط اتفك') }}>
        {sure ? 'متأكد؟ دوس تاني لفك الارتباط' : '💔 فك الارتباط'}
      </button>
    )
  }
  if (uid === user.uid) return null
  if (got) return <ProposalCard p={got} showToast={showToast} />
  if (sent) return <button type="button" className="btn-outline" disabled={busy} onClick={() => run(() => cancelProposal(sent.id), 'اتلغى الطلب والكوينز رجعتلك')}>⏳ مستني رده — إلغاء الطلب</button>
  if (mine || his) return null
  return (
    <>
      <button type="button" className="btn-outline ring-btn" onClick={() => setOpen(true)}>💍 اطلب الارتباط</button>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">💍 اطلب الارتباط بـ {name}</h2>
          <div className="ring-list">
            {RINGS.map((r) => (
              <button key={r.ring} type="button" className={`ring-opt ${pick === r.ring ? 'on' : ''}`} onClick={() => setPick(r.ring)}>
                <span className={`ring-ic ring-ic${r.ring}`}>{r.icon}</span>
                <span className="ring-tx"><b>{r.name}</b><small>{r.perk}</small></span>
                <span className="ring-pr"><Coin size="sm" /> {fmt(r.price)}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary ring-send" disabled={busy} onClick={() => run(async () => { await propose(uid, pick); setOpen(false) }, `💌 الطلب اتبعت لـ ${name}`)}>
            {busy ? 'لحظة...' : `ابعت الطلب لـ ${name} 💌`}
          </button>
          <p className="ring-note">لو رفض أو مردّش خلال يومين، الكوينز بترجعلك كاملة.<br />وأي حد فيكم يقدر يفك الارتباط من البروفايل.</p>
        </Sheet>
      )}
    </>
  )
}

function ProposalCard({ p, showToast, onDone }) {
  const [busy, setBusy] = useState(false)
  const r = ringInfo(p.ring)
  const go = async (ok) => {
    setBusy(true)
    try { await answerProposal(p.id, ok); showToast?.(ok ? `💞 مبروك! انت و${p.askerName} ارتبطتوا` : 'رفضت الطلب'); onDone?.() } catch (e) { showToast?.(errMsg(e)) }
    setBusy(false)
  }
  return (
    <div className="prop-card">
      <div className="prop-big">{r?.icon}💍</div>
      <p><b>{p.askerName}</b> عايز يرتبط بيك ب{r?.name} 💌</p>
      <div className="prop-acts">
        <button type="button" className="prop-ok" disabled={busy} onClick={() => go(true)}>موافقة 💞</button>
        <button type="button" className="prop-no" disabled={busy} onClick={() => go(false)}>لا شكرًا</button>
      </div>
    </div>
  )
}

// ===== في أي حتة في التطبيق: طلب جديدلي + إعلان «مبروك» =====
export function PerksKeeper() {
  const { user } = useAuth()
  if (!user) return null
  return <><IncomingProposal uid={user.uid} /><CoupleCelebration /></>
}

function IncomingProposal({ uid }) {
  const props = useProposals(uid)
  const [hidden, setHidden] = useState({})
  const [toast, setToast] = useState('')
  const p = props.find((x) => x.target === uid && !hidden[x.id])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t) }, [toast])
  return (
    <>
      {p && (
        <div className="prop-shade" onClick={() => setHidden((h) => ({ ...h, [p.id]: true }))}>
          <div onClick={(e) => e.stopPropagation()}>
            <ProposalCard p={p} showToast={setToast} onDone={() => setHidden((h) => ({ ...h, [p.id]: true }))} />
            <button type="button" className="prop-later" onClick={() => setHidden((h) => ({ ...h, [p.id]: true }))}>بعدين (هتلاقيه في بروفايله)</button>
          </div>
        </div>
      )}
      {toast && <div className="prop-toast">{toast}</div>}
    </>
  )
}

function CoupleCelebration() {
  const [cur, setCur] = useState(null)
  useCoupleEvents((ev) => setCur({ ...ev, key: ev.id }))
  useEffect(() => {
    if (!cur) return
    const t = setTimeout(() => setCur(null), cur.ring === 3 ? 6000 : 4500)
    return () => clearTimeout(t)
  }, [cur])
  if (!cur) return null
  const r = ringInfo(cur.ring)
  return (
    <>
      {cur.ring === 3 && (
        <div key={cur.key + 'h'} className="hearts" aria-hidden="true">
          {Array.from({ length: 26 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * 0.35}s`, fontSize: `${18 + (i % 4) * 7}px` }}>{['💖', '💗', '💞', '💕'][i % 4]}</i>)}
        </div>
      )}
      <div key={cur.key} className={`couple-ann ring-${cur.ring}`}>
        <span className="couple-rings">{r?.icon}💍{r?.icon}</span>
        <b>مبروك! {cur.aName} و{cur.bName} ارتبطوا 💞</b>
        <small>ب{r?.name}</small>
      </div>
    </>
  )
}
