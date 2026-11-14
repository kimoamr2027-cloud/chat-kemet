import { useRef, useState } from 'react'
import { compressImage } from '../media.js'
import { setRoomPhoto } from '../rooms.js'

// زرار تغيير صورة الغرفة (بيصغّر الصورة ويضغطها قبل الحفظ)
export default function RoomPhotoButton({ room, showToast, className = 'pill-btn' }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)

  async function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const { dataUrl } = await compressImage(f, 320, 85000)
      await setRoomPhoto(room.id, dataUrl)
      showToast('🖼 صورة الغرفة اتغيّرت')
    } catch {
      showToast('مقدرناش نغيّر الصورة، جرب صورة تانية')
    }
    setBusy(false)
  }

  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'بترفع...' : room.photo ? '🖼 غيّر صورة الغرفة' : '🖼 حط صورة للغرفة'}
      </button>
      {room.photo && !busy && (
        <button type="button" className="pill-btn" onClick={() => setRoomPhoto(room.id, '').then(() => showToast('اتشالت صورة الغرفة')).catch(() => showToast('حصلت مشكلة'))}>
          شيل الصورة
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="file-hidden" aria-hidden="true" tabIndex={-1} onChange={pick} />
    </>
  )
}
