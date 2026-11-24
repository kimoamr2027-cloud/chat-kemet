// الغرف والرسايل من سيرفر PocketBase (نفس شكل src/rooms.js بالظبط علشان الشاشات ماتتغيرش)
import { useEffect, useState } from 'react'
import { pb, q, live, toDate, cacheGet, cacheSet } from './client.js'
export { DEFAULT_ROOMS, preview, fmtTime, fmtWhen, fmtDay, colorIndex, EDIT_WINDOW_MS, canEditMsg, PAGE } from '../roomsShared.js'
import { PAGE } from '../roomsShared.js'

const toRoom = (r) => ({ id: r.id, name: r.name, order: r.order, photo: r.photo || '', pinned: r.pinned || null, hidden: !!r.hidden })
const toMsg = (r) => {
  const m = { ...r, at: toDate(r.created), pending: false }
  for (const k of ['text', 'media', 'thumb', 'table']) if (!m[k]) delete m[k]
  if (!m.replyTo) delete m.replyTo
  else if (!m.replyTo.uid) delete m.replyTo.uid
  if (m.kind !== 'sticker') delete m.sticker
  if (!m.edited) delete m.edited
  return m
}

// الرسايل المحفوظة: التاريخ بيرجع Date
const revive = (m) => (m ? { ...m, at: m.at ? new Date(m.at) : null } : m)

// الغرف الظاهرة (والممسوحة لوحدها علشان الأدمن يرجّعها)
export function useRooms() {
  const [rooms, setRooms] = useState(() => cacheGet('rooms'))
  const [hidden, setHidden] = useState([])
  const [error, setError] = useState(null)
  useEffect(() => {
    let list = []
    const set = () => {
      const all = [...list].sort((a, b) => (a.order || 0) - (b.order || 0))
      const r = all.filter((x) => !x.hidden)
      setRooms(r); setHidden(all.filter((x) => x.hidden)); cacheSet('rooms', r)
    }
    pb.collection('rooms').getFullList({ sort: 'order' }).then((r) => { list = r.map(toRoom); set() }).catch(setError)
    return live('rooms', '*', (ev) => {
      const x = toRoom(ev.record)
      list = list.filter((y) => y.id !== x.id)
      if (ev.action !== 'delete') list.push(x)
      set()
    })
  }, [])
  return { rooms, hidden, error }
}

export function useRoom(id) {
  const [room, setRoom] = useState(() => cacheGet('rooms')?.find((r) => r.id === id) ?? undefined)
  useEffect(() => {
    setRoom(cacheGet('rooms')?.find((r) => r.id === id) ?? undefined)
    // الغرفة الممسوحة (المخفية) كأنها مش موجودة
    const one = (r) => (r.hidden ? null : toRoom(r))
    pb.collection('rooms').getOne(id).then((r) => setRoom(one(r))).catch((e) => setRoom(e?.status === 404 ? null : undefined))
    return live('rooms', id, (ev) => setRoom(ev.action === 'delete' ? null : one(ev.record)))
  }, [id])
  return room
}

export function useLastMessage(roomId) {
  const [msg, setMsg] = useState(() => revive(cacheGet('last-' + roomId)) ?? undefined)
  useEffect(() => {
    const put = (m) => { setMsg(m); cacheSet('last-' + roomId, m) }
    const load = () => pb.collection('messages').getList(1, 1, { filter: `room=${q(roomId)}`, sort: '-created', skipTotal: true })
      .then((r) => put(r.items[0] ? toMsg(r.items[0]) : null)).catch(() => setMsg((m) => (m === undefined ? null : m)))
    load()
    return live('messages', '*', (ev) => (ev.action === 'create' ? put(toMsg(ev.record)) : load()), { filter: `room=${q(roomId)}` })
  }, [roomId])
  return msg
}

// رسايل الغرفة لحظيًا (آخر ٥٠ رسالة، وزرار "رسايل أقدم" بيجيب أكتر)
export function useMessages(roomId, enabled = true) {
  const fromCache = () => (cacheGet('msgs-' + roomId) || null)?.map(revive) ?? null
  const [msgs, setMsgs] = useState(fromCache)
  const [error, setError] = useState(null)
  const [lim, setLim] = useState(PAGE)
  const [more, setMore] = useState(false)
  useEffect(() => { setLim(PAGE); setMsgs(fromCache()) }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!enabled) return
    setError(null)
    let alive = true
    let list = null
    // آخر ٥٠ رسالة بتتحفظ على الموبايل علشان الغرفة تفتح على طول المرة الجاية
    const save = () => { if (list) cacheSet('msgs-' + roomId, list.slice(-PAGE)) }
    const early = [] // أحداث وصلت قبل ما الرسايل الأولى تتحمّل
    const apply = (ev) => {
      const m = toMsg(ev.record)
      if (ev.action === 'create') { if (!list.some((x) => x.id === m.id)) list = [...list, m] }
      else if (ev.action === 'update') list = list.map((x) => (x.id === m.id ? m : x))
      else list = list.filter((x) => x.id !== m.id)
    }
    const off = live('messages', '*', (ev) => {
      if (!list) return early.push(ev)
      apply(ev)
      if (alive) setMsgs(list)
      save()
    }, { filter: `room=${q(roomId)}` })
    pb.collection('messages').getList(1, lim, { filter: `room=${q(roomId)}`, sort: '-created' })
      .then((r) => {
        list = r.items.map(toMsg).reverse()
        early.forEach(apply)
        if (!alive) return
        setMore(r.totalItems > r.items.length)
        setMsgs(list)
        save()
      })
      .catch((e) => alive && setError(e))
    return () => { alive = false; off() }
  }, [roomId, enabled, lim])
  return { msgs, error, more, loadMore: () => setLim((l) => Math.min(l + PAGE, 400)) }
}

export function sendRoomMessage(roomId, profile, uid, { kind, text, sticker, media, w, h, dur, replyTo, table, thumb }) {
  const data = { room: roomId, kind }
  if (kind === 'text') data.text = text.slice(0, 1000)
  if (kind === 'sticker') data.sticker = sticker
  if (kind === 'image') Object.assign(data, { media, w, h, ...(thumb ? { thumb } : {}) })
  if (kind === 'voice') Object.assign(data, { media, dur })
  if (kind === 'ludo' || kind === 'snakes' || kind === 'domino') Object.assign(data, { text: text.slice(0, 200), table })
  if (replyTo) data.replyTo = { name: replyTo.who.slice(0, 30), text: replyTo.text.slice(0, 200), uid: replyTo.uid || '' }
  return pb.collection('messages').create(data)
}

export const setReaction = (roomId, msgId, uid, emoji) => pb.send('/api/kemet/react', { method: 'POST', body: { id: msgId, emoji: emoji || null } })

// أعضاء الغرفة = كل اللي دخلوها (مسجّلة في users.rooms) — بيتحمّل لما قايمة الأعضاء تتفتح بس
export function useRoomMembers(roomId, enabled = true) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return
    pb.collection('users').getList(1, 300, { filter: `rooms~${q('"' + roomId + '"')}`, fields: 'id,name,avatar', skipTotal: true })
      .then((r) => setList(r.items.map((u) => ({ uid: u.id, name: u.name, avatar: u.avatar }))))
      .catch(() => setList([]))
  }, [roomId, enabled])
  return list
}

// ===== الأدمن: الغرف =====
export const createRoom = (name, order) => pb.collection('rooms').create({ name: name.trim().slice(0, 30), order })
export const renameRoom = (id, name) => pb.collection('rooms').update(id, { name: name.trim().slice(0, 30) })
// «المسح» بيخفي الغرفة بس (برسايلها)، والأدمن يقدر يرجّعها
export const removeRoom = (id) => pb.collection('rooms').update(id, { hidden: true })
export const restoreRoom = (id) => pb.collection('rooms').update(id, { hidden: false })

// ===== تعديل ومسح رسايلي =====
export const editRoomMessage = (roomId, msgId, text) => pb.send('/api/kemet/edit', { method: 'POST', body: { id: msgId, text: text.slice(0, 1000) } })
export const deleteOwnRoomMessage = (roomId, m) => pb.collection('messages').delete(m.id)

// ===== الإعلان المثبّت وصورة الغرفة (الأدمن أو مشرف الغرفة) =====
export const setPinned = (roomId, text) => pb.collection('rooms').update(roomId, { pinned: { text: text.trim().slice(0, 300) } })
export const clearPinned = (roomId) => pb.collection('rooms').update(roomId, { pinned: null })
export const setRoomPhoto = (roomId, dataUrl) => pb.collection('rooms').update(roomId, { photo: dataUrl || '' })
