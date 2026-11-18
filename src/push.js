// إشعارات الموبايل (Web Push): بتوصل حتى والتطبيق مقفول
// أندرويد (Chrome وتطبيق APK) والكمبيوتر، والآيفون لو الشات متضاف للشاشة الرئيسية (iOS 16.4+)
import { useEffect, useState } from 'react'
import { pb } from './pb/client.js'
import { isIOS, isStandalone } from './browser.js'

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
// الآيفون محتاج الشات يبقى متضاف للشاشة الرئيسية الأول
export const needsHomeScreen = () => isIOS() && !isStandalone()

const b64ToBytes = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
const reg = () => navigator.serviceWorker.getRegistration().then((r) => r || navigator.serviceWorker.ready)

// الحالة: 'unsupported' | 'ios-home' | 'denied' | 'on' | 'off'
export async function pushStatus() {
  if (needsHomeScreen()) return 'ios-home'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const r = await reg()
    const sub = r && (await r.pushManager.getSubscription())
    return sub && Notification.permission === 'granted' ? 'on' : 'off'
  } catch { return 'off' }
}

export async function enablePush(uid) {
  if (!pushSupported()) throw new Error('unsupported')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'denied' : 'dismissed')
  const { key } = await pb.send('/api/kemet/push/key', { method: 'GET' })
  const r = await reg()
  let sub = await r.pushManager.getSubscription()
  if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) })
  const j = sub.toJSON()
  await pb.collection('pushsubs').create({ owner: uid, endpoint: j.endpoint, keys: j.keys, ua: navigator.userAgent.slice(0, 200) })
  return 'on'
}

export async function disablePush() {
  const r = await reg()
  const sub = r && (await r.pushManager.getSubscription())
  if (!sub) return 'off'
  try {
    const list = await pb.collection('pushsubs').getFullList({ filter: `endpoint='${sub.endpoint.replace(/'/g, '')}'` })
    await Promise.all(list.map((x) => pb.collection('pushsubs').delete(x.id)))
  } catch {}
  await sub.unsubscribe().catch(() => {})
  return 'off'
}

export function usePushStatus() {
  const [st, setSt] = useState(null)
  useEffect(() => { pushStatus().then(setSt) }, [])
  return [st, setSt]
}
