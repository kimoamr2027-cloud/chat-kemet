// واجهة الكوينز: الرصيد، مكافأة اليوم، المحفظة، الحصالة، وهدايا الأدمن
import { useState } from 'react'
import { Sheet } from './ui.jsx'
import { useAuth, isGuest } from '../auth.jsx'
import { GuestWall } from './Signup.jsx'
import { useUser } from '../dm.js'
import { ar } from '../utils.js'
import { fmtWhen } from '../rooms.js'
import { DAILY, dailyState, claimDaily, useCoinLog, useRichest, potOf, giftCoins, useWallet, useAutoRefunds } from '../coins.js'
import { isAdminUid } from '../roles.js'
import { VipShop } from './Vip.jsx'
import { TopupPanel } from './Topup.jsx'
import { BubbleShop } from './Perks.jsx'

export const fmtCoins = (n) => ar(Number(n || 0).toLocaleString('en-US').replace(/,/g, '٬'))

// الكوين: عملة دهب بقناع توت عنخ آمون (الصورة اللي اختارها الأدمن)
const BASE = import.meta.env.BASE_URL
export function Coin({ size = 'md' }) {
  return <img className={`coin coin-${size}`} src={`${BASE}${size === 'lg' ? 'coin.webp' : 'coin-sm.webp'}`} alt="" aria-hidden="true" draggable="false" />
}

// بيعمل المحفظة أول مرة ويرجّع أي دخولية ليك (بيشتغل في التطبيق كله)
export function CoinKeeper() {
  const { user, profile, roles } = useAuth()
  // الزائر كمان ليه محفظة (١٠٠ كوين يلعب بيها)
  const uid = user && profile ? user.uid : null
  useWallet(uid)
  useAutoRefunds(uid, roles.admins || [], roles.loaded)
  return null
}

export function CoinChip({ wallet, admin, onClick }) {
  return (
    <button type="button" className="coin-chip" onClick={onClick} aria-label="كوينزاتي">
      <Coin />
      <b>{admin ? '∞' : wallet ? fmtCoins(wallet.coins) : '...'}</b>
      <span className="coin-plus">+</span>
    </button>
  )
}

export function DailyPopup({ uid, wallet, onClose, showToast }) {
  const st = dailyState(wallet)
  const [busy, setBusy] = useState(false)
  if (!st || st.claimed) return null
  const take = async () => {
    setBusy(true)
    try { const n = await claimDaily(uid); showToast(`🎁 خدت ${ar(n)} كوين!`) } catch { showToast('مقدرناش نجيب المكافأة، جرب تاني') }
    setBusy(false)
    onClose()
  }
  return (
    <div className="coin-scrim" role="dialog" aria-label="مكافأة اليوم">
      <div className="coin-pop">
        <div className="l-ribbon">🎁 هدية التسجيل</div>
        <h2>{st.streak === 1 ? 'أهلًا بيك في شات كيمت! 👋' : `اليوم ${['', 'الأول', 'التاني', 'التالت', 'الرابع', 'الخامس', 'السادس', 'السابع'][st.streak]} من ٧ 🔥`}</h2>
        <p>أول ٧ أيام من تسجيلك بتنزلك هدية كل يوم، وكل يوم أكبر من اللي قبله. لو فوّت يوم، هديته بتروح.</p>
        <div className="coin-days">
          {DAILY.map((v, i) => (
            <div key={i} className={`coin-day ${i + 1 < st.streak ? 'done' : ''} ${i + 1 === st.streak ? 'today' : ''} ${i === 6 ? 'big' : ''}`}>
              يوم {ar(i + 1)}{i === 6 ? ' 🎉' : ''}<Coin size="sm" /><b>{fmtCoins(v)}</b>
            </div>
          ))}
        </div>
        <button type="button" className="lbtn lbtn-green coin-take" disabled={busy} onClick={take}>{busy ? 'لحظة...' : `خد ${fmtCoins(st.reward)} كوين`}</button>
      </div>
    </div>
  )
}

const KIND_IC = { bubble: '💬', ring: '💍', 'ring-back': '↩️', vip: '👑', 'gift-got': '💝', played: '🎲', voice: '🎙',  welcome: '🎉', 'guest-gift': '🎁', daily: '🎁', fee: '🪑', refund: '↩️', win: '🏆', quiz: '🎬', gift: '🎁', 'gift-sent': '💝' }
function RichRow({ uid, coins, k, me }) {
  const u = useUser(uid)
  return (
    <li className={`board-row ${uid === me ? 'board-me' : ''}`}>
      <span className="board-rank">{['🥇', '🥈', '🥉'][k] || ar(k + 1)}</span>
      <span className="board-name">{u?.name || '...'}{uid === me ? ' (انت)' : ''}</span>
      <span className="board-pts"><Coin size="sm" /> {fmtCoins(coins)}</span>
    </li>
  )
}
export function WalletSheet({ uid, wallet, admin, onClose, showToast, start = 'log' }) {
  const [tab, setTab] = useState(start)
  const log = useCoinLog(uid, tab === 'log')
  const rich = useRichest(tab === 'rich')
  const { roles, user, profile } = useAuth()
  const guest = isGuest(user, profile)
  // الشحن وVIP والفقاعات للمسجّلين بس
  const locked = guest && (tab === 'top' || tab === 'vip' || tab === 'bub')
  return (
    <Sheet onClose={onClose}>
      <span className="grabber" aria-hidden="true" />
      <div className="coin-wallet">
        <small>رصيدك</small>
        <div className="coin-big"><Coin size="lg" />{admin ? '∞' : fmtCoins(wallet?.coins)}</div>
        <small>{admin ? 'انت الأدمن: رصيدك غير محدود، وبتقدر تهادي الأعضاء من بروفايلهم' : 'الكوينز بتتكسب من الألعاب، والغرفة الصوتية، والهدايا اللي بتجيلك'}</small>
      </div>
      <div className="coin-tabs">
        <button type="button" className={`coin-tab-top ${tab === 'top' ? 'on' : ''}`} onClick={() => setTab('top')}>➕ اشحن</button>
        <button type="button" className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>اللي دخل وخرج</button>
        <button type="button" className={tab === 'rich' ? 'on' : ''} onClick={() => setTab('rich')}>أغنى الأعضاء</button>
        <button type="button" className={`coin-tab-vip ${tab === 'vip' ? 'on' : ''}`} onClick={() => setTab('vip')}>👑 VIP</button>
        <button type="button" className={`coin-tab-vip ${tab === 'bub' ? 'on' : ''}`} onClick={() => setTab('bub')}>💬 فقاعات</button>
      </div>
      {locked ? <GuestWall icon="🔒" title="الشحن وVIP والفقاعات للأعضاء المسجّلين" why="سجّل حسابك ببلاش وخد ٤٠٠ كوين كمان، وهدايا كل يوم لمدة أسبوع" /> : tab === 'bub' ? <BubbleShop uid={uid} wallet={wallet} admin={admin} showToast={showToast || ((m) => alert(m))} /> : tab === 'top' ? <TopupPanel uid={uid} Coin={Coin} showToast={showToast || ((m) => alert(m))} /> : tab === 'vip' ? <VipShop uid={uid} wallet={wallet} admin={admin} showToast={showToast || ((m) => alert(m))} Coin={Coin} /> : tab === 'log' ? (
        log === null ? <p className="game-hint">بيحمّل...</p> : log.length === 0 ? <p className="game-hint">لسه مفيش حركة.</p> : (
          <div className="coin-log">
            {log.map((x) => (
              <div key={x.id} className="coin-h">
                <i>{KIND_IC[x.kind] || <Coin size="sm" />}</i>
                <span>{x.note}<small>{x.at?.toDate ? fmtWhen(x.at.toDate()) : ''}</small></span>
                <b className={x.amount >= 0 ? 'plus' : 'minus'}>{x.amount >= 0 ? '+' : '−'}{fmtCoins(Math.abs(x.amount))}</b>
              </div>
            ))}
          </div>
        )
      ) : (
        rich === null ? <p className="game-hint">بيحمّل...</p> : (
          <ol className="board">{rich.filter((r) => !isAdminUid(roles, r.uid)).map((r, k) => <RichRow key={r.uid} {...r} k={k} me={uid} />)}</ol>
        )
      )}
    </Sheet>
  )
}

// سطر الحصالة في شاشة الفوز
export function PotLine({ t }) {
  const { roles } = useAuth()
  if (t.local) return <p className="coin-potline">🤖 لعبة تمرين: من غير كوينز ولا ترتيب</p>
  const admins = roles.admins || []
  if (admins.includes(t.winner)) return t.fee ? <p className="coin-potline">↩️ الأدمن كسب، فكل واحد رجعتله دخوليته</p> : null
  return <div className="coin-burst"><Coin size="lg" />+{fmtCoins(potOf(t, admins))}</div>
}

// هدية من الأدمن لعضو
export function GiftButton({ uid, name, showToast }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [amount, setAmount] = useState('')
  const give = async (n) => {
    if (!(n >= 1 && n <= 100000)) return showToast('اكتب رقم من ١ لحد ١٠٠٬٠٠٠')
    setBusy(true)
    try { await giftCoins(uid, n); showToast(`🎁 ${name} خد ${fmtCoins(n)} كوين`); setOpen(false); setAmount('') } catch (e) { showToast(e?.response?.message || 'مقدرناش نبعت الهدية، جرب تاني') }
    setBusy(false)
  }
  // الأرقام العربي (٠-٩) بتتحوّل لإنجليزي علشان الحساب
  const typed = parseInt(String(amount).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, ''), 10) || 0
  return (
    <>
      <button type="button" className="btn-outline profile-btn" onClick={() => setOpen(true)}>🎁 هدية كوينز</button>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">🎁 هدية كوينز لـ {name}</h2>
          <p className="sheet-sub">الكوينز هتتضاف لرصيده على طول، وهتظهرله في السجل «هدية من الأدمن».</p>
          <div className="gift-amount">
            <input className="input" inputMode="numeric" maxLength={7} placeholder="اكتب أي رقم..." value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button type="button" className="btn-primary" disabled={busy || !typed} onClick={() => give(typed)}><Coin size="sm" /> {busy ? 'لحظة...' : typed ? `اهدي ${fmtCoins(typed)}` : 'اهدي'}</button>
          </div>
          <p className="game-label">أو اختار بسرعة</p>
          <div className="game-pick">
            {[100, 500, 1000, 5000].map((n) => (
              <button key={n} type="button" className="game-opt" disabled={busy} onClick={() => setAmount(String(n))}><Coin size="sm" /> {fmtCoins(n)}</button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  )
}

export function useMyCoins() {
  const { user, roles } = useAuth()
  const wallet = useWallet(user?.uid)
  return { wallet, admin: isAdminUid(roles, user?.uid) }
}
