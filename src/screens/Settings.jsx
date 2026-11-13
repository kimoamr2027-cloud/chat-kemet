import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Back, Block, User, Logout } from '../components/Icons.jsx'
import { Radio, Switch, useToast } from '../components/ui.jsx'
import { logout, useSettings } from '../store.js'
import { ar } from '../utils.js'

export default function Settings() {
  const navigate = useNavigate()
  const [s, update] = useSettings()
  const [showBlocked, setShowBlocked] = useState(false)
  const [toast, showToast] = useToast()
  const flip = (k) => update({ on: { ...s.on, [k]: !s.on[k] } })

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
            {rows([['dms', 'الرسائل الخاصة'], ['mentions', 'الإشارات والردود'], ['rooms', 'كل رسائل الغرف'], ['sound', 'صوت الإشعارات']])}
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
                <button key={id} type="button" role="radio" aria-checked={s.dmWho === id}
                  className={`choice choice-start choice-tall ${s.dmWho === id ? 'choice-on' : ''}`} onClick={() => update({ dmWho: id })}>
                  <Radio on={s.dmWho === id} />
                  <span className="choice-text"><b>{label}</b><small>{hint}</small></span>
                </button>
              ))}
            </div>
          </div>
          <div className="set-card">
            {rows([
              ['online', 'إظهار إني متصل', 'الناس تشوف النقطة الخضرا جنب اسمك'],
              ['receipts', 'علامة القراءة', 'لو قفلتها مش هتشوف علامة قراءة الناس برضه'],
            ])}
          </div>
        </section>

        <section>
          <h2>الحظر</h2>
          <div className="set-card">
            <button type="button" aria-expanded={showBlocked} className="set-row set-btn" onClick={() => setShowBlocked(!showBlocked)}>
              <Block size={20} className="danger-ic" />
              <span className="set-label">الأعضاء المحظورين</span>
              <span className="row-time">{ar(s.blocked.length)}</span>
            </button>
            {showBlocked && s.blocked.map((name) => (
              <div key={name} className="set-row">
                <span className="mini-avatar" aria-hidden="true">{name.charAt(0)}</span>
                <span className="set-label">{name}</span>
                <button type="button" className="pill-btn" onClick={() => update({ blocked: s.blocked.filter((x) => x !== name) })}>إلغاء الحظر</button>
              </div>
            ))}
            {showBlocked && s.blocked.length === 0 && <p className="set-empty">مفيش حد محظور</p>}
          </div>
        </section>

        <section>
          <h2>الحساب</h2>
          <div className="set-card">
            <Link to="/profile" className="set-row set-link"><User size={20} />تعديل بياناتي</Link>
            <button type="button" className="set-row set-link set-danger" onClick={() => { logout(); navigate('/login', { replace: true }) }}>
              <Logout />تسجيل الخروج
            </button>
          </div>
        </section>
      </div>
      {toast}
    </main>
  )
}
