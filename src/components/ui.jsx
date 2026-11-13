import { useEffect, useRef, useState } from 'react'
import { Search as SearchIcon } from './Icons.jsx'
import { tint } from '../utils.js'

export function Avatar({ text, c = 0, size = 52, round = false, src }) {
  const [bg, fg] = tint(c)
  if (src) {
    return <img src={src} alt="" aria-hidden="true" className="avatar avatar-img-sm"
      style={{ width: size, height: size, borderRadius: round ? '50%' : size > 46 ? 16 : 14 }} />
  }
  return (
    <div aria-hidden="true" className="avatar"
      style={{ width: size, height: size, background: bg, color: fg, borderRadius: round ? '50%' : size > 46 ? 16 : 14, fontSize: Math.round(size * 0.42) }}>
      {text}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="search">
      <SearchIcon />
      <span className="sr-only">بحث</span>
      <input type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="tabs">
      {tabs.map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={value === id}
          className={`tab ${value === id ? 'tab-on' : ''}`} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  )
}

export function Switch({ on, onToggle, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label}
      className={`switch ${on ? 'switch-on' : ''}`} onClick={onToggle}><span /></button>
  )
}

export function Radio({ on }) {
  return <span aria-hidden="true" className={`radio ${on ? 'radio-on' : ''}`} />
}

// رسالة صغيرة بتظهر وتختفي
export function useToast() {
  const [toast, setToast] = useState('')
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  const show = (t) => {
    setToast(t)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(''), 2600)
  }
  const node = toast ? <div role="status" className="toast"><span>{toast}</span></div> : null
  return [node, show]
}

export function Sheet({ onClose, children, className = '' }) {
  return (
    <>
      <button type="button" aria-label="إغلاق" className="scrim" onClick={onClose} />
      <div className={`sheet ${className}`}>{children}</div>
    </>
  )
}

// تاج الأدمن
export function Crown({ size = 16 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="crown">
      <defs>
        <linearGradient id="crownGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F7DC8C" /><stop offset=".5" stopColor="#D4A23C" /><stop offset="1" stopColor="#8A5A1C" />
        </linearGradient>
      </defs>
      <path d="M3 18l1.6-10 5 4.5L12 5l2.4 7.5 5-4.5L21 18z" fill="url(#crownGold)" stroke="#7A4E14" strokeWidth="1" strokeLinejoin="round" />
      <rect x="3" y="18.5" width="18" height="2.5" rx="1" fill="url(#crownGold)" stroke="#7A4E14" strokeWidth="1" />
      <circle cx="12" cy="4.2" r="1.3" fill="#F7DC8C" />
    </svg>
  )
}

// الاسم حسب الدور: الأدمن مزخرف ودهبي، والمشرف بشارة
export function UserName({ name, role, color, badge = true }) {
  if (role === 'admin') {
    return (
      <span className="name-admin-wrap">
        <Crown />
        <span className="name-admin">{name}</span>
        {badge && <span className="badge-admin">الأدمن</span>}
      </span>
    )
  }
  return (
    <span className="name-wrap">
      <span style={color ? { color } : undefined}>{name}</span>
      {role === 'mod' && badge && <span className="mod-chip">مشرف</span>}
    </span>
  )
}

// التواصل على واتساب
export const WHATSAPP_NUMBER = '01112920556'
export const WHATSAPP_URL = 'https://wa.me/201112920556'
export function WhatsAppIcon({ size = 22 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 32 32">
      <path fill="#25D366" d="M16 2.9C8.8 2.9 2.9 8.7 2.9 15.9c0 2.3.6 4.6 1.8 6.6L2.8 29.1l6.8-1.8c1.9 1 4.1 1.6 6.3 1.6 7.2 0 13.1-5.9 13.1-13.1S23.2 2.9 16 2.9z" />
      <path fill="#fff" d="M23.3 19.4c-.4-.2-2.4-1.2-2.7-1.3-.4-.1-.6-.2-.9.2-.3.4-1 1.3-1.3 1.6-.2.3-.5.3-.9.1-.4-.2-1.7-.6-3.2-2-1.2-1.1-2-2.4-2.2-2.8-.2-.4 0-.6.2-.8l.6-.7c.2-.2.3-.4.4-.7.1-.3.1-.5 0-.7-.1-.2-.9-2.2-1.2-3-.3-.8-.6-.7-.9-.7h-.8c-.3 0-.7.1-1 .5-.4.4-1.4 1.3-1.4 3.2s1.4 3.8 1.6 4c.2.3 2.8 4.2 6.7 5.9 2.3 1 3.2 1.1 4.4.9.7-.1 2.4-1 2.7-1.9.3-.9.3-1.7.2-1.9 0-.2-.3-.3-.7-.5z" />
    </svg>
  )
}
export function WhatsAppLink({ className = '' }) {
  return (
    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={`wa-link ${className}`}>
      <WhatsAppIcon />
      <span>تواصل معانا واتساب</span>
      <b dir="ltr">{WHATSAPP_NUMBER}</b>
    </a>
  )
}
