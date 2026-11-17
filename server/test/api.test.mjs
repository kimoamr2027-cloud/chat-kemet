// اختبارات سيرفر PocketBase (المرحلة ١)
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
await t('status endpoint', async () => { ok((await api('/api/kemet/status')).j.ok === true) })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
