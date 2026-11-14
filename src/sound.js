// أصوات الشات (معمولة بالكود، من غير ملفات)
// الآيفون مش بيسمح بالصوت غير بعد أول لمسة، فبنفتح الصوت مع أول لمسة في التطبيق
import { isIOS } from './browser.js'

let ctx
// وإحنا بنسجّل فويس مانشغّلش أي صوت (علشان المايك والسماعة مايتخانقوش)
let busy = false
export const setAudioBusy = (b) => { busy = b }
function getCtx() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  } catch { return null }
}
function unlock() {
  const c = getCtx()
  if (!c) return
  try {
    const b = c.createBuffer(1, 1, 22050)
    const s = c.createBufferSource()
    s.buffer = b; s.connect(c.destination); s.start(0)
  } catch {}
  if (c.state === 'running') ['touchend', 'pointerdown', 'keydown'].forEach((e) => window.removeEventListener(e, unlock, true))
}
// الآيفون بس محتاج الفتح ده؛ باقي الموبايلات بنعمل الصوت وقت ما نحتاجه
if (typeof window !== 'undefined' && isIOS()) ['touchend', 'pointerdown', 'keydown'].forEach((e) => window.addEventListener(e, unlock, true))

// نغمة: كل نوتة [تردد، بداية، مدة]
function play(notes, { type = 'sine', vol = 0.16 } = {}) {
  if (busy || document.visibilityState === 'hidden') return
  const c = getCtx()
  if (!c) return
  if (c.state !== 'running') {
    c.resume().then(() => c.state === 'running' && !busy && tones(c, notes, type, vol)).catch(() => {})
    return
  }
  tones(c, notes, type, vol)
}
function tones(c, notes, type, vol) {
  const t0 = c.currentTime + 0.01
  for (const [f, at, d] of notes) {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(f, t0 + at)
    g.gain.setValueAtTime(0.0001, t0 + at)
    g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + d)
    o.connect(g).connect(c.destination)
    o.start(t0 + at)
    o.stop(t0 + at + d + 0.02)
  }
}

// رسالة خاص: "تن-تن"
export const playMessage = () => play([[880, 0, 0.18], [1175, 0.13, 0.28]])
// حد دخل الغرفة: نغمة طالعة هادية
export const playJoin = () => play([[523, 0, 0.22], [659, 0.1, 0.22], [784, 0.2, 0.35]], { type: 'triangle', vol: 0.13 })
// إشعار عام
export const playNotif = () => play([[880, 0, 0.14], [660, 0.12, 0.2]])

// الإعداد بيتقري وقت الصوت علشان لو اتغيّر من الإعدادات يتطبق على طول
export function soundOn(key) {
  try { return JSON.parse(localStorage.getItem('kemet-settings') || '{}').on?.[key] !== false } catch { return true }
}

// لودو
export const playDice = () => play([[300, 0, 0.05], [420, 0.06, 0.05], [350, 0.12, 0.05], [520, 0.18, 0.08]], { type: 'square', vol: 0.05 })
export const playStep = () => play([[660, 0, 0.09]], { type: 'triangle', vol: 0.12 })
export const playTurn = () => play([[784, 0, 0.15], [988, 0.12, 0.25]], { vol: 0.14 })
export const playWin = () => play([[523, 0, 0.18], [659, 0.15, 0.18], [784, 0.3, 0.18], [1047, 0.45, 0.5]], { type: 'triangle', vol: 0.16 })
