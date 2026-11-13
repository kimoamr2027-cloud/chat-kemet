# شات كيمت (Chat Kemet) — Design Spec

This folder is the approved UI design for the app. Build the real app to match it closely.

## How to read the screen files
`screens/*.html` are design mockups written in a small template format, NOT production code:
- Markup lives inside `<x-dc>…</x-dc>`. All styles are inline — copy the values (colors, sizes, radii, spacing).
- `{{name}}` holes are filled by the `Component` class in the `<script type="text/x-dc">` block at the bottom (`renderVals()`); read it to see the sample data and the interactive behavior (state, handlers).
- `<sc-for list="{{items}}" as="x">` = loop, `<sc-if value="{{cond}}">` = conditional.
- Links between screens use `href="Rooms.dc.html"` etc. → treat as app routes.
- `support.js` is not included and not needed; recreate everything in React.

## Screens (route → file)
| Route | File | What it is |
|---|---|---|
| `/login` | Main.html | Login: pyramids logo, name field, gender (ذكر/أنثى), "دخول", Google sign-in |
| `/rooms` | Rooms.html | Room list: search, tabs (الكل / الأكثر نشاطًا / غرفي), room cards, bell → notifications, bottom nav |
| `/rooms/:id` | Room.html | Group chat: voice notes, replies, reactions, typing indicator, stickers, members sheet with moderator mute/kick |
| `/messages` | Messages.html | Private chats inbox with online dots and unread counts |
| `/dm/:id` | DM.html | Private chat: same chat features + read receipts (✓✓ gray = delivered, gold = read), ⋮ menu → mute / block / report |
| `/profile` | Profile.html | Edit profile: avatar upload, name, bio, city, age, gender, up to 6 photos, gear → settings |
| `/notifications` | Notifications.html | Notifications with tabs (الكل / الإشارات / الخاص / الغرف) and "قراءة الكل" |
| `/settings` | Settings.html | Dark mode, language, notification toggles, who can DM me (الكل / اللي معايا في الغرف / محدش), show online, read receipts, blocked list, logout |
| marketing site | Landing.html | Public landing page (separate from the app) |

Bottom nav (Rooms / Messages / Profile screens): الغرف · الرسائل · حسابي.

## Design tokens
- Direction: RTL, `lang="ar"`.
- Fonts: **Cairo** (400/600/700/800) for everything; **Reem Kufi** for big headings on the landing page.
- Background `#FAF8F4`; chat areas `#F7F1E6` + `assets/kemet-pattern.svg` tiled at 200px.
- Primary (gold-brown) `#8A5A1C` — buttons, my message bubbles, active tabs. Selected tint `#FBF4E8`, soft tint `#F1E6D3`.
- Text `#1F1A14`, secondary `#6B6259`, borders `#ECE6DC` / inputs `#D9D2C7`.
- Online green `#2F8A43` / text `#2F6B3A`. Danger `#B3261E`.
- Radii: inputs/buttons 14px, cards 18px, bubbles 18px with one 4px corner, pills fully rounded.
- Bubbles: mine = primary bg + white text (right side in RTL); others = white with border (left side), sender name colored above.

## Assets
- `assets/pyramids.png` — logo illustration.
- `assets/kemet-pattern.svg` — repeating chat background.
- `assets/stickers.svg` — sprite of 6 stickers (720×120, 120px each). Use `background-size: 600% 100%` and positions 0/20/40/60/80/100%. Captions in order: هههههه · إيه ده؟! · يا قمر · تصبحوا على خير · صباح الفل · ماشي يا باشا.

## Notes
- Sample names/messages in the files are placeholder data.
- Safety features (block, report, DM privacy, moderators) are required before store release.
