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

const PROFILE_KEY = 'kemet-profile'
const SETTINGS_KEY = 'kemet-settings'

export const emptyProfile = { name: '', gender: 'male', bio: '', city: '', age: '' }
export const loadProfile = () => read(PROFILE_KEY, emptyProfile)
export const saveProfile = (p) => write(PROFILE_KEY, p)
export const isLoggedIn = () => !!loadProfile().name
export function logout() {
  try { localStorage.removeItem(PROFILE_KEY) } catch {}
}

export const defaultSettings = {
  dark: false,
  lang: 'ar',
  dmWho: 'rooms',
  blocked: ['كريم', 'هاني'],
  on: { dms: true, mentions: true, rooms: false, sound: true, online: true, receipts: true },
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
