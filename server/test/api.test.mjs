// اختبارات سيرفر PocketBase
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
// بيشتغل على: Firebase Auth emulator (9099) + PocketBase محلي (PB_URL)
// node server/test/api.test.mjs
const PB = process.env.PB_URL || 'http://127.0.0.1:8095'
const IDTK = process.env.IDTK || 'http://127.0.0.1:9099/identitytoolkit.googleapis.com'
const SU = { email: process.env.SU_EMAIL || 'su@test.local', password: process.env.SU_PASS || 'SuperPass123!' }
let pass = 0, fail = 0
const t = async (name, fn) => { try { await fn(); pass++; console.log('✓', name) } catch (e) { fail++; console.log('✗', name, '-', e.message) } }
const ok = (c, m) => { if (!c) throw new Error(m || 'assert') }

async function api(path, { method = 'GET', token, body } = {}) {
  const r = await fetch(PB + path, { method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: token } : {}) }, body: body ? JSON.stringify(body) : undefined })
  let j = null
  try { j = await r.json() } catch {}
  return { status: r.status, j }
}
async function fbToken(email) {
  const r = await fetch(`${IDTK}/v1/accounts:signUp?key=x`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'pass123456', returnSecureToken: true }) })
  const j = await r.json()
  if (j.idToken) return j
  const r2 = await fetch(`${IDTK}/v1/accounts:signInWithPassword?key=x`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'pass123456', returnSecureToken: true }) })
  return r2.json()
}
async function login(email, name) {
  const fb = await fbToken(email)
  const r = await api('/api/kemet/auth', { method: 'POST', body: { idToken: fb.idToken } })
  if (r.status !== 200) throw new Error('auth failed ' + JSON.stringify(r.j))
  const u = { id: r.j.record.id, token: r.j.token }
  if (name) await api(`/api/collections/users/records/${u.id}`, { method: 'PATCH', token: u.token, body: { name, gender: 'male' } })
  return u
}

const su = (await api('/api/collections/_superusers/auth-with-password', { method: 'POST', body: { identity: SU.email, password: SU.password } })).j.token
const A = await login('alice@x.com', 'أليس')
const B = await login('bob@x.com', 'بوب')
const C = await login('carol@x.com')
// نضّف من المرة اللي فاتت
const del = (c, id) => api(`/api/collections/${c}/records/${id}`, { method: 'DELETE', token: su })
await del('rooms', 'testroom'); await del('presence', A.id); await del('presence', B.id)

await t('fake firebase token rejected', async () => { ok((await api('/api/kemet/auth', { method: 'POST', body: { idToken: 'nope' } })).status === 401) })
await t('user id = firebase uid', async () => { ok(A.id.length > 15 && /[A-Z]/.test(A.id + 'A')) })
await t('re-login same user', async () => { const again = await login('alice@x.com'); ok(again.id === A.id) })
await t('anon cannot list users', async () => { ok((await api('/api/collections/users/records')).j.items.length === 0) })
await t('email hidden from others', async () => { const r = await api(`/api/collections/users/records/${A.id}`, { token: B.token }); ok(r.status === 200 && !r.j.email && r.j.name === 'أليس') })
await t('cannot edit other profile', async () => { ok((await api(`/api/collections/users/records/${A.id}`, { method: 'PATCH', token: B.token, body: { name: 'هاك' } })).status === 404) })
await t('cannot change own email', async () => { ok((await api(`/api/collections/users/records/${A.id}`, { method: 'PATCH', token: A.token, body: { email: 'x@y.com' } })).status >= 400) })
await t('name too long rejected', async () => { ok((await api(`/api/collections/users/records/${A.id}`, { method: 'PATCH', token: A.token, body: { name: 'x'.repeat(40) } })).status === 400) })
await t('bad avatar rejected', async () => { ok((await api(`/api/collections/users/records/${A.id}`, { method: 'PATCH', token: A.token, body: { avatar: 'https://evil/x.png' } })).status === 400) })
await t('save bio/city/age', async () => { const r = await api(`/api/collections/users/records/${A.id}`, { method: 'PATCH', token: A.token, body: { bio: 'هاي', city: 'القاهرة', age: 25, rooms: ['pyramids'] } }); ok(r.status === 200 && r.j.city === 'القاهرة') })

// الأدوار
await api('/api/collections/config/records/roles', { method: 'PATCH', token: su, body: { data: { admins: [A.id], mods: {} } } })
await t('non-admin cannot create room', async () => { ok((await api('/api/collections/rooms/records', { method: 'POST', token: B.token, body: { id: 'pyramids', name: 'غرفة الأهرامات', order: 1 } })).status === 403) })
await t('admin creates room', async () => { ok((await api('/api/collections/rooms/records', { method: 'POST', token: A.token, body: { id: 'testroom', name: 'غرفة تجربة', order: 9 } })).status === 200) })
await t('admin appoints mod', async () => { ok((await api('/api/collections/config/records/roles', { method: 'PATCH', token: A.token, body: { data: { admins: [A.id], mods: { pyramids: [B.id] } } } })).status === 200) })
await t('admin cannot add admins', async () => { ok((await api('/api/collections/config/records/roles', { method: 'PATCH', token: A.token, body: { data: { admins: [A.id, C.id], mods: {} } } })).status === 403) })
await t('member cannot edit roles', async () => { ok((await api('/api/collections/config/records/roles', { method: 'PATCH', token: B.token, body: { data: { admins: [B.id], mods: {} } } })).status === 403) })
await t('mod pins', async () => { const r = await api('/api/collections/rooms/records/pyramids', { method: 'PATCH', token: B.token, body: { pinned: { text: 'الرحلة الجمعة' } } }); ok(r.status === 200 && r.j.pinned.byName === 'بوب') })
await t('mod cannot rename', async () => { ok((await api('/api/collections/rooms/records/pyramids', { method: 'PATCH', token: B.token, body: { name: 'هاك' } })).status === 403) })

// الرسايل
let mid
await t('profile-less user cannot send', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: C.token, body: { room: 'pyramids', kind: 'text', text: 'هاي' } })).status === 403) })
await t('send text (name forced from profile)', async () => {
  const r = await api('/api/collections/messages/records', { method: 'POST', token: A.token, body: { room: 'pyramids', kind: 'text', text: 'أهلاً', uid: B.id, name: 'بوب' } })
  ok(r.status === 200 && r.j.uid === A.id && r.j.name === 'أليس', JSON.stringify(r.j)); mid = r.j.id
})
await t('empty text rejected', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: A.token, body: { room: 'pyramids', kind: 'text', text: '  ' } })).status === 400) })
await t('missing room rejected', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: A.token, body: { room: 'nope', kind: 'text', text: 'x' } })).status === 400) })
await t('sticker ok', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: A.token, body: { room: 'pyramids', kind: 'sticker', sticker: 3 } })).status === 200) })
await t('sticker 9 rejected', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: A.token, body: { room: 'pyramids', kind: 'sticker', sticker: 9 } })).status === 400) })
await t('reply ok', async () => { const r = await api('/api/collections/messages/records', { method: 'POST', token: B.token, body: { room: 'pyramids', kind: 'text', text: 'رد', replyTo: { name: 'أليس', text: 'أهلاً', uid: A.id } } }); ok(r.status === 200 && r.j.replyTo.uid === A.id) })
await t('cannot update directly', async () => { ok((await api(`/api/collections/messages/records/${mid}`, { method: 'PATCH', token: A.token, body: { text: 'hack' } })).status >= 400) })
await t('react', async () => { ok((await api('/api/kemet/react', { method: 'POST', token: B.token, body: { id: mid, emoji: '❤️' } })).status === 200) })
await t('bad emoji rejected', async () => { ok((await api('/api/kemet/react', { method: 'POST', token: B.token, body: { id: mid, emoji: '💩' } })).status === 400) })
await t('reactions stored per user', async () => { await api('/api/kemet/react', { method: 'POST', token: A.token, body: { id: mid, emoji: '😂' } }); const r = await api(`/api/collections/messages/records/${mid}`, { token: A.token }); ok(r.j.reactions[B.id] === '❤️' && r.j.reactions[A.id] === '😂') })
await t('remove reaction', async () => { await api('/api/kemet/react', { method: 'POST', token: B.token, body: { id: mid, emoji: null } }); const r = await api(`/api/collections/messages/records/${mid}`, { token: A.token }); ok(!r.j.reactions[B.id]) })
await t('edit own', async () => { ok((await api('/api/kemet/edit', { method: 'POST', token: A.token, body: { id: mid, text: 'أهلاً بيكم' } })).status === 200) })
await t('edit other rejected', async () => { ok((await api('/api/kemet/edit', { method: 'POST', token: B.token, body: { id: mid, text: 'هاك' } })).status === 403) })
await t('filter: admin sets words', async () => { ok((await api('/api/collections/config/records/filter', { method: 'PATCH', token: A.token, body: { data: { words: ['كلب'], pattern: '(^|[^\\u0621-\\u064a])كلب($|[^\\u0621-\\u064a])' } } })).status === 200) })
await t('filter: bad word blocked', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: B.token, body: { room: 'pyramids', kind: 'text', text: 'انت كلب' } })).status === 400) })
await t('filter: word inside word allowed', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: B.token, body: { room: 'pyramids', kind: 'text', text: 'كلبش' } })).status === 200) })
await t('member cannot delete other msg', async () => { ok((await api(`/api/collections/messages/records/${mid}`, { method: 'DELETE', token: C.token })).status === 403) })
await t('mod deletes any msg', async () => { ok((await api(`/api/collections/messages/records/${mid}`, { method: 'DELETE', token: B.token })).status === 204) })

// المتصلين
await t('presence: own', async () => { const r = await api('/api/collections/presence/records', { method: 'POST', token: A.token, body: { id: A.id, room: 'pyramids' } }); ok(r.status === 200 && r.j.roomAt && r.j.name === 'أليس', JSON.stringify(r.j)) })
await t('presence: not for others', async () => { ok((await api('/api/collections/presence/records', { method: 'POST', token: B.token, body: { id: A.id + 'x', room: 'pyramids' } })).status >= 400) })
await t('presence: count in room', async () => {
  await api('/api/collections/presence/records', { method: 'POST', token: B.token, body: { id: B.id, room: 'pyramids' } })
  const since = new Date(Date.now() - 5 * 60000).toISOString().replace('T', ' ')
  const r = await api(`/api/collections/presence/records?perPage=1&filter=${encodeURIComponent(`room='pyramids' && roomAt>='${since}'`)}`, { token: C.token })
  ok(r.j.totalItems === 2, JSON.stringify(r.j))
})
// الكتم والطرد والحظر و"دخل الغرفة"
const D = await login('dave@x.com', 'داود')
await del('joins', 'pyramids_' + D.id)
const until = (h) => new Date(Date.now() + h * 3600e3).toISOString()
await t('join event own', async () => { const r = await api('/api/collections/joins/records', { method: 'POST', token: D.token, body: { id: 'pyramids_' + D.id, room: 'pyramids' } }); ok(r.status === 200 && r.j.name === 'داود', JSON.stringify(r.j)) })
await t('join event for other rejected', async () => { ok((await api('/api/collections/joins/records', { method: 'POST', token: D.token, body: { id: 'pyramids_' + A.id, room: 'pyramids' } })).status === 403) })
await t('join event update (re-enter)', async () => { ok((await api('/api/collections/joins/records/pyramids_' + D.id, { method: 'PATCH', token: D.token, body: { room: 'pyramids' } })).status === 200) })
await t('member cannot mute', async () => { ok((await api('/api/collections/restrict/records', { method: 'POST', token: C.token, body: { id: 'pyramids_' + D.id, room: 'pyramids', uid: D.id, type: 'mute', until: until(1) } })).status === 403) })
await t('mod cannot mute admin', async () => { ok((await api('/api/collections/restrict/records', { method: 'POST', token: B.token, body: { id: 'pyramids_' + A.id, room: 'pyramids', uid: A.id, type: 'mute', until: until(1) } })).status === 403) })
await t('mod mutes dave', async () => { const r = await api('/api/collections/restrict/records', { method: 'POST', token: B.token, body: { id: 'pyramids_' + D.id, room: 'pyramids', uid: D.id, type: 'mute', until: until(1), name: 'داود' } }); ok(r.status === 200 && r.j.byName === 'بوب', JSON.stringify(r.j)) })
await t('muted cannot send', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: D.token, body: { room: 'pyramids', kind: 'text', text: 'هاي' } })).status === 403) })
await t('mute 9 days rejected', async () => { ok((await api('/api/collections/restrict/records', { method: 'POST', token: B.token, body: { id: 'pyramids_' + C.id, room: 'pyramids', uid: C.id, type: 'mute', until: until(24 * 9) } })).status === 400) })
await t('mod lifts mute', async () => { ok((await api('/api/collections/restrict/records/pyramids_' + D.id, { method: 'DELETE', token: B.token })).status === 204) })
await t('dave sends after lift', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: D.token, body: { room: 'pyramids', kind: 'text', text: 'رجعت' } })).status === 200) })
await t('non-admin cannot app-ban', async () => { ok((await api('/api/collections/bans/records', { method: 'POST', token: B.token, body: { id: D.id, name: 'داود' } })).status === 403) })
await t('admin app-bans dave', async () => { ok((await api('/api/collections/bans/records', { method: 'POST', token: A.token, body: { id: D.id, name: 'داود', reason: 'سبام' } })).status === 200) })
await t('banned cannot send', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: D.token, body: { room: 'pyramids', kind: 'text', text: 'هاي' } })).status === 403) })
await t('admin cannot ban admin', async () => { ok((await api('/api/collections/bans/records', { method: 'POST', token: A.token, body: { id: A.id } })).status === 403) })
await t('admin unbans', async () => { ok((await api('/api/collections/bans/records/' + D.id, { method: 'DELETE', token: A.token })).status === 204) })

// ===== المرحلة ٢: الخاص والإشعارات والخصوصية والبلاغات =====
const E = await login('erin@x.com', 'إيرين')
const P = (id, body, tok) => api(`/api/collections/settings/records/${id}`, { method: 'PATCH', token: tok, body })
async function setSettings(u, body) {
  const r = await P(u.id, body, u.token)
  if (r.status === 404) return api('/api/collections/settings/records', { method: 'POST', token: u.token, body: { id: u.id, ...body } })
  return r
}
// نضّف من المرة اللي فاتت
const AB = [A.id, B.id].sort().join('_')
const AE = [A.id, E.id].sort().join('_')
for (const c of [AB, AE]) {
  await api(`/api/collections/chats/records/${c}`, { method: 'DELETE', token: su })
  const old = await api(`/api/collections/dms/records?perPage=200&filter=${encodeURIComponent(`chat='${c}'`)}`, { token: su })
  for (const m of old.j?.items || []) await api(`/api/collections/dms/records/${m.id}`, { method: 'DELETE', token: su })
}
await setSettings(A, { dmWho: 'rooms', blocked: {}, notif: {} })
await setSettings(B, { dmWho: 'rooms', blocked: {}, notif: {} })
await api(`/api/collections/users/records/${B.id}`, { method: 'PATCH', token: B.token, body: { rooms: [] } })
await api(`/api/collections/users/records/${E.id}`, { method: 'PATCH', token: E.token, body: { rooms: [] } })
const sendDM = (u, chat, body) => api('/api/collections/dms/records', { method: 'POST', token: u.token, body: { chat, kind: 'text', ...body } })
const getChat = (u, c = AB) => api(`/api/collections/chats/records/${c}`, { token: u.token })

await t('settings: others cannot read', async () => { ok((await api(`/api/collections/settings/records/${A.id}`, { token: B.token })).status === 404) })
await t('settings: cannot create for other', async () => { ok((await api('/api/collections/settings/records', { method: 'POST', token: C.token, body: { id: B.id + 'zz', dmWho: 'all' } })).status >= 400) })
await t('settings: bad notif rejected', async () => { ok((await P(A.id, { notif: { dms: 'x' } }, A.token)).status === 400) })
await t('dm: no shared room → rejected', async () => { ok((await sendDM(B, AB, { text: 'هاي' })).status === 403) })
await api(`/api/collections/users/records/${B.id}`, { method: 'PATCH', token: B.token, body: { rooms: ['pyramids'] } })
let dm1
await t('dm: shared room → ok, chat created', async () => {
  const r = await sendDM(B, AB, { text: 'هاي يا أليس', uid: A.id }); ok(r.status === 200 && r.j.uid === B.id, JSON.stringify(r.j)); dm1 = r.j.id
  const c = await getChat(A); ok(c.j.unread[A.id] === 1 && c.j.last.uid === B.id && c.j.last.text === 'هاي يا أليس', JSON.stringify(c.j))
})
await t('dm: outsider cannot read chat', async () => { ok((await getChat(C)).status === 404) })
await t('dm: outsider cannot list msgs', async () => { const r = await api(`/api/collections/dms/records?filter=${encodeURIComponent(`chat='${AB}'`)}`, { token: C.token }); ok(r.j.items.length === 0) })
await t('dm: outsider cannot send into chat', async () => { ok((await sendDM(C, AB, { text: 'x' })).status === 403) })
await t('dm: bad word blocked', async () => { ok((await sendDM(B, AB, { text: 'انت كلب' })).status === 400) })
await t('dm: image with fake media rejected', async () => { ok((await sendDM(B, AB, { kind: 'image', media: 'x', w: 1, h: 1 })).status === 400) })
await t('dm: unread counts up', async () => { await sendDM(B, AB, { kind: 'sticker', sticker: 2 }); const c = await getChat(A); ok(c.j.unread[A.id] === 2 && c.j.last.text === 'ستيكر') })
await t('dm: read + receipt', async () => { ok((await api('/api/kemet/dm/read', { method: 'POST', token: A.token, body: { chat: AB, receipt: true } })).status === 200); const c = await getChat(B); ok(c.j.unread[A.id] === 0 && c.j.readAt[A.id]) })
await t('dm: typing', async () => { ok((await api('/api/kemet/dm/typing', { method: 'POST', token: A.token, body: { chat: AB } })).status === 200); const c = await getChat(B); ok(c.j.typing[A.id]) })
await t('dm: outsider typing rejected', async () => { ok((await api('/api/kemet/dm/typing', { method: 'POST', token: C.token, body: { chat: AB } })).status === 403) })
await t('dm: react', async () => { ok((await api('/api/kemet/dm/react', { method: 'POST', token: A.token, body: { id: dm1, emoji: '❤️' } })).status === 200) })
await t('dm: outsider react rejected', async () => { ok((await api('/api/kemet/dm/react', { method: 'POST', token: C.token, body: { id: dm1, emoji: '❤️' } })).status === 403) })
await t('dm: edit other rejected', async () => { ok((await api('/api/kemet/dm/edit', { method: 'POST', token: A.token, body: { id: dm1, text: 'هاك' } })).status === 403) })
let dmLast
await t('dm: edit last updates preview', async () => {
  const r = await sendDM(B, AB, { text: 'غلط' }); dmLast = r.j.id
  ok((await api('/api/kemet/dm/edit', { method: 'POST', token: B.token, body: { id: dmLast, text: 'صح' } })).status === 200)
  ok((await getChat(A)).j.last.text === 'صح')
})
await t('dm: delete other rejected', async () => { ok((await api(`/api/collections/dms/records/${dmLast}`, { method: 'DELETE', token: A.token })).status === 404) })
await t('dm: delete last → preview', async () => { ok((await api(`/api/collections/dms/records/${dmLast}`, { method: 'DELETE', token: B.token })).status === 204); ok((await getChat(A)).j.last.text === '🚫 رسالة اتمسحت') })
await t('dm: blocked → rejected', async () => {
  await setSettings(A, { blocked: { [B.id]: { name: 'بوب' } } })
  ok((await sendDM(B, AB, { text: 'هاي' })).status === 403)
  await setSettings(A, { blocked: {} })
})
await t('dm: dmWho none → stranger rejected', async () => {
  await setSettings(A, { dmWho: 'none' })
  await api(`/api/collections/users/records/${E.id}`, { method: 'PATCH', token: E.token, body: { rooms: ['pyramids'] } })
  ok((await sendDM(E, AE, { text: 'هاي' })).status === 403)
})
await t('dm: none, but after I message them they can reply', async () => {
  ok((await sendDM(A, AE, { text: 'أهلاً إيرين' })).status === 200)
  ok((await sendDM(E, AE, { text: 'أهلاً' })).status === 200)
  await setSettings(A, { dmWho: 'rooms' })
})
await t('dm: list my chats', async () => { const r = await api('/api/collections/chats/records?sort=-updatedAt', { token: A.token }); ok(r.j.items.length === 2) })

// الإشعارات
const N = (u, body) => api('/api/kemet/notify', { method: 'POST', token: u.token, body })
const myNotifs = async (u) => (await api('/api/collections/notifications/records?sort=-at&perPage=100', { token: u.token })).j.items
await t('notif: dm', async () => {
  ok((await N(B, { to: A.id, type: 'dm', msgId: dm1, text: 'هاي' })).j.ok === true)
  const n = (await myNotifs(A)).find((x) => x.id === 'dm_' + B.id); ok(n && n.fromName === 'بوب' && !n.read)
})
await t('notif: dm with fake msg rejected', async () => { ok((await N(C, { to: A.id, type: 'dm', msgId: dm1, text: 'x' })).status === 403) })
await t('notif: others cannot read mine', async () => { const r = await api(`/api/collections/notifications/records?filter=${encodeURIComponent(`owner='${A.id}'`)}`, { token: B.token }); ok(r.j.items.length === 0) })
await t('notif: cannot create directly', async () => { ok((await api('/api/collections/notifications/records', { method: 'POST', token: B.token, body: { owner: A.id, type: 'dm' } })).status >= 400) })
await t('notif: muted category skipped', async () => {
  await setSettings(A, { notif: { dms: false, mentions: true } })
  ok((await N(B, { to: A.id, type: 'dm', msgId: dm1, text: 'هاي' })).j.ok === false)
  await setSettings(A, { notif: {} })
})
let rm
await t('notif: reply', async () => {
  rm = (await api('/api/collections/messages/records', { method: 'POST', token: B.token, body: { room: 'pyramids', kind: 'text', text: 'رد عليكي @أليس', replyTo: { name: 'أليس', text: 'x', uid: A.id } } })).j.id
  ok((await N(B, { to: A.id, type: 'reply', msgId: rm, text: 'رد' })).j.ok === true)
  ok((await myNotifs(A)).some((x) => x.type === 'reply' && x.roomName === 'غرفة الأهرامات'))
})
await t('notif: fake reply rejected', async () => { ok((await N(B, { to: C.id, type: 'reply', msgId: rm, text: 'x' })).status === 403) })
await t('notif: mention', async () => { ok((await N(B, { to: A.id, type: 'mention', msgId: rm, text: 'x' })).j.ok === true) })
await t('notif: react must match', async () => {
  ok((await N(A, { to: B.id, type: 'react', msgId: rm, emoji: '👍', text: 'x' })).status === 403)
  await api('/api/kemet/react', { method: 'POST', token: A.token, body: { id: rm, emoji: '👍' } })
  ok((await N(A, { to: B.id, type: 'react', msgId: rm, emoji: '👍', text: 'x' })).j.ok === true)
})
await t('notif: mod only from admin', async () => {
  ok((await N(C, { to: B.id, type: 'mod', roomId: 'pyramids' })).status === 403)
  ok((await N(A, { to: B.id, type: 'mod', roomId: 'pyramids' })).j.ok === true)
})
await t('notif: owner marks read only', async () => {
  const n = (await myNotifs(A))[0]
  ok((await api(`/api/collections/notifications/records/${n.id}`, { method: 'PATCH', token: A.token, body: { text: 'هاك' } })).status === 403)
  ok((await api(`/api/collections/notifications/records/${n.id}`, { method: 'PATCH', token: A.token, body: { read: true } })).status === 200)
})
await t('notif: read all', async () => { ok((await api('/api/kemet/notifs/read-all', { method: 'POST', token: A.token })).status === 200); ok((await myNotifs(A)).every((x) => x.read)) })

// البلاغات
let rep
await t('report: member reports', async () => { const r = await api('/api/collections/reports/records', { method: 'POST', token: B.token, body: { reporter: C.id, reported: E.id, reportedName: 'إيرين', reason: 'تحرش أو تهديد' } }); ok(r.status === 200, JSON.stringify(r.j)); rep = r.j.id })
await t('report: bad reason rejected', async () => { ok((await api('/api/collections/reports/records', { method: 'POST', token: B.token, body: { reported: E.id, reason: 'زهقت' } })).status === 400) })
await t('report: member cannot list', async () => { ok((await api('/api/kemet/reports', { token: B.token })).status === 403); ok((await api('/api/collections/reports/records', { token: B.token })).status >= 400) })
await t('report: admin lists (reporter forced)', async () => { const r = await api('/api/kemet/reports', { token: A.token }); const x = r.j.find((y) => y.id === rep); ok(x && x.reporter === B.id) })
await t('report: admin deletes', async () => { ok((await api(`/api/kemet/reports/${rep}`, { method: 'DELETE', token: A.token })).status === 200) })
await t('room: image without media rejected', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: B.token, body: { room: 'pyramids', kind: 'image', w: 8, h: 6 } })).status === 400) })
await t('room: game invite ok', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: B.token, body: { room: 'pyramids', kind: 'ludo', text: '🎲 تعالوا نلعب لودو', table: 'abc123' } })).status === 200) })

// ===== المرحلة ٣: الصور والفويس وصوري =====
async function upload(u, fields, bytes, name, type) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  fd.append('file', new Blob([bytes], { type }), name)
  const r = await fetch(PB + '/api/collections/media/records', { method: 'POST', headers: { Authorization: u.token }, body: fd })
  return { status: r.status, j: await r.json().catch(() => null) }
}
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9])
const MP3 = new Uint8Array((await import('node:fs')).readFileSync(new URL('./fixtures/voice.mp3', import.meta.url))) // فويس حقيقي من التطبيق
const fileOf = async (u, rec) => {
  const tok = (await api('/api/files/token', { method: 'POST', token: u.token })).j?.token
  return (await fetch(`${PB}/api/files/media/${rec.id}/${rec.file}?token=${tok}`)).status
}
let img, voice
await t('media: room image upload', async () => { const r = await upload(A, { type: 'image', room: 'pyramids', owner: B.id }, JPG, 'a.jpg', 'image/jpeg'); ok(r.status === 200 && r.j.owner === A.id, JSON.stringify(r.j)); img = r.j })
await t('media: needs room or chat', async () => { ok((await upload(A, { type: 'image' }, JPG, 'a.jpg', 'image/jpeg')).status === 400) })
await t('media: wrong file type rejected', async () => { ok((await upload(A, { type: 'image', room: 'pyramids' }, new TextEncoder().encode('<html>'), 'x.html', 'text/html')).status === 400) })
await t('room: image message', async () => { const r = await api('/api/collections/messages/records', { method: 'POST', token: A.token, body: { room: 'pyramids', kind: 'image', media: img.id, w: 800, h: 600, thumb: 'data:image/jpeg;base64,AAAA' } }); ok(r.status === 200, JSON.stringify(r.j)); img.msg = r.j.id })
await t('room: someone else\'s media rejected', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: B.token, body: { room: 'pyramids', kind: 'image', media: img.id, w: 8, h: 6 } })).status === 403) })
await t('room: media from other room rejected', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: A.token, body: { room: 'testroom', kind: 'image', media: img.id, w: 8, h: 6 } })).status >= 400) })
await t('room: bad thumb rejected', async () => { ok((await api('/api/collections/messages/records', { method: 'POST', token: A.token, body: { room: 'pyramids', kind: 'image', media: img.id, w: 8, h: 6, thumb: 'javascript:x' } })).status === 400) })
await t('media: room member can download', async () => { ok((await fileOf(C, img)) === 200) })
await t('media: no token → no file', async () => { ok((await fetch(`${PB}/api/files/media/${img.id}/${img.file}`)).status !== 200) })
await t('media: outsider cannot upload to chat', async () => { ok((await upload(C, { type: 'voice', chat: AB }, MP3, 'v.mp3', 'audio/mpeg')).status === 403) })
await t('dm: voice message', async () => {
  const r = await upload(B, { type: 'voice', chat: AB }, MP3, 'v.mp3', 'audio/mpeg'); ok(r.status === 200, JSON.stringify(r.j)); voice = r.j
  const m = await sendDM(B, AB, { kind: 'voice', media: voice.id, dur: 5 }); ok(m.status === 200, JSON.stringify(m.j)); voice.msg = m.j.id
  ok((await getChat(A)).j.last.text === '🎤 رسالة صوتية')
})
await t('dm: voice too long rejected', async () => { ok((await sendDM(B, AB, { kind: 'voice', media: voice.id, dur: 99 })).status === 400) })
await t('dm: room media in dm rejected', async () => { ok((await sendDM(A, AB, { kind: 'image', media: img.id, w: 8, h: 6 })).status === 403) })
await t('media: chat member downloads', async () => { ok((await fileOf(A, voice)) === 200) })
await t('media: outsider cannot download chat file', async () => { ok((await fileOf(C, voice)) !== 200) })
await t('media: deleted with its message', async () => {
  ok((await api(`/api/collections/dms/records/${voice.msg}`, { method: 'DELETE', token: B.token })).status === 204)
  ok((await api(`/api/collections/media/records/${voice.id}`, { token: B.token })).status === 404)
})
await t('photos: add own', async () => { await api(`/api/collections/photos/records/${A.id}_0`, { method: 'DELETE', token: A.token }); ok((await api('/api/collections/photos/records', { method: 'POST', token: A.token, body: { id: A.id + '_0', owner: A.id, slot: 0, data: 'data:image/jpeg;base64,AAAA' } })).status === 200) })
await t('photos: not for others', async () => { ok((await api('/api/collections/photos/records', { method: 'POST', token: A.token, body: { id: B.id + '_0', owner: B.id, slot: 0, data: 'data:image/jpeg;base64,AAAA' } })).status >= 400) })
await t('photos: id must match slot', async () => { ok((await api('/api/collections/photos/records', { method: 'POST', token: A.token, body: { id: A.id + '_3', owner: A.id, slot: 1, data: 'data:image/jpeg;base64,AAAA' } })).status === 403) })
await t('photos: bad data rejected', async () => { ok((await api(`/api/collections/photos/records/${A.id}_0`, { method: 'PATCH', token: A.token, body: { data: 'https://x/y.png' } })).status === 400) })
await t('photos: others can see, not edit', async () => {
  ok((await api(`/api/collections/photos/records?filter=${encodeURIComponent(`owner='${A.id}'`)}`, { token: B.token })).j.items.length === 1)
  ok((await api(`/api/collections/photos/records/${A.id}_0`, { method: 'PATCH', token: B.token, body: { data: 'data:image/jpeg;base64,BBBB' } })).status === 404)
})

// ===== المرحلة ٤: الكوينز والألعاب والمسابقة =====
const G = (u, body) => api('/api/kemet/game', { method: 'POST', token: u.token, body })
const coins = async (u) => (await api('/api/kemet/wallet', { method: 'POST', token: u.token })).j.coins
const tbl = async (id) => (await api(`/api/collections/tables/records/${id}`, { token: A.token })).j
const suPatch = async (id, patch) => { const r = await tbl(id); return api(`/api/collections/tables/records/${id}`, { method: 'PATCH', token: su, body: { state: { ...r.state, ...patch } } }) }
await coins(B); await api(`/api/collections/wallets/records/${B.id}`, { method: 'PATCH', token: su, body: { coins: 1000 } })
await t('wallet: welcome 500', async () => {
  await api(`/api/collections/wallets/records/${E.id}`, { method: 'DELETE', token: su })
  for (const x of (await api(`/api/collections/coinlog/records?perPage=500&filter=${encodeURIComponent(`owner='${E.id}'`)}`, { token: su })).j.items) await api(`/api/collections/coinlog/records/${x.id}`, { method: 'DELETE', token: su })
  ok((await coins(E)) === 500)
})
await t('wallet: cannot edit directly', async () => { ok((await api(`/api/collections/wallets/records/${E.id}`, { method: 'PATCH', token: E.token, body: { coins: 99999 } })).status >= 400) })
await t('daily: once a day', async () => {
  ok((await api('/api/kemet/daily', { method: 'POST', token: E.token })).j.reward === 100)
  ok((await api('/api/kemet/daily', { method: 'POST', token: E.token })).status === 400)
  ok((await coins(E)) === 600)
})
await t('gift: admin only', async () => {
  ok((await api('/api/kemet/gift', { method: 'POST', token: B.token, body: { uid: E.id, amount: 50 } })).status === 403)
  ok((await api('/api/kemet/gift', { method: 'POST', token: A.token, body: { uid: E.id, amount: 50 } })).status === 200)
  ok((await coins(E)) === 650)
})
await t('coin log: own only', async () => {
  ok((await api(`/api/collections/coinlog/records?filter=${encodeURIComponent(`owner='${E.id}'`)}`, { token: E.token })).j.items.length === 3)
  ok((await api(`/api/collections/coinlog/records?filter=${encodeURIComponent(`owner='${E.id}'`)}`, { token: B.token })).j.items.length === 0)
})
let L
await t('ludo: create with fee (pays 100)', async () => {
  const r = await G(E, { action: 'create', kind: 'ludo', size: 2, fee: 100, room: 'pyramids' }); ok(r.status === 200, JSON.stringify(r.j)); L = r.j.id
  ok((await coins(E)) === 550)
  const x = await tbl(L); ok(x.status === 'waiting' && x.state.roomName === 'غرفة الأهرامات')
})
await t('ludo: bad fee rejected', async () => { ok((await G(E, { action: 'create', kind: 'ludo', size: 2, fee: 7 })).status === 400) })
await t('ludo: not enough coins', async () => { const D2 = await login('dave@x.com'); await coins(D2); await api(`/api/collections/wallets/records/${D.id}`, { method: 'PATCH', token: su, body: { coins: 50 } }); ok((await G(D2, { action: 'create', kind: 'ludo', size: 2, fee: 100 })).status === 400) })
await t('ludo: B joins → playing', async () => { ok((await G(B, { action: 'join', id: L })).status === 200); const x = await tbl(L); ok(x.status === 'playing' && x.seats.length === 2) })
await t('ludo: not your turn', async () => { ok((await G(B, { action: 'roll', id: L })).status === 403) })
await t('ludo: roll', async () => { ok((await G(E, { action: 'roll', id: L })).status === 200); const x = await tbl(L); ok(x.state.dice >= 1 && x.state.dice <= 6 && x.state.phase === 'move') })
await t('ludo: cannot roll twice', async () => { ok((await G(E, { action: 'roll', id: L })).status === 400) })
await t('ludo: illegal move rejected', async () => { await suPatch(L, { dice: 3, p0: [0, 0, 0, 0] }); ok((await G(E, { action: 'move', id: L, piece: 0 })).status === 400) })
await t('ludo: early skip rejected', async () => { ok((await G(B, { action: 'pass', id: L })).status === 403) })
await t('ludo: stuck → pass ok', async () => { ok((await G(E, { action: 'pass', id: L })).status === 200); ok((await tbl(L)).state.turn === 1) })
await t('ludo: capture', async () => {
  await suPatch(L, { turn: 1, phase: 'move', dice: 2, p0: [3, 0, 0, 0], p1: [27, 0, 0, 0] }) // أخضر(26)+27-1 = 52%52 = 0 ... نحسبها: B على 27 → 2 خطوة = 29 → abs (26+29-1)%52=2 ؛ E على 3 → abs 2
  ok((await G(B, { action: 'move', id: L, piece: 0 })).status === 200)
  const x = await tbl(L); ok(x.state.p0[0] === 0 && x.state.p1[0] === 29 && x.state.turn === 1, JSON.stringify(x.state))
})
await t('ludo: win takes the pot (200)', async () => {
  const before = await coins(B)
  await suPatch(L, { turn: 0, phase: 'move', dice: 1, p0: [57, 57, 57, 56] })
  ok((await G(E, { action: 'move', id: L, piece: 3 })).status === 200)
  const x = await tbl(L); ok(x.status === 'done' && x.state.winner === E.id)
  ok((await coins(E)) === 750 && (await coins(B)) === before) // B دفع لما دخل
  const sc = await api(`/api/collections/scores/records/ludo_${E.id}`, { token: B.token }); ok(sc.j.n >= 1)
})
await t('ludo: admin win refunds everyone', async () => {
  const id = (await G(E, { action: 'create', kind: 'ludo', size: 2, fee: 250 })).j.id
  ok((await coins(E)) === 500)
  await G(A, { action: 'join', id })
  await suPatch(id, { turn: 1, phase: 'move', dice: 1, p1: [57, 57, 57, 56] })
  ok((await G(A, { action: 'move', id, piece: 3 })).status === 200)
  ok((await coins(E)) === 750)
})
await t('ludo: host leaves waiting fee table → cancelled + refund', async () => {
  const id = (await G(E, { action: 'create', kind: 'snakes', size: 4, fee: 100 })).j.id
  await G(B, { action: 'join', id })
  const b0 = await coins(B)
  ok((await G(E, { action: 'leave', id })).status === 200)
  const st = (await tbl(id)).status, ce = await coins(E), cb = await coins(B); ok(st === 'cancelled' && ce === 750 && cb === b0 + 100, JSON.stringify({ st, ce, cb, b0 }))
})
await t('snakes: ladder to 100 wins 50 (free)', async () => {
  const id = (await G(E, { action: 'create', kind: 'snakes', size: 2 })).j.id
  await G(B, { action: 'join', id })
  await suPatch(id, { phase: 'move', dice: 1, p0: 99 })
  ok((await G(E, { action: 'move', id })).status === 200)
  const x = await tbl(id); ok(x.status === 'done' && x.state.p0 === 100)
  ok((await coins(E)) === 800)
})
await t('table chat: seated only', async () => {
  ok((await G(B, { action: 'chat', id: L, text: 'جيم حلو' })).status === 200)
  ok((await G(C, { action: 'chat', id: L, text: 'x' })).status === 403)
  ok((await api('/api/collections/tablechat/records', { method: 'POST', token: B.token, body: { table: L, text: 'x' } })).status >= 400)
})
let Dm
await t('domino: full table deals 7 each', async () => {
  Dm = (await G(E, { action: 'create', kind: 'domino', size: 2 })).j.id
  ok((await G(B, { action: 'join', id: Dm })).status === 200)
  const x = await tbl(Dm); ok(x.status === 'playing' && x.state.c0 === 7 && x.state.next === 14 && !x.deck)
  const h = await api(`/api/collections/hands/records/${Dm}_${E.id}`, { token: E.token }); ok(h.j.tiles.length === 7)
})
await t('domino: cannot see other hand', async () => { ok((await api(`/api/collections/hands/records/${Dm}_${E.id}`, { token: B.token })).status === 404) })
await t('domino: play / wrong tile', async () => {
  const x = await tbl(Dm); const who = [E, B][x.state.turn]
  const h = (await api(`/api/collections/hands/records/${Dm}_${who.id}`, { token: who.token })).j
  const notMine = [...Array(28).keys()].map((i) => i).find((v) => !h.tiles.includes(v))
  ok((await G(who, { action: 'play', id: Dm, x: notMine, side: 'R' })).status === 400)
  ok((await G(who, { action: 'play', id: Dm, x: h.tiles[0], side: 'R' })).status === 200)
  const y = await tbl(Dm); ok(y.state.chain.length === 1 && y.state[`c${x.state.turn}`] === 6)
})
await t('domino: blocked → lowest pips wins, hands open', async () => {
  await suPatch(Dm, { passes: 1, turnAt: 0 })
  const x = await tbl(Dm); const other = [E, B][1 - x.state.turn]
  ok((await G(other, { action: 'pass', id: Dm })).status === 200)
  const y = await tbl(Dm); ok(y.status === 'done' && typeof y.state.r0 === 'number', JSON.stringify(y.state))
  ok((await api(`/api/collections/hands/records/${Dm}_${E.id}`, { token: B.token })).status === 200)
})
// المسابقة
const Q = (u, body) => api('/api/kemet/quiz', { method: 'POST', token: u.token, body: { room: 'pyramids', ...body } })
const H = (s) => require('node:crypto').createHash('sha256').update(s).digest('hex')
await t('quiz: member cannot start', async () => { ok((await Q(E, { action: 'start', data: { type: 'trivia', prompt: 'س؟', hashes: [H('نعم')], round: 1, total: 2 } })).status === 403) })
await t('quiz: mod starts', async () => { ok((await Q(B, { action: 'start', data: { type: 'trivia', prompt: 'عاصمة مصر؟', hashes: [H('القاهره')], round: 1, total: 2 } })).status === 200) })
await t('quiz: early timeout ignored', async () => { ok((await Q(E, { action: 'timeout', round: 1, answer: 'x' })).j.ok === false) })
await t('quiz: wrong hash ignored', async () => { ok((await Q(E, { action: 'answer', hash: H('اسكندريه'), answer: 'x' })).j.ok === false) })
await t('quiz: right answer → point (no coins) + total', async () => {
  const c0 = await coins(E)
  ok((await Q(E, { action: 'answer', hash: H('القاهره'), answer: 'القاهرة' })).j.ok === true)
  ok((await Q(B, { action: 'answer', hash: H('القاهره'), answer: 'القاهرة' })).j.ok === false)
  ok((await coins(E)) === c0)
  const all = await api(`/api/collections/scores/records/quizall_${E.id}`, { token: C.token }); ok(all.j.n >= 1 && all.j.board === 'quizall')
  const q = await api('/api/collections/quiz/records/pyramids', { token: C.token }); ok(q.j.state.winner === E.id)
})
await t('quiz: next round by mod, then end', async () => {
  ok((await Q(B, { action: 'next', data: { type: 'trivia', prompt: 'لون السما؟', hashes: [H('ازرق')], round: 2, total: 2 } })).j.ok === true)
  ok((await Q(B, { action: 'stop' })).status === 200)
  ok((await Q(B, { action: 'end' })).status === 200)
})
await t('status endpoint', async () => { ok((await api('/api/kemet/status')).j.ok === true) })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
