import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Back, Block, User, Logout } from '../components/Icons.jsx'
import { Radio, Switch, useToast } from '../components/ui.jsx'
import { useSettings } from '../store.js'
import { signOutUser, useAuth, updatePrivacy, unblockUser } from '../auth.jsx'
import { isAdminUid } from '../roles.js'
import { Crown } from '../components/ui.jsx'
import { ar } from '../utils.js'

export default function Settings() {
  const navigate = useNavigate()
  const [s, update] = useSettings()
  const [showBlocked, setShowBlocked] = useState(false)
  const [toast, showToast] = useToast()
  const { user, privacy, roles } = useAuth()
  const flip = (k) => update({ on: { ...s.on, [k]: !s.on[k] } })
  // إعدادات الخصوصية بتتحفظ على السيرفر علشان تتطبق بجد
  const savePrivacy = (patch) => updatePrivacy(user.uid, patch).catch(() => showToast('مقدرناش نحفظ، جرب تاني'))
  const blockedList = Object.entries(privacy.blocked || {}).map(([uid, v]) => ({ uid, name: v?.name || 'عضو' }))

  const rows = (list) => list.map(([k, label, hint]) => (
    <div key={k} className="set-row">
      <span className="set-label">{label}{hint && <small>{hint}</small>}</span>
      <Switch on={s.on[k]} onToggle={() => flip(k)} label={label} />
    </div>
  ))

  return (
    <main className="screen">
      <header className="head head-row">
        <Link to="/profile" aria-label="رجوع" className="icon-btn"><Back /></Link>
        <h1 className="h-mid">الإعدادات</h1>
      </header>

      <div className="scroll settings">
        {isAdminUid(roles, user.uid) && (
          <section>
            <h2>الأدمن</h2>
            <div className="set-card">
              <Link to="/admin" className="set-row set-link"><Crown size={20} />لوحة الأدمن</Link>
            </div>
          </section>
        )}

        <section>
          <h2>المظهر</h2>
          <div className="set-card">
            <div className="set-row">
              <span className="set-label">الوضع الليلي</span>
              <Switch on={s.dark} onToggle={() => update({ dark: !s.dark })} label="الوضع الليلي" />
            </div>
            <div className="set-row">
              <span id="lang-label" className="set-label">اللغة</span>
              <div role="group" aria-labelledby="lang-label" className="segmented">
                {[['ar', 'العربية'], ['en', 'English']].map(([id, label]) => (
                  <button key={id} type="button" aria-pressed={s.lang === id} className={s.lang === id ? 'seg-on' : ''}
                    onClick={() => (id === 'en' ? showToast('الإنجليزي جاي قريب') : update({ lang: id }))}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2>الإشعارات</h2>
          <div className="set-card">
            {[['dms', 'الرسائل الخاصة'], ['mentions', 'الردود والإشارات والتفاعلات']].map(([k, label]) => (
              <div key={k} className="set-row">
                <span className="set-label">{label}</span>
                <Switch on={privacy.notif?.[k] !== false} label={label}
                  onToggle={() => savePrivacy({ notif: { dms: privacy.notif?.dms !== false, mentions: privacy.notif?.mentions !== false, [k]: privacy.notif?.[k] === false } })} />
              </div>
            ))}
            {rows([['sound', 'صوت الإشعارات', 'وانت فاتح التطبيق']])}
          </div>
        </section>

        <section>
          <h2>الخصوصية</h2>
          <div className="set-card set-card-pad">
            <span id="dm-who" className="set-q">مين يقدر يبعتلك رسائل خاصة؟</span>
            <div role="radiogroup" aria-labelledby="dm-who" className="radio-list">
              {[
                ['all', 'كل الأعضاء', 'أي حد في شات كيمت'],
                ['rooms', 'الأعضاء اللي معايا في الغرف', 'بس الناس اللي في نفس غرفك'],
                ['none', 'محدش', 'محدش يقدر يبدأ معاك محادثة خاصة'],
              ].map(([id, label, hint]) => (
                <button key={id} type="button" role="radio" aria-checked={privacy.dmWho === id}
                  className={`choice choice-start choice-tall ${privacy.dmWho === id ? 'choice-on' : ''}`} onClick={() => savePrivacy({ dmWho: id })}>
                  <Radio on={privacy.dmWho === id} />
                  <span className="choice-text"><b>{label}</b><small>{hint}</small></span>
                </button>
              ))}
            </div>
          </div>
          <div className="set-card">
            <div className="set-row">
              <span className="set-label">إظهار إني متصل<small>الناس تشوف النقطة الخضرا و«متصل» جنب اسمك</small></span>
              <Switch on={privacy.showOnline !== false} onToggle={() => savePrivacy({ showOnline: privacy.showOnline === false })} label="إظهار إني متصل" />
            </div>
            <div className="set-row">
              <span className="set-label">علامة القراءة<small>لو قفلتها مش هتشوف علامة قراءة الناس برضه</small></span>
              <Switch on={privacy.receipts !== false} onToggle={() => savePrivacy({ receipts: privacy.receipts === false })} label="علامة القراءة" />
            </div>
          </div>
        </section>

        <section>
          <h2>الحظر</h2>
          <div className="set-card">
            <button type="button" aria-expanded={showBlocked} className="set-row set-btn" onClick={() => setShowBlocked(!showBlocked)}>
              <Block size={20} className="danger-ic" />
              <span className="set-label">الأعضاء المحظورين</span>
              <span className="row-time">{ar(blockedList.length)}</span>
            </button>
            {showBlocked && blockedList.map((b) => (
              <div key={b.uid} className="set-row">
                <span className="mini-avatar" aria-hidden="true">{b.name.charAt(0)}</span>
                <span className="set-label">{b.name}</span>
                <button type="button" className="pill-btn" onClick={() => unblockUser(user.uid, b.uid).catch(() => showToast('حصلت مشكلة، جرب تاني'))}>إلغاء الحظر</button>
              </div>
            ))}
            {showBlocked && blockedList.length === 0 && <p className="set-empty">مفيش حد محظور</p>}
          </div>
        </section>

        <section>
          <h2>الحساب</h2>
          <div className="set-card">
            <Link to="/profile" className="set-row set-link"><User size={20} />تعديل بياناتي</Link>
            <button type="button" className="set-row set-link set-danger" onClick={() => signOutUser().then(() => navigate('/login', { replace: true }))}>
              <Logout />تسجيل الخروج
            </button>
          </div>
        </section>
      </div>
      {toast}
    </main>
  )
}
