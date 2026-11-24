// الرسائل الخاصة من سيرفر PocketBase (نفس شكل src/dm.js علشان الشاشات ماتتغيرش)
import { useEffect, useState } from 'react'
import { pb, q, live, toDate } from './client.js'
export { chatIdFor, otherOf, REPORT_REASONS } from '../dmShared.js'
import { chatIdFor } from '../dmShared.js'

// الشاشات متعودة على وقت Firestore (‎.toMillis())، فبنلبّس التواريخ نفس الشكل
const stamp = (s) => { const d = s ? new Date(s) : null; return d && !isNaN(d) ? { toMillis: () => d.getTime(), toDate: () => d } : null }
const stamps = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, stamp(v)]))
const toChat = (r) => ({
  id: r.id,
  members: [r.a, r.b],
  last: r.last ? { ...r.last, at: stamp(r.last.at) } : null,
  unread: r.unread || {},
  readAt: stamps(r.readAt),
  typing: stamps(r.typing),
  active: r.active || {},
  req: r.req || null, // طلب رسايل من زائر
  at: toDate(r.updatedAt) || toDate(r.created) || new Date(),
})
const toMsg = (r) => {
  const m = { ...r, at: toDate(r.created), pending: false }
  for (const k of ['text', 'media', 'thumb', 'table']) if (!m[k]) delete m[k]
  if (!m.replyTo) delete m.replyTo
  if (m.kind !== 'sticker') delete m.sticker
  if (!m.edited) delete m.edited
  return m
}

// بيانات أي عضو (مع كاش بسيط)
const userCache = new Map()
export async function getUserName(uid) {
  if (userCache.get(uid)?.name) return userCache.get(uid).name
  try { return (await pb.collection('users').getOne(uid, { fields: 'name' })).name || null } catch { return null }
}

export function useUser(uid) {
  const [u, setU] = useState(() => (uid ? userCache.get(uid) : null))
  useEffect(() => {
    if (!uid) return
    const set = (r) => { const v = r ? { ...r } : null; userCache.set(uid, v); setU(v) }
    pb.collection('users').getOne(uid).then(set).catch((e) => (e?.status === 404 ? set(null) : setU(userCache.get(uid) || null)))
    return live('users', uid, (ev) => set(ev.action === 'delete' ? null : ev.record))
  }, [uid])
  return u
}


// صورة العضو بس (جنب اسمه في رسايل الغرف): طلب واحد لكل عضو مهما كانت رسايله كتير، وبتتجدد كل ١٠ دقايق
const faces = new Map() // uid -> { v, at, subs }
export function useAvatar(uid) {
  const [v, setV] = useState(() => (uid ? faces.get(uid)?.v ?? userCache.get(uid)?.avatar : undefined))
  useEffect(() => {
    if (!uid) return
    let f = faces.get(uid)
    if (!f || (f.v !== undefined && Date.now() - f.at > 600000)) {
      f = { v: f?.v, at: Date.now(), subs: f?.subs || new Set() }
      faces.set(uid, f)
      pb.collection('users').getOne(uid, { fields: 'avatar' }).then((r) => r.avatar).then((a) => { f.v = a || '' }).catch(() => { f.v = f.v ?? '' }).finally(() => { f.at = Date.now(); f.subs.forEach((s) => s(f.v)) })
    }
    f.subs.add(setV)
    if (f.v !== undefined) setV(f.v)
    return () => { f.subs.delete(setV) }
  }, [uid])
  return v
}

// محادثاتي (مترتبة بآخر رسالة)
export function useChats(me) {
  const [chats, setChats] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!me) return
    let map = null
    const early = []
    const put = (ev) => { if (ev.action === 'delete') map.delete(ev.record.id); else map.set(ev.record.id, toChat(ev.record)) }
    const emit = () => setChats([...map.values()].sort((a, b) => b.at - a.at))
    const filter = `a=${q(me)} || b=${q(me)}`
    const off = live('chats', '*', (ev) => { if (!map) return early.push(ev); put(ev); emit() }, { filter })
    pb.collection('chats').getFullList({ filter, sort: '-updatedAt' })
      .then((list) => { map = new Map(list.map((r) => [r.id, toChat(r)])); early.forEach(put); emit() })
      .catch(setError)
    return off
  }, [me])
  return { chats, error }
}

export function useChatDoc(chatId, bump = 0) {
  // undefined = بيحمّل، null = لسه مفيش محادثة
  const [chat, setChat] = useState(undefined)
  useEffect(() => {
    if (!bump) setChat(undefined)
    pb.collection('chats').getOne(chatId).then((r) => setChat(toChat(r))).catch(() => setChat(null))
    // (بنسمع على المجموعة بفلتر مش على الـ id، علشان نعرف لو المحادثة اتعملت وانت فاتحها)
    return live('chats', '*', (ev) => { if (ev.record?.id === chatId) setChat(ev.action === 'delete' ? null : toChat(ev.record)) }, { filter: `id = '${chatId}'` })
  }, [chatId, bump])
  return chat
}

export function useChatMessages(chatId, enabled) {
  const [msgs, setMsgs] = useState(null)
  const [lim, setLim] = useState(50)
  const [more, setMore] = useState(false)
  useEffect(() => { setLim(50) }, [chatId])
  // المحادثة لسه مش موجودة: بنسمع برضه علشان أول رسالة توصل على طول
  useEffect(() => {
    let alive = true
    let list = enabled ? null : []
    if (!enabled) setMsgs([])
    const early = []
    const apply = (ev) => {
      const m = toMsg(ev.record)
      if (ev.action === 'create') { if (!list.some((x) => x.id === m.id)) list = [...list, m] }
      else if (ev.action === 'update') list = list.map((x) => (x.id === m.id ? m : x))
      else list = list.filter((x) => x.id !== m.id)
    }
    const off = live('dms', '*', (ev) => {
      if (!list) return early.push(ev)
      apply(ev)
      if (alive) setMsgs(list)
    }, { filter: `chat=${q(chatId)}` })
    if (enabled) {
      pb.collection('dms').getList(1, lim, { filter: `chat=${q(chatId)}`, sort: '-created' })
        .then((r) => {
          list = r.items.map(toMsg).reverse()
          early.forEach(apply)
          if (!alive) return
          setMore(r.totalItems > r.items.length)
          setMsgs(list)
        })
        .catch(() => alive && setMsgs([]))
    }
    return () => { alive = false; off() }
  }, [chatId, enabled, lim])
  if (msgs) { msgs.more = more; msgs.loadMore = () => setLim((l) => Math.min(l + 50, 400)) }
  return msgs
}

// بعت رسالة (السيرفر بيحدّث المحادثة وبيتأكد من الحظر والخصوصية)
export async function sendDM({ me, other, kind, text, sticker, media, w, h, dur, replyTo, table, thumb }) {
  const data = { chat: chatIdFor(me, other), kind }
  if (kind === 'text') data.text = text.slice(0, 1000)
  if (kind === 'sticker') data.sticker = sticker
  if (kind === 'image') Object.assign(data, { media, w, h, ...(thumb ? { thumb } : {}) })
  if (kind === 'voice') Object.assign(data, { media, dur })
  if (kind === 'ludo' || kind === 'snakes' || kind === 'domino') Object.assign(data, { text: text.slice(0, 200), table })
  if (replyTo) data.replyTo = { name: replyTo.who.slice(0, 30), text: replyTo.text.slice(0, 200) }
  try {
    return (await pb.collection('dms').create(data)).id
  } catch (e) {
    // نفس كود Firebase علشان الشاشة تقول "مش بيستقبل رسايل منك"
    if (e?.status === 403) e.code = 'permission-denied'
    throw e
  }
}

// بكتب دلوقتي (بيتبعت كل ٣ ثواني بالكتير)
const lastTyping = new Map()
export function sendTyping(chatId) {
  const t = Date.now()
  if (t - (lastTyping.get(chatId) || 0) < 3000) return
  lastTyping.set(chatId, t)
  pb.send('/api/kemet/dm/typing', { method: 'POST', body: { chat: chatId } }).catch(() => {})
}

// قريت المحادثة
export const answerDMRequest = (chatId, ok) => pb.send('/api/kemet/dm/request', { method: 'POST', body: { chat: chatId, ok } })
export const markRead = (chatId, me, withReceipt) => pb.send('/api/kemet/dm/read', { method: 'POST', body: { chat: chatId, receipt: !!withReceipt } })

export const setDMReaction = (chatId, msgId, me, emoji) => pb.send('/api/kemet/dm/react', { method: 'POST', body: { id: msgId, emoji: emoji || null } })

export function reportUser({ other, otherName, reason, chatId }) {
  return pb.collection('reports').create({ reported: other, reportedName: (otherName || '').slice(0, 30), reason, chatId })
}

// ===== تعديل ومسح رسايلي في الخاص (السيرفر بيحدّث المعاينة لوحده) =====
export const editDM = (chatId, msgId, text) => pb.send('/api/kemet/dm/edit', { method: 'POST', body: { id: msgId, text: text.slice(0, 1000) } })
export const deleteDM = (chatId, m) => pb.collection('dms').delete(m.id)
