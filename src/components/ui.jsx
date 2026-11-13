import { useEffect, useRef, useState } from 'react'
import { Search as SearchIcon } from './Icons.jsx'
import { tint } from '../utils.js'

export function Avatar({ text, c = 0, size = 52, round = false }) {
  const [bg, fg] = tint(c)
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
