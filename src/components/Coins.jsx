// واجهة الكوينز: الرصيد، مكافأة اليوم، المحفظة، الحصالة، وهدايا الأدمن
import { useState } from 'react'
import { Sheet } from './ui.jsx'
import { useAuth } from '../auth.jsx'
import { useUser } from '../dm.js'
import { ar } from '../utils.js'
import { fmtWhen } from '../rooms.js'
import { DAILY, dailyState, claimDaily, useCoinLog, useRichest, potOf, giftCoins, useWallet, useAutoRefunds } from '../coins.js'
import { isAdminUid } from '../roles.js'

export const fmtCoins = (n) => ar(Number(n || 0).toLocaleString('en-US').replace(/,/g, '٬'))

export function Coin({ size = 'md' }) {
  return <span className={`coin coin-${size}`} aria-hidden="true">ك</span>
}

// بيعمل المحفظة أول مرة ويرجّع أي دخولية ليك (بيشتغل في التطبيق كله)
export function CoinKeeper() {
  const { user, profile, roles } = useAuth()
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
        <div className="l-ribbon">🎁 مكافأة اليوم</div>
        <h2>{st.streak === 1 ? 'أهلًا بيك النهارده! 👋' : `اليوم ${['', 'الأول', 'التاني', 'التالت', 'الرابع', 'الخامس', 'السادس', 'السابع'][st.streak]} ورا بعض! 🔥`}</h2>
        <p>ادخل كل يوم والمكافأة بتكبر. لو فوّت يوم بتبدأ من الأول.</p>
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

const KIND_IC = { welcome: '🎉', daily: '🎁', fee: '🪑', refund: '↩️', win: '🏆', quiz: '🎬', gift: '🎁' }
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
export function WalletSheet({ uid, wallet, admin, onClose }) {
  const [tab, setTab] = useState('log')
  const log = useCoinLog(uid, tab === 'log')
  const rich = useRichest(tab === 'rich')
  const { roles } = useAuth()
  return (
    <Sheet onClose={onClose}>
      <span className="grabber" aria-hidden="true" />
      <div className="coin-wallet">
        <small>رصيدك</small>
        <div className="coin-big"><Coin size="lg" />{admin ? '∞' : fmtCoins(wallet?.coins)}</div>
        <small>{admin ? 'انت الأدمن: رصيدك غير محدود، وبتقدر تهادي الأعضاء من بروفايلهم' : 'الكوينز بتتكسب من مكافأة اليوم، والألعاب، ومسابقة كيمت'}</small>
      </div>
      <div className="coin-tabs">
        <button type="button" className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>اللي دخل وخرج</button>
        <button type="button" className={tab === 'rich' ? 'on' : ''} onClick={() => setTab('rich')}>👑 أغنى الأعضاء</button>
      </div>
      {tab === 'log' ? (
        log === null ? <p className="game-hint">بيحمّل...</p> : log.length === 0 ? <p className="game-hint">لسه مفيش حركة.</p> : (
          <div className="coin-log">
            {log.map((x) => (
              <div key={x.id} className="coin-h">
                <i>{KIND_IC[x.kind] || '🪙'}</i>
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
  const admins = roles.admins || []
  if (admins.includes(t.winner)) return t.fee ? <p className="coin-potline">↩️ الأدمن كسب، فكل واحد رجعتله دخوليته</p> : null
  return <div className="coin-burst"><Coin size="lg" />+{fmtCoins(potOf(t, admins))}</div>
}

// هدية من الأدمن لعضو
export function GiftButton({ uid, name, showToast }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const give = async (n) => {
    setBusy(true)
    try { await giftCoins(uid, n); showToast(`🎁 ${name} خد ${fmtCoins(n)} كوين`); setOpen(false) } catch { showToast('العضو ده لسه مافتحش الألعاب، جرب بعدين') }
    setBusy(false)
  }
  return (
    <>
      <button type="button" className="btn-outline profile-btn" onClick={() => setOpen(true)}>🎁 هدية كوينز</button>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <span className="grabber" aria-hidden="true" />
          <h2 className="sheet-title">🎁 هدية كوينز لـ {name}</h2>
          <p className="sheet-sub">الكوينز هتتضاف لرصيده على طول، وهتظهرله في السجل «هدية من الأدمن».</p>
          <div className="game-pick">
            {[100, 500, 1000, 5000].map((n) => (
              <button key={n} type="button" className="game-opt" disabled={busy} onClick={() => give(n)}><Coin size="sm" /> {fmtCoins(n)}</button>
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
