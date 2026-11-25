// 🏛 بوست واحد من الميدان + الكومنتات
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PostCard, { Face } from '../components/PostCard.jsx'
import { Back, Send } from '../components/Icons.jsx'
import { UserName, useToast } from '../components/ui.jsx'
import { useAuth, isGuest } from '../auth.jsx'
import { isAdminUid } from '../roles.js'
import { ago } from '../notifs.js'
import { getPost, useComments, useChallenge, addComment, delComment, restorePost } from '../square.js'
import { toDate } from '../pb/client.js'

export default function Post() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile, roles } = useAuth()
  const [p, setP] = useState(undefined)
  const [toast, showToast] = useToast()
  const { c } = useChallenge()
  const cm = useComments(p ? id : null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const admin = isAdminUid(roles, user.uid)
  useEffect(() => { getPost(id).then(setP).catch(() => setP(null)) }, [id])
  const send = async () => {
    const t = text.trim()
    if (!t) return
    if (isGuest(user, profile)) return showToast('سجّل حسابك الأول علشان تكتب كومنت')
    setBusy(true)
    try {
      const r = await addComment(id, t)
      cm.setList((l) => [...(l || []), { ...r, at: toDate(r.created) || new Date() }])
      setP((x) => ({ ...x, comments: (x.comments || 0) + 1 }))
      setText('')
    } catch (e) { showToast(e?.response?.message || 'الكومنت ماتبعتش') }
    setBusy(false)
  }
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/square'))
  return (
    <main className="screen">
      <header className="head head-row">
        <button type="button" aria-label="رجوع" className="icon-btn" onClick={back}><Back /></button>
        <h1 className="h-mid">🏛 الميدان</h1>
      </header>
      <div className="kemet-bg list sq-list">
        {p === undefined && <p className="empty">بيحمّل...</p>}
        {p === null && <p className="empty">البوست ده اتمسح 🙈<br /><Link to="/square">ارجع للميدان</Link></p>}
        {p?.hidden && admin && (
          <div className="sq-hidden">🚩 البوست ده مستخبي بسبب البلاغات.
            <button type="button" className="pill-btn pill-gold" onClick={() => restorePost(id).then(() => { setP({ ...p, hidden: false }); showToast('رجع البوست للميدان') }).catch(() => showToast('حصلت مشكلة'))}>رجّعه</button>
          </div>
        )}
        {p && <PostCard p={p} ch={c} full onPatch={(_, ch) => setP((x) => ({ ...x, ...ch }))} onGone={() => navigate('/square')} showToast={showToast} />}
        {p && (
          <section className="card pc-list">
            <h3>💬 الكومنتات</h3>
            {cm.list === null && <p className="pc-empty">بيحمّل...</p>}
            {cm.list?.length === 0 && <p className="pc-empty">لسه محدش علّق، اكتب أول كومنت 👇</p>}
            {cm.list?.map((x) => (
              <div key={x.id} className="pc">
                <Link to={`/u/${x.uid}`}><Face uid={x.uid} name={x.name} size={34} /></Link>
                <div className="pc-body">
                  <span className="pc-name"><UserName name={x.name} role={isAdminUid(roles, x.uid) ? 'admin' : null} uid={x.uid} /><small>{x.at ? ago(x.at) : ''}</small></span>
                  <span className="pc-text" dir="auto">{x.text}</span>
                </div>
                {(x.uid === user.uid || p.uid === user.uid || admin) && (
                  <button type="button" className="pc-del" aria-label="امسح الكومنت" onClick={() => delComment(x.id).then(() => { cm.setList((l) => l.filter((y) => y.id !== x.id)); setP((q) => ({ ...q, comments: Math.max(0, (q.comments || 1) - 1) })) }).catch(() => showToast('حصلت مشكلة'))}>✕</button>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
      {p && (
        <form className="composer pc-form" onSubmit={(e) => { e.preventDefault(); send() }}>
          <div className="composer-row">
            <input id="pc-input" className="msg-input" dir="auto" maxLength={300} placeholder="اكتب كومنت..." value={text} onChange={(e) => setText(e.target.value)} />
            <button type="submit" className="round-btn" aria-label="ابعت" disabled={busy || !text.trim()}><Send /></button>
          </div>
        </form>
      )}
      {toast}
    </main>
  )
}
