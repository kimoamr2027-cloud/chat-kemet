// 🏛 الميدان: بوستات الأعضاء (على سيرفر PocketBase)
import { useCallback, useEffect, useRef, useState } from 'react'
import { pb, toDate } from './pb/client.js'
import { compressImage } from './media.js'

const PER = 12

export const postImg = (p, full) => (p.image ? pb.files.getURL({ id: p.id, collectionId: p.collectionId, collectionName: 'posts' }, p.image, full ? {} : { thumb: '480x0' }) : '')
export const shareUrl = (id) => `https://chatkemet.pages.dev/#/p/${id}`
const fix = (p) => ({ ...p, at: toDate(p.created) })

async function likedOf(ids) {
  if (!ids.length) return {}
  const r = await pb.collection('postlikes').getFullList({ filter: ids.map((id) => `post='${id}'`).join('||'), fields: 'post', requestKey: null })
  return Object.fromEntries(r.map((x) => [x.post, true]))
}

// الفيد: kind = 'new' (الأحدث) أو 'challenge' (تحدي الأسبوع، الأكتر لايكات) أو 'user' (بوستات عضو)
export function useFeed(kind, key) {
  const [items, setItems] = useState(null)
  const [more, setMore] = useState(false)
  const page = useRef(1)
  const busy = useRef(false)
  const opts = useCallback(() => (kind === 'challenge' ? { filter: `tag='${key}'`, sort: '-likes,created' }
    : kind === 'user' ? { filter: `uid='${key}'`, sort: '-created' } : { sort: '-created' }), [kind, key])
  const load = useCallback(async (reset) => {
    if (busy.current || (kind !== 'new' && !key)) return
    busy.current = true
    try {
      const p = reset ? 1 : page.current + 1
      const r = await pb.collection('posts').getList(p, PER, { ...opts(), requestKey: null })
      const liked = await likedOf(r.items.map((x) => x.id)).catch(() => ({}))
      const list = r.items.map((x) => fix({ ...x, liked: !!liked[x.id] }))
      page.current = p
      setItems((old) => (reset || !old ? list : [...old, ...list.filter((x) => !old.some((o) => o.id === x.id))]))
      setMore(r.page < r.totalPages)
    } catch { if (reset) setItems([]) }
    busy.current = false
  }, [kind, key, opts])
  useEffect(() => { setItems(null); load(true) }, [load])
  const patch = (id, ch) => setItems((l) => l && l.map((p) => (p.id === id ? { ...p, ...ch } : p)))
  const drop = (id) => setItems((l) => l && l.filter((p) => p.id !== id))
  const add = (p) => setItems((l) => [fix(p), ...(l || [])])
  return { items, more, loadMore: () => load(false), reload: () => load(true), patch, drop, add }
}

export function useChallenge() {
  const [c, setC] = useState(null)
  const load = useCallback(() => pb.send('/api/kemet/square/challenge', { requestKey: null }).then(setC).catch(() => {}), [])
  useEffect(() => { load() }, [load])
  return { c, reload: load }
}

export async function getPost(id) { return fix(await pb.send(`/api/kemet/square/get?id=${encodeURIComponent(id)}`, { requestKey: null })) }

export async function createPost({ text, file, challenge }) {
  const fd = new FormData()
  fd.append('text', text || '')
  if (file) {
    const img = await compressImage(file, 1280)
    const bin = Uint8Array.from(atob(img.base64), (c) => c.charCodeAt(0))
    fd.append('image', new Blob([bin], { type: 'image/jpeg' }), 'post.jpg')
    fd.append('w', String(img.w)); fd.append('h', String(img.h))
  }
  if (challenge) fd.append('tag', challenge)
  return pb.collection('posts').create(fd, { requestKey: null })
}

export const likePost = (id) => pb.send('/api/kemet/square/like', { method: 'POST', body: { id }, requestKey: null })
export const deletePost = (id) => pb.send('/api/kemet/square/delete', { method: 'POST', body: { id } })
export const reportPost = (id) => pb.send('/api/kemet/square/report', { method: 'POST', body: { id } })
export const restorePost = (id) => pb.send('/api/kemet/square/restore', { method: 'POST', body: { id } })
export const addComment = (id, text) => pb.send('/api/kemet/square/comment', { method: 'POST', body: { id, text } })
export const delComment = (id) => pb.send('/api/kemet/square/uncomment', { method: 'POST', body: { id } })

export function useComments(post) {
  const [list, setList] = useState(null)
  const load = useCallback(() => {
    if (!post) return
    pb.collection('postcomments').getList(1, 200, { filter: `post='${post}'`, sort: 'created', requestKey: null })
      .then((r) => setList(r.items.map(fix))).catch(() => setList([]))
  }, [post])
  useEffect(() => { load() }, [load])
  return { list, setList, reload: load }
}
