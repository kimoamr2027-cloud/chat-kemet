// تخزين على الجهاز لحد ما نربط Firebase
import { useEffect, useState } from 'react'

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? { ...fallback, ...JSON.parse(v) } : fallback
  } catch {
    return fallback
  }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}

const SETTINGS_KEY = 'kemet-settings'

// صورة البروفايل وصوري بيتحفظوا على الجهاز لحد ما نعمل رفع الصور
export const loadLocalPhotos = (uid) => read('kemet-photos-' + uid, { avatar: '', photos: [] })
export const saveLocalPhotos = (uid, v) => write('kemet-photos-' + uid, v)

export const defaultSettings = {
  dark: false,
  lang: 'ar',
  on: { dms: true, mentions: true, rooms: false, sound: true, joins: true },
}

export function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#221D17' : '#FFFFFF')
}

export function useSettings() {
  const [s, setS] = useState(() => read(SETTINGS_KEY, defaultSettings))
  useEffect(() => { write(SETTINGS_KEY, s); applyTheme(s.dark) }, [s])
  return [s, (patch) => setS((prev) => ({ ...prev, ...patch }))]
}
