// الصور والفويس — بيتحفظوا كـ base64 جوه Firestore (مجاني، من غير Storage)
import { useEffect, useRef, useState } from 'react'
import { collection, doc, addDoc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'

export const MAX_VOICE_SEC = 60
const MAX_CHARS = 900000 // أقل من حد المستند في Firestore (١ ميجا)

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')) }
    img.src = url
  })
}

// تصغير وضغط الصورة لحد ما تبقى أصغر من الحد المسموح
export async function compressImage(file, maxSide = 1280, maxChars = MAX_CHARS) {
  const img = await loadImage(file)
  let side = maxSide
  for (let i = 0; i < 6; i++) {
    const k = Math.min(1, side / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * k))
    const h = Math.max(1, Math.round(img.height * k))
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    for (const q of [0.8, 0.7, 0.6]) {
      const dataUrl = c.toDataURL('image/jpeg', q)
      if (dataUrl.length <= maxChars) return { dataUrl, base64: dataUrl.split(',')[1], w, h }
    }
    side = Math.round(side * 0.75)
  }
  throw new Error('image too big')
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// رفع ملف: base = 'rooms/{id}/media' أو 'chats/{id}/media'
export async function uploadMedia(base, uid, type, mime, data) {
  const ref = await addDoc(collection(db, ...base.split('/')), { uid, type, mime, data, createdAt: serverTimestamp() })
  return ref.id
}

// تحميل ملف (مع كاش في الذاكرة)
const cache = new Map()
export function useMediaData(path, enabled = true) {
  const [state, setState] = useState(() => cache.get(path) || null)
  useEffect(() => {
    if (!path || !enabled || cache.has(path)) { if (cache.has(path)) setState(cache.get(path)); return }
    let alive = true
    getDoc(doc(db, ...path.split('/'))).then((s) => {
      const v = s.exists() ? { mime: s.data().mime, src: `data:${s.data().mime};base64,${s.data().data}` } : { error: true }
      if (!v.error) cache.set(path, v)
      if (alive) setState(v)
    }).catch(() => alive && setState({ error: true }))
    return () => { alive = false }
  }, [path, enabled])
  return state
}

// ===== تسجيل الفويس =====
function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null
  const options = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
  return options.find((m) => MediaRecorder.isTypeSupported?.(m)) || ''
}

export function useVoiceRecorder({ onDone, onError }) {
  const [recording, setRecording] = useState(false)
  const [sec, setSec] = useState(0)
  const rec = useRef(null)

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setSec((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [recording])

  // دقيقة بالظبط: بيتبعت لوحده
  useEffect(() => {
    if (recording && sec >= MAX_VOICE_SEC) stop(true)
  }, [sec, recording]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cleanup(), [])

  function cleanup() {
    const r = rec.current
    if (!r) return
    r.stream.getTracks().forEach((t) => t.stop())
    rec.current = null
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || pickMime() === null) {
      onError('الموبايل ده مش بيدعم تسجيل الصوت من المتصفح')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = pickMime()
      const mr = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 })
      const chunks = []
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.current = { mr, stream, chunks, startedAt: Date.now(), send: false }
      mr.onstop = async () => {
        const r = rec.current
        cleanup()
        if (!r?.send) return
        const type = (mr.mimeType || mime || 'audio/mp4').split(';')[0]
        const blob = new Blob(chunks, { type })
        const dur = Math.max(1, Math.min(MAX_VOICE_SEC, Math.round((Date.now() - r.startedAt) / 1000)))
        try {
          const data = await blobToBase64(blob)
          if (data.length > MAX_CHARS) return onError('الرسالة الصوتية كبيرة، سجّل رسالة أقصر')
          onDone({ data, mime: type, dur })
        } catch {
          onError('حصلت مشكلة في التسجيل، جرب تاني')
        }
      }
      mr.start(250)
      setSec(0)
      setRecording(true)
    } catch (e) {
      onError(e?.name === 'NotAllowedError'
        ? 'لازم تسمح للتطبيق يستخدم المايك من إعدادات Safari'
        : 'مقدرناش نشغّل المايك')
    }
  }

  function stop(send) {
    const r = rec.current
    setRecording(false)
    if (!r) return
    r.send = send
    if (r.mr.state !== 'inactive') r.mr.stop()
    else cleanup()
  }

  return { recording, recSec: sec, startRec: start, cancelRec: () => stop(false), sendRec: () => stop(true) }
}

// ===== صوري (٦ بالكتير: 0..5) =====
export function usePhotos(uid) {
  const [photos, setPhotos] = useState(null)
  useEffect(() => {
    if (!uid) return
    return onSnapshot(collection(db, 'users', uid, 'photos'),
      (s) => setPhotos(s.docs.map((d) => ({ id: d.id, src: d.data().data, at: d.data().createdAt?.toMillis?.() || 0 }))
        .sort((a, b) => a.at - b.at)),
      () => setPhotos([]))
  }, [uid])
  return photos
}
export function savePhoto(uid, slot, dataUrl) {
  return setDoc(doc(db, 'users', uid, 'photos', String(slot)), { data: dataUrl, createdAt: serverTimestamp() })
}
export function deletePhoto(uid, slot) {
  return deleteDoc(doc(db, 'users', uid, 'photos', String(slot)))
}
