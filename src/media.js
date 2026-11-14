// الصور والفويس — بيتحفظوا كـ base64 جوه Firestore (مجاني، من غير Storage)
import { useEffect, useRef, useState } from 'react'
import { collection, doc, addDoc, getDoc, getDocFromCache, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'
import { setAudioBusy } from './sound.js'

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
    const ref = doc(db, ...path.split('/'))
    // الأول من الكاش اللي على الموبايل (أسرع)، ولو مش موجود من السيرفر
    getDocFromCache(ref).catch(() => getDoc(ref)).then((s) => {
      const v = s.exists() ? { mime: s.data().mime, src: `data:${s.data().mime};base64,${s.data().data}` } : { error: true }
      if (!v.error) cache.set(path, v)
      if (alive) setState(v)
    }).catch(() => alive && setState({ error: true }))
    return () => { alive = false }
  }, [path, enabled])
  return state
}

// ===== تسجيل الفويس =====
// بنسجّل الصوت خام ونحوّله MP3 على الموبايل نفسه
// MP3 بيشتغل على كل الموبايلات والمتصفحات (آيفون وأندرويد وكمبيوتر)
// ومن غير MediaRecorder اللي كان بيوقّع كروم على بعض موبايلات أندرويد
const MP3_RATE = 16000
const MP3_KBPS = 32

function downsample(chunks, inRate, outRate) {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const ratio = inRate / outRate
  const outLen = Math.floor(total / ratio)
  const out = new Int16Array(outLen)
  // نجمع الحتت في مصفوفة واحدة
  const all = new Float32Array(total)
  let off = 0
  for (const c of chunks) { all.set(c, off); off += c.length }
  for (let i = 0; i < outLen; i++) {
    // متوسط العينات (فلتر بسيط علشان الصوت يبقى نضيف)
    const start = Math.floor(i * ratio)
    const end = Math.min(total, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let k = start; k < end; k++) sum += all[k]
    const v = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)))
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff
  }
  return out
}

async function encodeMp3(chunks, inRate) {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const pcm = downsample(chunks, inRate, MP3_RATE)
  const enc = new Mp3Encoder(1, MP3_RATE, MP3_KBPS)
  const parts = []
  for (let i = 0; i < pcm.length; i += 1152) {
    const buf = enc.encodeBuffer(pcm.subarray(i, i + 1152))
    if (buf.length) parts.push(new Uint8Array(buf))
  }
  const end = enc.flush()
  if (end.length) parts.push(new Uint8Array(end))
  return new Blob(parts, { type: 'audio/mpeg' })
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
    try { r.proc.disconnect(); r.src.disconnect() } catch {}
    r.stream?.getTracks().forEach((t) => t.stop())
    r.ctx.close().catch(() => {})
    rec.current = null
    setAudioBusy(false)
  }

  async function start() {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!navigator.mediaDevices?.getUserMedia || !AC) {
      onError('الموبايل ده مش بيدعم تسجيل الصوت من المتصفح')
      return
    }
    setAudioBusy(true)
    import('@breezystack/lamejs').catch(() => {}) // نجهّز المحوّل من بدري
    // لازم يتعمل مع اللمسة نفسها علشان الآيفون
    let ctx
    try { ctx = new AC() } catch { setAudioBusy(false); onError('مقدرناش نشغّل المايك'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
      const src = ctx.createMediaStreamSource(stream)
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      const chunks = []
      proc.onaudioprocess = (e) => { if (rec.current) chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))) }
      // لازم يوصل للسماعة علشان يشتغل، بس بصوت صفر
      const mute = ctx.createGain()
      mute.gain.value = 0
      src.connect(proc); proc.connect(mute); mute.connect(ctx.destination)
      rec.current = { ctx, stream, src, proc, chunks, startedAt: Date.now() }
      setSec(0)
      setRecording(true)
    } catch (e) {
      ctx.close().catch(() => {})
      setAudioBusy(false)
      onError(e?.name === 'NotAllowedError'
        ? 'لازم تسمح للشات يستخدم المايك من إعدادات المتصفح'
        : 'مقدرناش نشغّل المايك')
    }
  }

  async function stop(send) {
    const r = rec.current
    setRecording(false)
    if (!r) return
    const { chunks, startedAt } = r
    const rate = r.ctx.sampleRate
    cleanup()
    if (!send) return
    if (!chunks.length) return onError('التسجيل فاضي، جرب تاني')
    const dur = Math.max(1, Math.min(MAX_VOICE_SEC, Math.round((Date.now() - startedAt) / 1000)))
    try {
      const blob = await encodeMp3(chunks, rate)
      const data = await blobToBase64(blob)
      if (data.length > MAX_CHARS) return onError('الرسالة الصوتية كبيرة، سجّل رسالة أقصر')
      onDone({ data, mime: 'audio/mpeg', dur })
    } catch {
      onError('حصلت مشكلة في التسجيل، جرب تاني')
    }
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
