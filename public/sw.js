// Service worker: بيخلي التطبيق يفتح بسرعة ويشتغل لو النت ضعيف
const CACHE = 'kemet-v11'
const FONTS = 'kemet-fonts-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png'])))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

function fromNetwork(req, cacheName, timeoutMs) {
  return new Promise((resolve, reject) => {
    let done = false
    const t = timeoutMs && setTimeout(() => {
      caches.match(req).then((r) => { if (r && !done) { done = true; resolve(r) } })
    }, timeoutMs)
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(cacheName).then((c) => c.put(req, copy)) }
      if (!done) { done = true; clearTimeout(t); resolve(res) }
    }).catch(() => {
      clearTimeout(t)
      caches.match(req).then((r) => (r ? resolve(r) : caches.match('./index.html').then((i) => (i ? resolve(i) : reject(new Error('offline'))))))
    })
  })
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // الخطوط: من الكاش على طول، وبتتحدّث في الخلفية
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res }).catch(() => hit)
      return hit || net
    })))
    return
  }
  if (url.origin !== location.origin) return

  // ملفات التطبيق (أساميها فيها بصمة وماتتغيرش): من الكاش على طول
  if (url.pathname.includes('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fromNetwork(req, CACHE)))
    return
  }
  // الصفحة نفسها: من الكاش على طول (فتح فوري)، وبنجيب الجديدة في الخلفية
  // ولو فيه نسخة جديدة، شريط "في تحديث جديد" بيظهر
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((hit) => {
      const net = fromNetwork(req, CACHE)
      if (hit) { e.waitUntil(net.then((res) => { if (res.ok) return caches.open(CACHE).then((c) => c.put('./index.html', res.clone())) }).catch(() => {})); return hit }
      return net
    }))
    return
  }
  e.respondWith(fromNetwork(req, CACHE, 0))
})
