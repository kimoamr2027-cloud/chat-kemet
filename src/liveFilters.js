// ✨ فلاتر الوش للايف: الصورة بتتعدّل على الموبايل نفسه (Canvas) قبل ما تتبث، فالمتفرجين بيشوفوها زي المضيف بالظبط
// التنعيم: نسخة صغيرة من الصورة بتتكبّر فوق الأصلية بشفافية (بيعمل نعومة للبشرة من غير ما يتقل على الموبايل)

export const FILTERS = [
  { id: 'none', e: '🙂', name: 'طبيعي' },
  { id: 'smooth', e: '✨', name: 'تنعيم' },
  { id: 'bright', e: '☀️', name: 'تفتيح' },
  { id: 'rose', e: '🌸', name: 'وردي' },
  { id: 'gold', e: '🏺', name: 'فرعوني' },
  { id: 'cool', e: '❄️', name: 'ساقع' },
  { id: 'bw', e: '🎞', name: 'أبيض وأسود' },
]
const KEY = 'kemet-live-filter'
export const savedFilter = () => { try { return localStorage.getItem(KEY) || 'smooth' } catch { return 'smooth' } }
export const saveFilter = (id) => { try { localStorage.setItem(KEY, id) } catch { /* مش مهم */ } }

// المتصفح بيدعم ctx.filter؟ (كروم أندرويد آه، وبعض نسخ سفاري لأ — ساعتها بنستخدم الألوان والتنعيم من غيره)
let filterOk = null
function canFilter() {
  if (filterOk !== null) return filterOk
  try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(1px)'; filterOk = c.filter === 'blur(1px)' } catch { filterOk = false }
  return filterOk
}

const CSS = {
  smooth: 'brightness(1.08)',
  bright: 'brightness(1.22) contrast(1.04) saturate(1.1)',
  rose: 'brightness(1.1) saturate(1.2) hue-rotate(-8deg)',
  gold: 'sepia(0.35) saturate(1.35) brightness(1.06) contrast(1.05)',
  cool: 'brightness(1.06) saturate(0.9) contrast(1.06) hue-rotate(10deg)',
  bw: 'grayscale(1) contrast(1.12) brightness(1.04)',
}
const TINT = { rose: 'rgba(255, 120, 165, 0.26)', gold: 'rgba(230, 170, 60, 0.16)', cool: 'rgba(80, 140, 255, 0.24)' }
const SOFT = { smooth: 0.42, bright: 0.25, rose: 0.3, gold: 0.2, cool: 0.2, bw: 0 }

// Processor بالشكل اللي LiveKit مستنيه (setProcessor)
export function makeFilterProcessor(initial) {
  let mode = initial
  let video = null
  let canvas = null
  let ctx = null
  let small = null
  let sctx = null
  let timer = null
  let out = null
  // بنرسم مع كل فريم جديد من الكاميرا (requestVideoFrameCallback) بدل تايمر — أخف على الموبايل ومن غير فريمات ضايعة
  // وبحد أقصى ٢٤ فريم في الثانية، والصورة مش أكبر من ٥٤٠×٩٦٠
  let last = 0
  let gen = 0
  const schedule = (g) => {
    if (video && video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => draw(g))
    else timer = setTimeout(() => draw(g), 1000 / 24)
  }
  const draw = (g) => {
    if (!video || g !== gen) return
    schedule(g)
    const now = performance.now()
    if (now - last < 1000 / 25) return
    last = now
    if (video.readyState < 2) return
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return
    const k = Math.min(1, 960 / Math.max(vw, vh))
    const w = Math.round(vw * k)
    const h = Math.round(vh * k)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h
      small.width = Math.max(1, Math.round(w / 6)); small.height = Math.max(1, Math.round(h / 6))
    }
    const f = canFilter()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.filter = f ? (CSS[mode] || 'none') : 'none'
    ctx.drawImage(video, 0, 0, w, h)
    // التنعيم: الصورة الصغيرة متكبّرة = ناعمة
    const soft = SOFT[mode] || 0
    if (soft) {
      sctx.drawImage(video, 0, 0, small.width, small.height)
      // الطبقة الناعمة من غير filter تاني (الـ filter مرتين كان بيقلّل الفريمات للنص)
      ctx.filter = 'none'
      ctx.globalAlpha = soft
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(small, 0, 0, w, h)
      ctx.globalAlpha = 1
    }
    ctx.filter = 'none'
    if (TINT[mode]) {
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = TINT[mode]
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
    }
    // من غير ctx.filter: الأبيض والأسود بالـ composite
    if (!f && mode === 'bw') {
      ctx.globalCompositeOperation = 'saturation'
      ctx.fillStyle = '#808080'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
    }
  }
  const start = (opts) => {
    video = opts.element
    canvas = document.createElement('canvas')
    canvas.width = 540; canvas.height = 960
    ctx = canvas.getContext('2d', { alpha: false })
    small = document.createElement('canvas')
    sctx = small.getContext('2d', { alpha: false })
    out = canvas.captureStream(24).getVideoTracks()[0]
    proc.processedTrack = out
    // أول مرة: نستنى الكاميرا تشتغل (الـ callback مابيشتغلش قبل ما الفيديو يبدأ)
    const g = ++gen
    const kick = () => { if (!video || g !== gen) return; if (video.readyState >= 2) draw(g); else timer = setTimeout(kick, 100) }
    kick()
  }
  const stop = () => { gen++; clearTimeout(timer); timer = null; video = null; try { out?.stop() } catch { /* خلاص */ } }
  const proc = {
    name: 'kemet-face-filter',
    processedTrack: undefined,
    init: async (opts) => start(opts),
    restart: async (opts) => { stop(); start(opts) },
    destroy: async () => stop(),
    setMode: (m) => { mode = m },
  }
  return proc
}
