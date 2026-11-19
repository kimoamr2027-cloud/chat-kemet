// VIP كيمت: صفحة الشراء (جوه المحفظة) وشريط «منوّر» لما VIP يدخل الغرفة الصوتية
import { useEffect, useRef, useState } from 'react'
import { VIP_LEVELS, vipVars, buyVip, useVips, vipLevelOf } from '../vip.js'
import { ar } from '../utils.js'

const fmt = (n) => Number(n || 0).toLocaleString('ar-EG')
const daysLeft = (until) => Math.max(0, Math.ceil((until - Date.now()) / 86400000))

export function VipShop({ uid, wallet, admin, showToast, Coin }) {
  const all = useVips()
  const cur = vipLevelOf(all, uid)
  const until = all[uid]?.until || 0
  const [busy, setBusy] = useState(0)
  const coins = wallet?.coins ?? 0
  async function buy(lv) {
    setBusy(lv)
    try {
      await buyVip(lv)
      showToast?.(`👑 مبروك! بقيت VIP ${VIP_LEVELS[lv - 1].name}`)
    } catch (e) { showToast?.(e?.response?.message || 'مقدرناش نكمّل، جرب تاني') }
    setBusy(0)
  }
  return (
    <div className="vip-shop">
      {cur ? (
        <div className="vip-now" style={vipVars(cur)}>
          <span className="vip-now-ic">{VIP_LEVELS[cur - 1].icon}</span>
          <span><b>انت VIP {VIP_LEVELS[cur - 1].name}</b><small>فاضل {ar(daysLeft(until))} يوم</small></span>
        </div>
      ) : <p className="vip-hint">اشترك في VIP بالكوينز لمدة ٣٠ يوم. كل مستوى بياخد مميزات اللي قبله كمان.</p>}
      {VIP_LEVELS.map((l) => {
        const lower = cur > l.level
        const same = cur === l.level
        const poor = !admin && coins < l.price
        return (
          <div key={l.level} className={`vip-card ${same ? 'on' : ''}`} style={vipVars(l.level)}>
            <span className="vip-lv">{l.icon}</span>
            <span className="vip-body">
              <b>{ar(l.level)} · {l.name}</b>
              <small>{l.perk}</small>
            </span>
            <button type="button" className="vip-buy" disabled={busy || lower || poor} onClick={() => buy(l.level)}>
              {busy === l.level ? 'لحظة...' : lower ? 'عندك أعلى' : <>{same ? 'جدّد' : 'اشترك'}<span><Coin size="sm" /> {admin ? 'ببلاش' : fmt(l.price)}</span></>}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// صوت دخول خفيف (الوزير وفوق): نغمتين دهب
function chime() {
  try {
    const A = window.AudioContext || window.webkitAudioContext
    const ctx = new A()
    const t = ctx.currentTime
    ;[[880, 0], [1318.5, 0.12], [1760, 0.24]].forEach(([f, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.18, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + d + 1.2)
      o.connect(g).connect(ctx.destination); o.start(t + d); o.stop(t + d + 1.3)
    })
    setTimeout(() => ctx.close(), 2000)
  } catch { /* مفيش صوت */ }
}

// شريط «منوّر» لما عضو VIP يدخل الغرفة (٤ ثواني). الفرعون: عربة الفرعون فوقه
export function VipEntry({ people, Face }) {
  const all = useVips()
  const seen = useRef(null)
  const [q, setQ] = useState([])
  const [cur, setCur] = useState(null)
  // مين دخل جديد؟ (أول مرة بنسجّل الموجودين من غير ما نعرض حاجة)
  useEffect(() => {
    const ids = people.map((p) => p.uid)
    if (seen.current) {
      const fresh = people.filter((p) => !seen.current.has(p.uid) && vipLevelOf(all, p.uid) > 0)
      if (fresh.length) setQ((x) => [...x, ...fresh.map((p) => ({ ...p, level: vipLevelOf(all, p.uid), key: `${p.uid}-${Date.now()}` }))])
    }
    seen.current = new Set(ids)
  }, [people, all])
  // اللي عليه الدور في الطابور
  useEffect(() => {
    if (cur || !q.length) return
    const [n, ...rest] = q
    setCur(n); setQ(rest)
    if (n.level >= 4) chime()
  }, [q, cur])
  // كل شريط ٤ ثواني وبعدين يختفي
  useEffect(() => {
    if (!cur) return
    const t = setTimeout(() => setCur(null), cur.level === 6 ? 4600 : 4000)
    return () => clearTimeout(t)
  }, [cur])
  if (!cur) return null
  const l = VIP_LEVELS[cur.level - 1]
  return (
    <>
      {cur.level === 6 && <video key={cur.key} className="vip-chariot" src={`${import.meta.env.BASE_URL}gifts/chariot.mp4`} autoPlay muted playsInline />}
      <div key={cur.key} className="vip-entry" style={vipVars(cur.level)}>
        <span className="vip-entry-av"><Face uid={cur.uid} name={cur.name} size={44} /><i>VIP</i></span>
        <span className="vip-entry-tx"><b>{cur.name}</b><small>{l.icon} {l.name} منوّر الغرفة ✨</small></span>
        <span className="vip-entry-crown">{cur.level === 6 ? '👑' : l.icon}</span>
      </div>
    </>
  )
}

// شريط الدخول في غرف الدردشة: الـ VIP بس بيظهرله الشريط الدهبي فوق (والفرعون بعربة الفرعون)
// joins: [{ uid, name, at }] الأحدث الأول (من useRoomJoins)
export function RoomEntry({ joins, Face }) {
  const all = useVips()
  const seen = useRef(new Set())
  const [q, setQ] = useState([])
  const [cur, setCur] = useState(null)
  useEffect(() => {
    const fresh = []
    for (const j of [...joins].reverse()) {
      const k = j.uid + '|' + (j.at?.getTime?.() || 0)
      if (seen.current.has(k)) continue
      seen.current.add(k)
      // العضو العادي: الجملة الصغيرة اللي جوه الرسايل كفاية — الشريط اللي فوق للـ VIP بس
      const level = vipLevelOf(all, j.uid)
      if (level) fresh.push({ uid: j.uid, name: j.name, level, key: k })
    }
    if (fresh.length) setQ((x) => [...x, ...fresh].slice(-6))
  }, [joins, all])
  useEffect(() => {
    if (cur || !q.length) return
    const [n, ...rest] = q
    setCur(n); setQ(rest)
    if (n.level >= 4) chime()
  }, [q, cur])
  useEffect(() => {
    if (!cur) return
    const t = setTimeout(() => setCur(null), cur.level === 6 ? 4600 : 4000)
    return () => clearTimeout(t)
  }, [cur])
  if (!cur) return null
  const l = VIP_LEVELS[cur.level - 1]
  return (
    <>
      {cur.level === 6 && <div key={cur.key + 'd'} className="vip-dim" />}
      {cur.level === 6 && <video key={cur.key + 'v'} className="vip-chariot" src={`${import.meta.env.BASE_URL}gifts/chariot.mp4`} autoPlay muted playsInline />}
      <div key={cur.key} className="vip-entry" style={vipVars(cur.level)}>
        <span className="vip-entry-av"><Face uid={cur.uid} name={cur.name} size={44} /><i>VIP</i></span>
        <span className="vip-entry-tx"><b>{cur.name}</b><small>{l.icon} {l.name} منوّر الغرفة ✨</small></span>
        <span className="vip-entry-crown">{cur.level === 6 ? '👑' : l.icon}</span>
      </div>
    </>
  )
}
