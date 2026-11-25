// شريط صغير فوق الغرف: مهامك، الهرم، نجم الأسبوع، حظك اليوم، قبيلتك — تدوس على أي واحد يفتح الكارت كامل
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from './ui.jsx'
import { useAuth } from '../auth.jsx'
import { pb } from '../pb/client.js'
import { useStar } from '../star.js'
import { useTribeOf } from '../tribes.js'
import { ar } from '../utils.js'
import { StarBanner, FirstTasks } from './Newcomers.jsx'
import { PyramidCard, FortuneCard } from './Fun.jsx'

const IS_PB = import.meta.env.VITE_BACKEND === 'pb'
function useJSON(path, every = 120000) {
  const [d, setD] = useState(null)
  useEffect(() => {
    if (!IS_PB) return
    let alive = true
    const load = () => pb.send(path, { method: 'GET' }).then((r) => alive && setD(r)).catch(() => {})
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, every)
    return () => { alive = false; clearInterval(t) }
  }, [path, every])
  return d
}

function Tile({ ic, label, sub, hot, onClick }) {
  return (
    <button type="button" className={`ks-tile ${hot ? 'ks-hot' : ''}`} onClick={onClick}>
      <span className="ks-ic" aria-hidden="true">{ic}</span>
      <b>{label}</b>
      {sub && <small>{sub}</small>}
    </button>
  )
}

export default function KemetStrip({ showToast }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(null)
  const star = useStar()
  const tribe = useTribeOf(user?.uid)
  const pyr = useJSON('/api/kemet/pyramid')
  const tasks = useJSON('/api/kemet/tasks', 300000)
  const openTasks = tasks && !tasks.expired ? tasks.tasks.filter((t) => !t.claimed && !t.locked) : []
  const doneTasks = tasks?.tasks ? tasks.tasks.filter((t) => t.claimed).length : 0
  const pct = pyr ? Math.min(100, Math.round((pyr.stones / Math.max(1, pyr.goal)) * 100)) : null
  return (
    <>
      <div className="kemet-strip" role="list">
        {openTasks.length > 0 && <Tile ic="🎯" label="مهامك" sub={`${ar(doneTasks)} من ${ar(tasks.tasks.length)}`} hot onClick={() => setOpen('tasks')} />}
        {pyr && <Tile ic="🔺" label="الهرم" sub={pyr.done ? 'كمل! 🎉' : `${ar(pct)}٪`} onClick={() => setOpen('pyramid')} />}
        {star && <Tile ic="🔥" label="نجم الأسبوع" sub={star.name} onClick={() => setOpen('star')} />}
        <Tile ic="🔮" label="حظك اليوم" sub="دوس وشوف" onClick={() => setOpen('fortune')} />
        <Tile ic={tribe ? tribe.icon : '🏺'} label={tribe ? tribe.name : 'القبايل'} sub={tribe ? 'الترتيب' : 'انضم'} onClick={() => navigate('/tribes')} />
      </div>
      {open && (
        <Sheet onClose={() => setOpen(null)}>
          <span className="grabber" aria-hidden="true" />
          <div className="ks-sheet">
            {open === 'tasks' && <FirstTasks showToast={showToast} inSheet />}
            {open === 'pyramid' && <PyramidCard />}
            {open === 'star' && <StarBanner />}
            {open === 'fortune' && <FortuneCard startOpen />}
          </div>
        </Sheet>
      )}
    </>
  )
}
