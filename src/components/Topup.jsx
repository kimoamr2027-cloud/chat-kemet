// شحن الكوينز بفودافون كاش: العضو (جوه المحفظة) والأدمن (صفحة الأدمن)
import { useEffect, useRef, useState } from 'react'
import { PACKS, bonusOf, getPay, setPayNumber, sendTopup, adminTopups, decideTopup, useMyTopups, getEarnings } from '../topup.js'
import { compressImage } from '../media.js'
import { ar } from '../utils.js'
import { fmtWhen } from '../rooms.js'

const fmt = (n) => Number(n || 0).toLocaleString('ar-EG')
const STATUS = { pending: ['⏳', 'مستني الأدمن'], approved: ['✅', 'الكوينز نزلت'], rejected: ['❌', 'اترفض'] }
const when = (s) => { try { return fmtWhen(new Date(String(s).replace(' ', 'T'))) } catch { return '' } }

// ===== العضو =====
export function TopupPanel({ uid, Coin, showToast }) {
  const [pay, setPay] = useState(null)
  const [pick, setPick] = useState(2)
  const [step, setStep] = useState('pick')
  const [sender, setSender] = useState('')
  const [proof, setProof] = useState(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const mine = useMyTopups(uid)
  useEffect(() => { getPay().then(setPay).catch(() => setPay({ vodafone: '' })) }, [])
  const [egp, coins] = PACKS[pick]

  async function onFile(ev) {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f) return
    try { setProof((await compressImage(f, 1100, 440000)).dataUrl) } catch { showToast('الصورة دي مش نافعة، جرب صورة تانية') }
  }
  async function submit() {
    if (!/^01[0125]\d{8}$/.test(sender.replace(/\D/g, ''))) return showToast('اكتب الرقم اللي حوّلت منه صح (١١ رقم)')
    if (!proof) return showToast('ارفع صورة رسالة التحويل')
    setBusy(true)
    try {
      await sendTopup(pick, sender.replace(/\D/g, ''), proof)
      setStep('sent'); setSender(''); setProof(null)
    } catch (e) { showToast(e?.response?.message || 'مقدرناش نبعت الطلب، جرب تاني') }
    setBusy(false)
  }
  function copy() {
    navigator.clipboard?.writeText(pay.vodafone).then(() => showToast('اتنسخ الرقم 📋')).catch(() => {})
  }

  if (pay === null) return <p className="game-hint">بيحمّل...</p>
  if (!pay.vodafone) return <p className="game-hint">الشحن مش متاح دلوقتي — استنى الأدمن يفعّله 🙏</p>
  return (
    <div className="tp">
      {step === 'pick' && (
        <>
          <p className="tp-sub">٥٠ كوين بجنيه — والباقات الكبيرة عليها هدية زيادة 🎁</p>
          <div className="tp-packs">
            {PACKS.map((p, i) => (
              <button key={i} type="button" className={`tp-pk ${pick === i ? 'on' : ''} ${i === 4 ? 'wide' : ''}`} onClick={() => setPick(i)}>
                {i === 2 && <span className="tp-tag">الأكتر طلبًا</span>}
                {i === 4 && <span className="tp-tag tp-tag-red">👑 تكفي VIP الفرعون</span>}
                <span className="tp-c"><Coin size="sm" />{fmt(p[1])}</span>
                <span className="tp-bonus">{bonusOf(p) ? `+${fmt(bonusOf(p))} هدية` : ' '}</span>
                <span className="tp-egp">{ar(p[0])} جنيه</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary" onClick={() => setStep('pay')}>كمّل — {ar(egp)} جنيه</button>
        </>
      )}
      {step === 'pay' && (
        <>
          <div className="tp-sum"><span>الباقة: <Coin size="sm" /> {fmt(coins)}</span><span>المبلغ: {ar(egp)} جنيه</span></div>
          <div className="tp-step"><span className="tp-n">١</span><div><b>حوّل {ar(egp)} جنيه بفودافون كاش على الرقم ده</b>
            <button type="button" className="tp-vf" onClick={copy}><span>{pay.vodafone}</span><i>نسخ</i></button></div></div>
          <div className="tp-step"><span className="tp-n">٢</span><div><b>اكتب الرقم اللي حوّلت منه</b>
            <input className="input tp-inp" inputMode="numeric" dir="ltr" maxLength={14} placeholder="01xxxxxxxxx" value={sender} onChange={(e) => setSender(e.target.value)} /></div></div>
          <div className="tp-step"><span className="tp-n">٣</span><div><b>ارفع صورة رسالة التحويل</b>
            <input ref={fileRef} type="file" accept="image/*" className="file-hidden" onChange={onFile} />
            <button type="button" className={`tp-up ${proof ? 'ok' : ''}`} onClick={() => fileRef.current?.click()}>
              {proof ? <><img src={proof} alt="" /> اتختارت ✔ (دوس تغيّرها)</> : '📷 اختار صورة من الموبايل'}
            </button></div></div>
          <button type="button" className="btn-primary tp-send" disabled={busy} onClick={submit}>{busy ? 'لحظة...' : 'ابعت الطلب'}</button>
          <button type="button" className="tp-back" onClick={() => setStep('pick')}>رجوع للباقات</button>
        </>
      )}
      {step === 'sent' && (
        <div className="tp-done">
          <b>⏳ الطلب اتبعت!</b>
          <span>الأدمن هيتأكد من التحويل والكوينز هتنزلك، وهيجيلك إشعار أول ما تنزل.</span>
          <button type="button" className="btn-outline" onClick={() => setStep('pick')}>اشحن تاني</button>
        </div>
      )}
      {mine?.length > 0 && (
        <div className="tp-mine">
          <p className="tp-sub">طلباتك</p>
          {mine.map((r) => (
            <div key={r.id} className={`tp-row tp-${r.status}`}>
              <span>{STATUS[r.status]?.[0]}</span>
              <span className="tp-row-b"><b>{ar(r.egp)} جنيه → {fmt(r.coins)} كوين</b><small>{STATUS[r.status]?.[1]}{r.note ? ` — ${r.note}` : ''} · {when(r.created)}</small></span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== الأدمن =====
export function TopupAdmin({ showToast }) {
  const [data, setData] = useState(null)
  const [num, setNum] = useState('')
  const [editNum, setEditNum] = useState(false)
  const [big, setBig] = useState(null)
  const [busy, setBusy] = useState('')
  const load = () => adminTopups().then(setData).catch(() => setData({ pending: [], done: [] }))
  useEffect(() => {
    load()
    getPay().then((p) => { setNum(p.vodafone); if (!p.vodafone) setEditNum(true) }).catch(() => {})
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [])
  async function saveNum() {
    try { const r = await setPayNumber(num); setNum(r.vodafone); setEditNum(false); showToast(r.vodafone ? 'الرقم اتحفظ ✅ — الأعضاء يقدروا يشحنوا' : 'الشحن اتقفل') } catch (e) { showToast(e?.response?.message || 'الرقم غلط') }
  }
  async function decide(r, ok) {
    let note = ''
    if (!ok) { note = window.prompt('سبب الرفض (هيوصل للعضو):', 'التحويل ماوصلش') ?? null; if (note === null) return }
    else if (!window.confirm(`اتأكدت إن ${r.egp} جنيه وصلوك من ${r.sender}؟`)) return
    setBusy(r.id)
    try { await decideTopup(r.id, ok, note); showToast(ok ? `✅ اتقبل — نزل ${fmt(r.coins)} كوين لـ ${r.name}` : 'اترفض'); await load() } catch (e) { showToast(e?.response?.message || 'حصلت مشكلة') }
    setBusy('')
  }
  return (
    <div className="tpa">
      <div className="tpa-num">
        <span>رقم فودافون كاش اللي الأعضاء بيحوّلوا عليه</span>
        {editNum ? (
          <span className="tpa-edit">
            <input className="input" dir="ltr" inputMode="numeric" maxLength={11} placeholder="01xxxxxxxxx" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))} />
            <button type="button" className="btn-primary" onClick={saveNum}>حفظ</button>
          </span>
        ) : <button type="button" className="tpa-show" onClick={() => setEditNum(true)} dir="ltr">{num} ✏️</button>}
      </div>
      <h3 className="tpa-h">طلبات مستنية {data?.pending?.length ? <span className="tpa-badge">{ar(data.pending.length)}</span> : ''}</h3>
      {data === null ? <p className="game-hint">بيحمّل...</p> : data.pending.length === 0 ? <p className="game-hint">مفيش طلبات مستنية 👌</p> : data.pending.map((r) => (
        <div key={r.id} className="tpa-req">
          <button type="button" className="tpa-shot" onClick={() => setBig(r.proof)}><img src={r.proof} alt="صورة التحويل" /></button>
          <div className="tpa-who">
            <b>{r.name}</b>
            <span>باقة <b>{fmt(r.coins)}</b> كوين — <b>{ar(r.egp)} جنيه</b></span>
            <span>حوّل من: <b dir="ltr">{r.sender}</b></span>
            <small>{when(r.created)}</small>
            <div className="tpa-acts">
              <button type="button" className="tpa-ok" disabled={busy === r.id} onClick={() => decide(r, true)}>✅ قبول</button>
              <button type="button" className="tpa-no" disabled={busy === r.id} onClick={() => decide(r, false)}>✖ رفض</button>
            </div>
          </div>
        </div>
      ))}
      <p className="tp-sub">قبل ما توافق: افتح فودافون كاش واتأكد إن المبلغ وصلك فعلًا من الرقم ده</p>
      {data?.done?.length > 0 && (
        <>
          <h3 className="tpa-h">آخر الطلبات</h3>
          {data.done.map((r) => (
            <div key={r.id} className={`tp-row tp-${r.status}`}>
              <span>{STATUS[r.status]?.[0]}</span>
              <span className="tp-row-b"><b>{r.name}: {ar(r.egp)} جنيه → {fmt(r.coins)} كوين</b><small>من <span dir="ltr">{r.sender}</span>{r.note ? ` — ${r.note}` : ''}</small></span>
            </div>
          ))}
        </>
      )}
      {big && <div className="tpa-big" onClick={() => setBig(null)}><img src={big} alt="" /></div>}
    </div>
  )
}

// ===== الأدمن: مكسب الشات =====
const SPENT = [['vip', '👑 VIP'], ['gift-sent', '🎁 الهدايا'], ['bubble', '💬 الفقاعات'], ['ring', '💍 الخواتم'], ['fee', '🪑 دخولية الترابيزات']]
export function Earnings() {
  const [d, setD] = useState(null)
  const [pick, setPick] = useState(6)
  useEffect(() => { getEarnings().then(setD).catch(() => setD(false)) }, [])
  if (d === null) return <div className="card earn"><p className="game-hint">بيحسب المكسب...</p></div>
  if (!d) return null
  const max = Math.max(1, ...d.days.map((x) => x.egp))
  const spentTotal = SPENT.reduce((a, [k]) => a + (d.spent[k] || 0), 0)
  const dayName = (at, i) => (i === 6 ? 'النهارده' : i === 5 ? 'أمس' : new Date(at + 7200000).toLocaleDateString('ar-EG', { weekday: 'short', timeZone: 'UTC' }))
  return (
    <div className="card earn">
      <span className="row-title">💰 المكسب (من الشحن)</span>
      <div className="earn-grid">
        <div><small>النهارده</small><b>{fmt(d.today.egp)} <i>ج</i></b><span>{ar(d.today.n)} عملية</span></div>
        <div><small>الأسبوع ده</small><b>{fmt(d.week.egp)} <i>ج</i></b><span>{ar(d.week.n)} عملية</span></div>
        <div className="earn-main"><small>الشهر ده</small><b>{fmt(d.month.egp)} <i>ج</i></b><span>{ar(d.month.payers)} عضو شحن</span></div>
        <div><small>من الأول</small><b>{fmt(d.all.egp)} <i>ج</i></b><span>{ar(d.all.payers)} عضو شحن</span></div>
      </div>
      {d.pending.n > 0 && <p className="earn-pend">⏳ فيه {ar(d.pending.n)} طلب شحن مستني موافقتك ({fmt(d.pending.egp)} جنيه) — من تبويب «💳 الشحن»</p>}
      <span className="chart-readout">{dayName(d.days[pick].at, pick)}: <b>{fmt(d.days[pick].egp)}</b> جنيه</span>
      <div className="bars" role="img" aria-label="المكسب آخر ٧ أيام">
        {d.days.map((x, i) => (
          <button key={i} type="button" className={`bar-col ${pick === i ? 'bar-on' : ''}`} onClick={() => setPick(i)} onMouseEnter={() => setPick(i)}>
            <span className="bar-track"><span className="bar earn-bar" style={{ height: `${Math.max(x.egp ? 4 : 0, (x.egp / max) * 100)}%` }} /></span>
            <span className="bar-day">{dayName(x.at, i)}</span>
          </button>
        ))}
      </div>
      <span className="row-title earn-sub">الكوينز اتصرفت على إيه الشهر ده</span>
      {spentTotal === 0 ? <p className="game-hint">لسه محدش صرف كوينز الشهر ده</p> : SPENT.map(([k, label]) => (
        <div key={k} className="hbar">
          <span className="hbar-name">{label}</span>
          <span className="hbar-track"><span className="hbar-fill earn-fill" style={{ width: `${((d.spent[k] || 0) / spentTotal) * 100}%` }} /></span>
          <span className="hbar-val">{fmt(d.spent[k] || 0)}</span>
        </div>
      ))}
      <p className="earn-note">الفلوس بتدخل من الشحن بس (٥٠ كوين بجنيه). الـ VIP والهدايا هما اللي بيخلّوا الناس تشحن.</p>
    </div>
  )
}
