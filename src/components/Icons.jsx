// أيقونات الديزين (SVG)
const S = ({ size = 24, sw = 2, children, ...p }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...p}>{children}</svg>
)

export const Back = (p) => <S sw={2.2} {...p}><path d="M9 6l6 6-6 6" /></S>
export const Bell = (p) => <S {...p}><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7" /><path d="M10 20a2 2 0 0 0 4 0" /></S>
export const User = (p) => <S {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></S>
export const Search = (p) => <S size={20} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></S>
export const Home = (p) => <S {...p}><path d="M3 10l9-6 9 6v10H3z" /><path d="M9 20v-6h6v6" /></S>
export const DiceIc = (p) => <S {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" strokeWidth="3" /></S>
export const Chat = (p) => <S {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></S>
export const Members = (p) => <S size={22} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 15c2 .6 3 2.2 3.5 5" /></S>
export const Shield = (p) => <S size={11} sw={2.4} {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></S>
export const Smile = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c1 1.5 2.2 2 3.5 2s2.5-.5 3.5-2" /><path d="M9 9.5h.01M15 9.5h.01" /></S>
export const Image = (p) => <S size={22} {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8" /></S>
export const Send = (p) => <S size={20} sw={2.2} {...p}><path d="M20 4L3 11l7 3 3 7z" /><path d="M20 4l-10 10" /></S>
export const Mic = (p) => <S size={22} sw={2.2} {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></S>
export const Trash = (p) => <S size={22} {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></S>
export const Close = (p) => <S size={18} sw={2.4} {...p}><path d="M6 6l12 12M18 6L6 18" /></S>
export const Dots = (p) => <S size={22} sw={2.4} {...p}><path d="M12 5h.01M12 12h.01M12 19h.01" /></S>
export const Lock = (p) => <S size={14} {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></S>
export const Block = (p) => <S size={22} {...p}><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></S>
export const Flag = (p) => <S size={22} {...p}><path d="M5 21V4h11l-1.5 4L16 12H5" /></S>
export const Camera = (p) => <S size={18} {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></S>
export const Gear = (p) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></S>
export const Logout = (p) => <S size={20} {...p}><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></S>
export const Google = (p) => <S size={22} {...p}><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 12h-8" /></S>
export const Play = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 5v14L6 12z" /></svg>
)

const BARS = [[0,9,6],[6,6,12],[12,3,18],[18,8,8],[24,5,14],[30,2,20],[36,7,10],[42,4,16],[48,9,6],[54,6,12],[60,3,18],[66,7,10],[72,5,14],[78,9,6],[84,6,12],[90,8,8],[96,10,4],[102,9,6]]
export const Wave = () => (
  <svg aria-hidden="true" width="110" height="24" viewBox="0 0 110 24" fill="currentColor" opacity="0.8">
    {BARS.map(([x, y, h]) => <rect key={x} x={x} y={y} width="3" height={h} rx="1.5" />)}
  </svg>
)

// أيقونات الإشعارات
export const NOTIF_ICONS = {
  reply: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 6 6v3',
  dm: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  mention: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4 7.5',
  react: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  mod: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  room: 'M3 10l9-6 9 6v10H3z',
}
