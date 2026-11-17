// الأدمن والمشرفين: الكتم والطرد والحظر (من سيرفر PocketBase)
// البلاغات لسه على Firebase لحد ما الخاص يتنقل (المرحلة ٢)
import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, orderBy, limit, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { pb, q, live, toDate } from './client.js'
import { notify } from '../notifs.js'
export { isAdminUid, isModUid, canModerate, roleOf, timeLeft, EMPTY_ROLES } from '../rolesShared.js'
import { EMPTY_ROLES } from '../rolesShared.js'

export function useRolesDoc(enabled) {
  const [roles, setRoles] = useState(EMPTY_ROLES)
  useEffect(() => {
    if (!enabled) return
    const set = (r) => setRoles({ ...EMPTY_ROLES, ...(r?.data || {}), loaded: true })
    pb.collection('config').getOne('roles').then(set).catch(() => set(null))
    return live('config', 'roles', (ev) => set(ev.record))
  }, [enabled])
  return roles
}

// ===== المشرفين (الأدمن بس) =====
export async function setMod(roomId, uid, on, me, myName, roomName) {
  const r = await pb.collection('config').getOne('roles')
  const data = { admins: [], mods: {}, ...(r.data || {}) }
  const list = new Set(data.mods[roomId] || [])
  if (on) list.add(uid); else list.delete(uid)
  data.mods = { ...data.mods, [roomId]: [...list] }
  await pb.collection('config').update('roles', { data })
  if (on) notify(uid, me, myName, { type: 'mod', roomId, roomName, text: '' })
}

// ===== الكتم والطرد من الغرفة =====
export function useRestrictions(roomId) {
  const [map, setMap] = useState({})
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    let cur = {}
    const put = (r) => { cur = { ...cur, [r.uid]: { ...r, until: toDate(r.until) } } }
    pb.collection('restrict').getFullList({ filter: `room=${q(roomId)}` })
      .then((list) => { cur = {}; list.forEach(put); setMap(cur) }).catch(() => setMap({}))
    return live('restrict', '*', (ev) => {
      if (ev.action === 'delete') { const { [ev.record.uid]: _, ...rest } = cur; cur = rest } else put(ev.record)
      setMap(cur)
    }, { filter: `room=${q(roomId)}` })
  }, [roomId])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])
  const active = {}
  for (const [uid, r] of Object.entries(map)) if (r.until && r.until.getTime() > now) active[uid] = r
  return active
}

export async function restrictUser({ roomId, uid, name, type, hours }) {
  const id = `${roomId}_${uid}`
  await pb.collection('restrict').delete(id).catch(() => {})
  return pb.collection('restrict').create({ id, room: roomId, uid, type, name: (name || '').slice(0, 30), until: new Date(Date.now() + hours * 3600e3).toISOString() })
}
export const liftRestriction = (roomId, uid) => pb.collection('restrict').delete(`${roomId}_${uid}`)
export const deleteRoomMessage = (roomId, msgId) => pb.collection('messages').delete(msgId)

// ===== الحظر من التطبيق كله (الأدمن بس) =====
export function useMyBan(uid) {
  const [ban, setBan] = useState(null)
  useEffect(() => {
    if (!uid) return
    pb.collection('bans').getOne(uid).then(setBan).catch(() => setBan(null))
    return live('bans', uid, (ev) => setBan(ev.action === 'delete' ? null : ev.record))
  }, [uid])
  return ban
}
export const appBan = (uid, name, reason) => pb.collection('bans').create({ id: uid, name: (name || '').slice(0, 30), reason: (reason || '').slice(0, 200) })
export const appUnban = (uid) => pb.collection('bans').delete(uid)

export function useAdminList(name) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (name === 'bans') {
      const load = () => pb.collection('bans').getList(1, 200, { sort: '-created' })
        .then((r) => setList(r.items.map((x) => ({ ...x, when: toDate(x.created) })))).catch(() => setList([]))
      load()
      return live('bans', '*', load)
    }
    return onSnapshot(query(collection(db, name), orderBy('createdAt', 'desc'), limit(200)),
      (s) => setList(s.docs.map((d) => { const x = d.data(); return { id: d.id, ...x, when: x.createdAt?.toDate?.() || new Date() } })),
      () => setList([]))
  }, [name])
  return list
}
export const deleteReport = (id) => deleteDoc(doc(db, 'reports', id))
