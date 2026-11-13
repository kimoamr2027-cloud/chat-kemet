import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Back, Dots, Lock, Bell, Block, Flag } from '../components/Icons.jsx'
import { Avatar, Radio, Sheet, useToast } from '../components/ui.jsx'
import { useChat, MessageList, Composer } from '../components/Chat.jsx'
import { chats, dmMessages } from '../data.js'

const REASONS = ['إزعاج أو رسائل كتير', 'كلام أو صور مش لائقة', 'تحرش أو تهديد', 'حساب مزيف أو نصب', 'حاجة تانية']

export default function DM() {
  const { id } = useParams()
  const person = chats.find((c) => c.id === id)
  const name = person?.name || ''
  const [blocked, setBlocked] = useState(false)
  const [muted, setMuted] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [reason, setReason] = useState(null)
  const [toast, showToast] = useToast()
  const chat = useChat({
    initial: dmMessages(name).map((m) => (m.me ? m : { ...m, who: name })),
    replier: name, replies: ['هههه تمام', 'ماشي، اتفقنا', 'حلو أوي!', 'تمام يا باشا'], dm: true, blocked,
  })

  if (!person) return <Navigate to="/messages" replace />

  const subtitle = blocked ? 'محظور' : chat.typing ? 'بيكتب الآن...' : person.online ? 'متصل الآن' : 'مش متصل'

  return (
    <main className="screen chat-screen">
      <header className="head head-row chat-head">
        <Link to="/messages" aria-label="رجوع" className="icon-btn"><Back /></Link>
        <div className="avatar-wrap">
          <Avatar text={name.charAt(0)} c={chats.indexOf(person)} size={44} round />
          {!blocked && person.online && <span className="online-dot small" aria-hidden="true" />}
        </div>
        <div className="head-titles">
          <span className="head-name">{name}</span>
          <span className={blocked || (!person.online && !chat.typing) ? 'head-status muted' : 'head-status'}>{subtitle}</span>
        </div>
        <button type="button" className="icon-btn" aria-label="خيارات" onClick={() => { setSheet('menu'); chat.clearSel() }}><Dots /></button>
      </header>

      <div className="private-note"><Lock />محادثة خاصة بينك وبين {name} بس</div>

      <MessageList chat={chat} />

      {blocked ? (
        <div className="blocked-bar">
          <span>انت حظرت {name}. مش هيقدر يبعتلك رسائل ولا يشوف إنك متصل.</span>
          <button type="button" className="pill-btn pill-lg" onClick={() => { setBlocked(false); showToast('اتلغى الحظر') }}>إلغاء الحظر</button>
        </div>
      ) : (
        <Composer chat={chat} onImage={() => showToast('إرسال الصور هيشتغل مع Firebase')} />
      )}

      {sheet === 'menu' && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="grabber" aria-hidden="true" />
          <button type="button" className="menu-item" onClick={() => {
            setMuted(!muted); setSheet(null)
            showToast(!muted ? `اتكتمت إشعارات ${name}` : 'الإشعارات رجعت')
          }}><Bell size={22} />{muted ? 'رجّع الإشعارات' : 'كتم الإشعارات'}</button>
          <button type="button" className="menu-item danger" onClick={() => setSheet('block')}><Block />حظر {name}</button>
          <button type="button" className="menu-item danger" onClick={() => { setReason(null); setSheet('report') }}><Flag />إبلاغ عن {name}</button>
        </Sheet>
      )}

      {sheet === 'block' && (
        <Sheet onClose={() => setSheet(null)} className="sheet-center">
          <h2 className="sheet-title">حظر {name}؟</h2>
          <p className="sheet-text">مش هيقدر يبعتلك رسائل خاصة ولا يشوف إنك متصل. {name} مش هيعرف إنك حظرته.</p>
          <button type="button" className="btn-danger" onClick={() => { setBlocked(true); setSheet(null); showToast(`اتحظر ${name}`) }}>حظر</button>
          <button type="button" className="btn-outline" onClick={() => setSheet(null)}>إلغاء</button>
        </Sheet>
      )}

      {sheet === 'report' && (
        <Sheet onClose={() => setSheet(null)}>
          <h2 className="sheet-title">إبلاغ عن {name}</h2>
          <p className="sheet-sub">إيه المشكلة؟ البلاغ سري ومحدش هيعرف إنك اللي بلّغت.</p>
          <div role="radiogroup" aria-label="سبب البلاغ" className="radio-list">
            {REASONS.map((label, i) => (
              <button key={i} type="button" role="radio" aria-checked={reason === i}
                className={`choice choice-start ${reason === i ? 'choice-on' : ''}`} onClick={() => setReason(i)}>
                <Radio on={reason === i} />{label}
              </button>
            ))}
          </div>
          <button type="button" className={`btn-danger ${reason === null ? 'disabled' : ''}`} onClick={() => {
            if (reason === null) return
            setSheet(null); showToast('وصلنا بلاغك، وفريق كيمت هيراجعه')
          }}>إرسال البلاغ</button>
        </Sheet>
      )}
      {toast}
    </main>
  )
}
