import { useEffect, useState } from 'react'

// بيشيّك لو في نسخة جديدة من التطبيق اتنشرت، ويطلّع شريط تحديث
function currentScript() {
  const el = document.querySelector('script[type="module"][src*="assets/index-"]')
  return el ? new URL(el.src).pathname.split('/').pop() : null
}

export default function UpdateBar() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    const mine = currentScript()
    if (!mine) return
    let stop = false
    async function check() {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}index.html?v=${Date.now()}`, { cache: 'no-store' })
        const html = await res.text()
        const latest = (html.match(/assets\/(index-[^"']+\.js)/) || [])[1]
        if (!stop && latest && latest !== mine) setReady(true)
      } catch {}
    }
    check()
    const t = setInterval(check, 5 * 60 * 1000)
    const onVis = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  if (!ready) return null
  return (
    <button type="button" className="update-bar" onClick={() => window.location.reload()}>
      في تحديث جديد للتطبيق — دوس هنا
    </button>
  )
}
