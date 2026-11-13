// شعار عين حورس المبسط
export default function Logo({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="120" fill="#8A5A1C" />
      <g fill="none" stroke="#F3E2BF" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round">
        <path d="M96 236 C160 160 352 160 416 236 C352 300 160 300 96 236 Z" />
        <circle cx="256" cy="236" r="40" fill="#F3E2BF" />
        <path d="M226 278 L210 372" />
        <path d="M290 274 C300 330 344 344 372 318" />
        <path d="M110 176 C180 120 340 120 410 168" />
      </g>
    </svg>
  )
}
