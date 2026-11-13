// فاصل زخرفي بروح فرعونية
export default function Divider() {
  return (
    <div className="divider" aria-hidden="true">
      <span className="divider-line" />
      <svg width="28" height="16" viewBox="0 0 28 16">
        <path d="M2 8 L14 2 L26 8 L14 14 Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="14" cy="8" r="2.2" fill="currentColor" />
      </svg>
      <span className="divider-line" />
    </div>
  )
}
