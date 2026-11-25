// 🏛 الميدان: بوستات الأعضاء + تحدي الأسبوع
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import PostCard, { Face } from '../components/PostCard.jsx'
import { Sheet, Tabs, useToast } from '../components/ui.jsx'
import { useAuth, isGuest } from '../auth.jsx'
import { ar } from '../utils.js'
import { useFeed, useChallenge, createPost } from '../square.js'

function left(end) {
  const ms = end - Date.now()
  if (ms <= 0) return 'خلص'
  const d = Math.floor(ms / 86400000)
  if (d >= 1) return d === 1 ? 'فاضل يوم' : d === 2 ? 'فاضل يومين' : `فاضل ${ar(d)} أيام`
  const h = Math.max(1, Math.floor(ms / 3600000))
  return h === 1 ? 'فاضل ساعة' : `فاضل ${ar(h)} ساعات`
}

function ChallengeCard({ c, onJoin }) {
  if (!c) return null
  const medals = ['🥇', '🥈', '🥉']
  return (
    <section className="ch-card">
      <div className="ch-head">
        <span className="ch-e">{c.e}</span>
        <div>
          <small>🏆 تحدي الأسبوع · {left(c.end)}</small>
          <b>{c.tag}</b>
        </div>
      </div>
      <p className="ch-how">نزّل صورة على الموضوع، والناس تصوّت بـ ❤️. الأكتر أصوات يكسب:</p>
      <div className="ch-prizes">{c.prizes.map((x, i) => <span key={i}>{medals[i]} {ar(x)} 🪙</span>)}</div>
      {c.top?.length > 0 && (
        <div className="ch-top">
          {c.top.map((t, i) => (
            <Link key={t.post} to={`/p/${t.post}`} className="ch-top-p"><Face uid={t.uid} name={t.name} size={34} /><span>{medals[i]} {t.name}<small>❤️ {ar(t.likes)}</small></span></Link>
          ))}
        </div>
      )}
      {c.mine ? <span className="ch-in">✅ انت مشترك — ابعت لينك صورتك لصحابك يصوّتولك</span>
        : <button type="button" className="btn-primary ch-btn" onClick={onJoin}>📷 شارك بصورتك</button>}
      <small className="ch-n">{c.n ? `${ar(c.n)} مشترك لحد دلوقتي` : 'لسه محدش اشترك، كن الأول! 🔥'}</small>
      {c.last?.winners?.length > 0 && (
        <div className="ch-last">🏅 فايزين «{c.last.title}»: {c.last.winners.map((w, i) => <Link key={w.uid} to={`/p/${w.post}`}>{medals[i]} {w.name}</Link>)}</div>
      )}
    </section>
  )
}

function Composer({ ch, startCh, onClose, onDone, showToast }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [prev, setPrev] = useState('')
  const [inCh, setInCh] = useState(!!startCh)
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  const pick = (f) => { if (!f) return; setFile(f); setPrev(URL.createObjectURL(f)) }
  const send = async () => {
    if (!text.trim() && !file) return showToast('اكتب حاجة أو اختار صورة')
    if (inCh && !file) return showToast('التحدي محتاج صورة 📷')
    setBusy(true)
    try { const p = await createPost({ text: text.trim(), file, challenge: inCh ? ch.key : '' }); onDone(p, inCh) } catch (e) { showToast(e?.response?.message || (e?.message === 'image too big' ? 'الصورة كبيرة أوي' : 'البوست مانزلش، جرب تاني')) }
    setBusy(false)
  }
  return (
    <Sheet onClose={onClose}>
      <span className="grabber" aria-hidden="true" />
      <h2 className="sheet-title">{inCh ? `🏆 ${ch?.tag || 'تحدي الأسبوع'}` : '🏛 بوست جديد في الميدان'}</h2>
      <textarea className="sq-text" dir="auto" rows={3} maxLength={600} placeholder={inCh ? 'اكتب كلمة على صورتك (اختياري)' : 'بتفكر في إيه؟'} value={text} onChange={(e) => setText(e.target.value)} />
      {prev ? (
        <div className="sq-prev"><img src={prev} alt="" /><button type="button" aria-label="شيل الصورة" onClick={() => { setFile(null); setPrev('') }}>✕</button></div>
      ) : (
        <button type="button" className="sq-pick" onClick={() => ref.current?.click()}>📷 اختار صورة</button>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      {ch && !ch.mine && (
        <label className="sq-ch"><input type="checkbox" checked={inCh} onChange={(e) => setInCh(e.target.checked)} /> 🏆 شارك بيه في تحدي الأسبوع ({ch.tag})</label>
      )}
      <button type="button" className="btn-primary" disabled={busy} onClick={send}>{busy ? 'بيتنشر...' : 'انشر'}</button>
      <p className="sq-rules">🛡 ممنوع الأرقام واللينكات والصور اللي مش لائقة. أي بوست عليه بلاغات كتير بيستخبى.</p>
    </Sheet>
  )
}

export default function Square() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('new')
  const [toast, showToast] = useToast()
  const { c, reload: reloadCh } = useChallenge()
  const feed = useFeed(tab === 'challenge' ? 'challenge' : 'new', tab === 'challenge' ? c?.key : '')
  const [compose, setCompose] = useState(null) // null | 'post' | 'challenge'
  const guest = isGuest(user, profile)
  const open = (kind) => (guest ? showToast('سجّل حسابك الأول علشان تنزّل بوستات 🏛') : setCompose(kind))
  return (
    <main className="screen">
      <header className="head head-col">
        <h1 className="h-big">🏛 الميدان</h1>
        <Tabs tabs={[['new', 'الجديد'], ['challenge', '🏆 تحدي الأسبوع']]} value={tab} onChange={setTab} />
      </header>
      <div className="kemet-bg list sq-list" onScroll={(e) => { const el = e.currentTarget; if (feed.more && el.scrollTop + el.clientHeight > el.scrollHeight - 600) feed.loadMore() }}>
        {tab === 'challenge' ? <ChallengeCard c={c} onJoin={() => open('challenge')} />
          : c && <button type="button" className="ch-strip" onClick={() => setTab('challenge')}><span>{c.e}</span> تحدي الأسبوع: <b>{c.tag}</b> <i>شارك ›</i></button>}
        {tab === 'new' && (
          <button type="button" className="card sq-new" onClick={() => open('post')}>
            <Face uid={user.uid} name={profile?.name} size={40} /><span>بتفكر في إيه؟ نزّل بوست...</span><b>📷</b>
          </button>
        )}
        {feed.items === null && <p className="empty">بيحمّل...</p>}
        {feed.items?.length === 0 && <p className="empty">{tab === 'challenge' ? 'لسه مفيش صور في التحدي ده، كن الأول! 📷' : 'لسه مفيش بوستات، نزّل أول واحد! 🏛'}</p>}
        {feed.items?.map((p) => <PostCard key={p.id} p={p} ch={c} onPatch={feed.patch} onGone={(id) => { feed.drop(id); reloadCh() }} showToast={showToast} />)}
        {feed.more && <button type="button" className="pill-btn sq-more" onClick={feed.loadMore}>بوستات أكتر</button>}
      </div>
      <button type="button" className="sq-fab" aria-label="بوست جديد" onClick={() => open(tab === 'challenge' && c && !c.mine ? 'challenge' : 'post')}>＋</button>
      {compose && <Composer ch={c} startCh={compose === 'challenge'} onClose={() => setCompose(null)} showToast={showToast}
        onDone={(p, inCh) => { setCompose(null); showToast(inCh ? '🏆 اشتركت في التحدي! ابعت اللينك لصحابك يصوّتولك' : '🎉 البوست نزل'); if (inCh) { reloadCh(); setTab('challenge') } feed.add({ ...p, liked: false }) }} />}
      {toast}
      <BottomNav />
    </main>
  )
}
