// 🎉 الأدمن: بانرات المناسبات اللي بتلف فوق صفحة الغرف
import { useState } from 'react'
import { useBanners, saveBanners, BANNER_COLORS } from '../party.js'

const LINKS = [['', 'من غير لينك'], ['/honor', '🏆 لوحة الشرف'], ['/square', '🏛 الميدان'], ['/live', '🔴 اللايف'], ['/voice/kings', '👑 الغرفة الصوتية'], ['/games', '🎲 الألعاب والمحفظة'], ['/tribes', '🏺 القبائل']]
const EMPTY = { title: '', sub: '', e: '🎉', color: 'gold', link: '', days: 7 }

export default function BannersAdmin({ showToast }) {
  const { list, setList } = useBanners(true)
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const save = (next, ok) => {
    setBusy(true)
    saveBanners(next).then((r) => { setList(r); showToast(ok) }).catch((e) => showToast(e?.response?.message || 'حصلت مشكلة')).finally(() => setBusy(false))
  }
  const add = () => {
    if (!f.title.trim()) return showToast('اكتب العنوان')
    const b = { id: String(Date.now()), title: f.title, sub: f.sub, e: f.e, color: f.color, link: f.link, until: f.days ? Date.now() + f.days * 86400000 : 0 }
    save([b, ...(list || [])], '✅ البانر نزل فوق الغرف')
    setF(EMPTY)
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <>
      <div className="card admin-card bn-form">
        <b>🎉 بانر جديد</b>
        <small className="row-sub">بيظهر لكل الناس فوق صفحة الغرف ويلف لوحده. استخدمه للمناسبات والمسابقات والعروض.</small>
        <div className={`bnr bnr-${f.color}`}><span className="bnr-e">{f.e || '🎉'}</span><span className="bnr-t"><b>{f.title || 'العنوان'}</b><small>{f.sub || 'الكلام اللي تحت العنوان'}</small></span>{f.link && <span className="bnr-go">›</span>}</div>
        <div className="bn-row"><input className="input bn-e" maxLength={8} value={f.e} onChange={set('e')} aria-label="إيموجي" /><input className="input" maxLength={40} placeholder="العنوان (مثلًا: 🎉 مهرجان الشتا)" value={f.title} onChange={set('title')} /></div>
        <input className="input" maxLength={90} placeholder="تحت العنوان (مثلًا: أكتر ٣ يبعتوا هدايا ياخدوا VIP)" value={f.sub} onChange={set('sub')} />
        <div className="bn-row">
          <select className="input" value={f.color} onChange={set('color')}>{Object.entries(BANNER_COLORS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select className="input" value={f.link} onChange={set('link')}>{LINKS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
        <label className="bn-days">يفضل ظاهر <input className="input" type="number" min="0" max="90" value={f.days} onChange={(e) => setF({ ...f, days: Math.max(0, parseInt(e.target.value, 10) || 0) })} /> يوم <small>(٠ = على طول)</small></label>
        <button type="button" className="btn-primary" disabled={busy} onClick={add}>نزّل البانر</button>
      </div>
      {list === null && <p className="empty">بيحمّل...</p>}
      {list?.length === 0 && <p className="empty">مفيش بانرات منك لسه (لوحة الشرف وتحدي الميدان بيظهروا لوحدهم)</p>}
      {list?.map((b) => (
        <div key={b.id} className="card admin-card">
          <div className={`bnr bnr-${b.color}`}><span className="bnr-e">{b.e || '🎉'}</span><span className="bnr-t"><b>{b.title}</b>{b.sub && <small>{b.sub}</small>}</span></div>
          <div className="mod-tools">
            <span className="row-sub">{b.until ? (b.until > Date.now() ? `لحد ${new Date(b.until).toLocaleDateString('ar-EG')}` : '⏰ خلص') : 'على طول'}{b.link ? ` · ${b.link}` : ''}</span>
            <button type="button" className="pill-btn pill-danger" disabled={busy} onClick={() => save(list.filter((x) => x.id !== b.id), 'اتشال البانر')}>شيله</button>
          </div>
        </div>
      ))}
    </>
  )
}
