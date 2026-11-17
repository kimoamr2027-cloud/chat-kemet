// ألقاب مسابقة كيمت: بتتحسب من مجموع نقط العضو من أول ما بدأ (مابتتصفّرش)
// والأول في ترتيب الأسبوع ده بياخد شارة "🥇 بطل الأسبوع"
// كل التطبيق بيقرا مستند واحد بس (مش مستند لكل عضو) علشان يفضل خفيف
import { useSyncExternalStore } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase.js'
import { pb, live } from './pb/client.js'
import { weekKey } from './gamesShared.js'

export const TITLES = [
  { level: 1, min: 1, name: 'كاتب', icon: '📜' },
  { level: 2, min: 5, name: 'حكيم', icon: '🪶' },
  { level: 3, min: 15, name: 'كاهن', icon: '🦅' },
  { level: 4, min: 30, name: 'فرعون المسابقة', icon: '☥' },
]
export const titleOf = (pts) => [...TITLES].reverse().find((x) => pts >= x.min) || null
export const nextTitle = (pts) => TITLES.find((x) => pts < x.min) || null
// العضو لسه واصل اللقب ده بالنقطة دي بالظبط؟
export const justReached = (pts) => TITLES.find((x) => x.min === pts) || null

const IS_PB = import.meta.env.VITE_BACKEND === 'pb'
const EMPTY = { t: {}, champ: '' }
let state = EMPTY
let started = false
const subs = new Set()
const emit = (s) => { state = s; subs.forEach((f) => f()) }

function champOf(w) {
  let best = ''
  let n = 0
  for (const [u, p] of Object.entries(w || {})) if (p > n || (p === n && u < best)) { best = u; n = p }
  return best
}

function start() {
  if (started) return
  started = true
  if (IS_PB) {
    let soon = null
    const load = async () => {
      try {
        const all = await pb.collection('scores').getFullList({ filter: "board='quizall'", fields: 'uid,n', batch: 500 })
        const wk = await pb.collection('scores').getList(1, 1, { filter: `board='quiz' && week='${weekKey()}'`, sort: '-n,uid', fields: 'uid,n', skipTotal: true })
        emit({ t: Object.fromEntries(all.map((x) => [x.uid, x.n])), champ: wk.items[0]?.n ? wk.items[0].uid : '' })
      } catch { started = false }
    }
    load()
    live('scores', '*', () => { clearTimeout(soon); soon = setTimeout(load, 1500) })
    return
  }
  onSnapshot(doc(db, 'quizTitles', 'all'),
    (s) => {
      const d = s.exists() ? s.data() : {}
      emit({ t: d.t || {}, champ: d.wk === weekKey() ? champOf(d.w) : '' })
    },
    () => { started = false })
}

function subscribe(f) {
  start()
  subs.add(f)
  return () => subs.delete(f)
}
export function useQuizTitles() {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}
