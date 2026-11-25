// 🏛 بوست واحد في الميدان: صاحبه، الكلام، الصورة، ولايك/كومنت/شير
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Sheet, UserName } from './ui.jsx'
import { Dots } from './Icons.jsx'
import { useAvatar } from '../dm.js'
import { colorIndex } from '../rooms.js'
import { useAuth, isGuest } from '../auth.jsx'
import { isAdminUid } from '../roles.js'
import { ago } from '../notifs.js'
import { ar } from '../utils.js'
import { postImg, shareUrl, likePost, deletePost, reportPost } from '../square.js'

export function Face({ uid, name, size = 42 }) {
  const src = useAvatar(uid)
  return <Avatar text={(name || '؟').charAt(0)} c={colorIndex(uid)} size={size} round src={src || undefined} uid={uid} />
}

export default function PostCard({ p, ch, onPatch, onGone, showToast, full }) {
  const { user, profile, roles } = useAuth()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [pop, setPop] = useState(0)
  const [zoom, setZoom] = useState(false)
  const mine = p.uid === user.uid
  const admin = isAdminUid(roles, user.uid)
  const guestMsg = () => showToast('سجّل حسابك الأول علشان تتفاعل في الميدان ❤️')
  const like = () => {
    if (isGuest(user, profile)) return guestMsg()
    const on = !p.liked
    onPatch?.(p.id, { liked: on, likes: Math.max(0, (p.likes || 0) + (on ? 1 : -1)) })
    if (on) setPop(Date.now())
    likePost(p.id).then((r) => onPatch?.(p.id, { liked: r.liked, likes: r.likes }))
      .catch((e) => { onPatch?.(p.id, { liked: p.liked, likes: p.likes }); showToast(e?.response?.message || 'حصلت مشكلة') })
  }
  const share = () => {
    const url = shareUrl(p.id)
    if (navigator.share) navigator.share({ title: 'شات كيمت — الميدان', text: `${p.name} في ميدان كيمت`, url }).catch(() => {})
    else navigator.clipboard?.writeText(url).then(() => showToast('اتنسخ اللينك 🔗')).catch(() => showToast(url))
  }
  const img = postImg(p)
  const isCh = !!p.tag && ch && p.tag === ch.key
  return (
    <article className="card post">
      <header className="post-top">
        <Link to={`/u/${p.uid}`} className="post-who">
          <Face uid={p.uid} name={p.name} />
          <span className="post-meta">
            <UserName name={p.name} role={isAdminUid(roles, p.uid) ? 'admin' : null} uid={p.uid} />
            <small>{p.at ? ago(p.at) : ''}</small>
          </span>
        </Link>
        <button type="button" className="icon-btn post-more" aria-label="اختيارات" onClick={() => setMenu(true)}><Dots /></button>
      </header>
      {p.tag && <span className="post-tag">🏆 {isCh ? ch.tag : 'تحدي الأسبوع'}</span>}
      {p.text && <p className={`post-text ${full ? '' : 'post-clip'}`} dir="auto">{p.text}</p>}
      {img && (
        <button type="button" className="post-img" style={p.w && p.h ? { aspectRatio: `${p.w} / ${p.h}` } : undefined} onClick={() => setZoom(true)}>
          <img src={img} alt="" loading="lazy" />
          {pop > 0 && <i key={pop} className="post-pop">❤️</i>}
        </button>
      )}
      <footer className="post-acts">
        <button type="button" className={`post-act ${p.liked ? 'on' : ''}`} onClick={like} aria-pressed={!!p.liked}>
          <span className="post-heart">{p.liked ? '❤️' : '🤍'}</span>{ar(p.likes || 0)}{isCh && <small> صوت</small>}
        </button>
        <button type="button" className="post-act" onClick={() => (full ? document.getElementById('pc-input')?.focus() : navigate(`/p/${p.id}`))}>💬 {ar(p.comments || 0)}</button>
        <button type="button" className="post-act post-share" onClick={share}>↗ شير</button>
      </footer>

      {menu && (
        <Sheet onClose={() => setMenu(false)}>
          <span className="grabber" aria-hidden="true" />
          <div className="post-menu">
            <button type="button" className="pill-btn" onClick={() => { setMenu(false); share() }}>🔗 شير البوست</button>
            {!mine && <button type="button" className="pill-btn" onClick={() => { setMenu(false); navigate(`/dm/${p.uid}`) }}>💬 كلّمه خاص</button>}
            {!mine && <button type="button" className="pill-btn" onClick={() => { setMenu(false); reportPost(p.id).then(() => showToast('🚩 وصل البلاغ للأدمن، شكرًا')).catch((e) => showToast(e?.response?.message || 'حصلت مشكلة')) }}>🚩 بلّغ عن البوست</button>}
            {(mine || admin) && <button type="button" className="pill-btn pill-danger" onClick={() => {
              if (!window.confirm('تمسح البوست ده؟')) return
              setMenu(false)
              deletePost(p.id).then(() => { showToast('اتمسح البوست'); onGone?.(p.id) }).catch((e) => showToast(e?.response?.message || 'حصلت مشكلة'))
            }}>🗑 امسح البوست</button>}
          </div>
        </Sheet>
      )}
      {zoom && (
        <button type="button" className="post-zoom" aria-label="إغلاق" onClick={() => setZoom(false)} onDoubleClick={like}>
          <img src={postImg(p, true)} alt="" />
        </button>
      )}
    </article>
  )
}
