// "مسابقة كيمت": سؤال في كارت فوق الغرفة، وأول واحد يكتب الإجابة الصح ياخد نقطة
import { useEffect, useState } from 'react'
import {
  collection, doc, onSnapshot, query, where, runTransaction, deleteDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { BANK, GAME_TYPES } from './gameBank.js'
import { serverNow } from './presence.js'

export { GAME_TYPES }
export const ROUND_MS = 45 * 1000 // وقت السؤال
export const GAP_MS = 6 * 1000 // استراحة بين الأسئلة

// نوحّد الكتابة: أ/إ/آ = ا، ة = ه، ى = ي، من غير تشكيل ولا مسافات ولا علامات
export function normalize(s) {
  return String(s || '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[^\p{L}\p{N}]/gu, '')
}

export async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// كل الأشكال المقبولة للإجابة (بـ "ال" ومن غيرها)
function variants(answers) {
  const out = new Set()
  for (const a of answers) {
    const n = normalize(a)
    if (!n) continue
    out.add(n)
    if (n.startsWith('ال') && n.length > 4) out.add(n.slice(2))
    else if (!/^[0-9a-z]/.test(n)) out.add('ال' + n)
  }
  return [...out].slice(0, 8)
}

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// نلخبط حروف الكلمة (ومانرجعهاش زي ما هي)
function scramble(word) {
  const letters = [...word.replace(/\s+/g, '')]
  let s = letters
  for (let i = 0; i < 10 && s.join('') === letters.join(''); i++) s = shuffle(letters)
  return s.join(' ')
}

// نختار سؤال مااتسألش قبل كده في المسابقة دي
const used = new Map() // roomId -> Set
function pickQuestion(roomId, type) {
  const t = type === 'mix' ? shuffle(['emoji', 'scramble', 'proverb', 'trivia'])[0] : type
  const set = used.get(roomId) || new Set()
  used.set(roomId, set)
  let pool = BANK[t].filter((q) => !set.has(t + q.p))
  if (!pool.length) { for (const k of [...set]) if (k.startsWith(t)) set.delete(k); pool = BANK[t] }
  const q = pool[Math.floor(Math.random() * pool.length)]
  set.add(t + q.p)
  return { t, q }
}

async function buildRound(roomId, type, round, total, me, myName) {
  const { t, q } = pickQuestion(roomId, type)
  const hashes = await Promise.all(variants(q.a).map(sha256))
  const prompt = t === 'scramble' ? scramble(q.p) : q.p
  const hint = t === 'scramble' ? `${[...q.p.replace(/\s+/g, '')].length} حروف` : (q.h || '')
  return {
    type: t, prompt, hint, hashes, round, total, status: 'open',
    startedBy: me, startedByName: myName, roundAt: serverTimestamp(),
    answer: '', winner: '', winnerName: '', solvedAt: null,
    _mode: type,
  }
}

const sorted = (w) => [...w.replace(/\s+/g, '')].sort().join('')
// الإجابة اللي بتتعرض للناس (من البنك)
export function displayAnswer(game) {
  if (!game) return ''
  const list = BANK[game.type] || []
  const q = game.type === 'scramble'
    ? list.find((x) => sorted(x.p) === sorted(game.prompt))
    : list.find((x) => x.p === game.prompt)
  return q?.a[0] || game.answer || ''
}

const gameRef = (roomId) => doc(db, 'rooms', roomId, 'game', 'current')
// نوع المسابقة (علشان المكس) بنحفظه عندنا بس
const modes = new Map()

export async function startGame(roomId, type, total, me, myName) {
  used.delete(roomId)
  modes.set(roomId, type)
  const { _mode, ...data } = await buildRound(roomId, type, 1, total, me, myName)
  return runTransaction(db, async (tx) => { tx.set(gameRef(roomId), data) })
}

// السؤال اللي بعده (أو نهاية المسابقة) — لو حد تاني سبقنا مانعملش حاجة
export async function nextRound(roomId, game, me, myName) {
  const type = modes.get(roomId) || game.type
  const ref = gameRef(roomId)
  if (game.round >= game.total) {
    return runTransaction(db, async (tx) => {
      const cur = await tx.get(ref)
      if (!cur.exists() || cur.data().round !== game.round || cur.data().status === 'ended') return
      tx.update(ref, { status: 'ended' })
    })
  }
  const { _mode, ...data } = await buildRound(roomId, type, game.round + 1, game.total, me, myName)
  return runTransaction(db, async (tx) => {
    const cur = await tx.get(ref)
    if (!cur.exists() || cur.data().round !== game.round || cur.data().status === 'open') return
    tx.set(ref, data)
  })
}

// الوقت خلص ومحدش جاوب
export function timeoutRound(roomId, game) {
  const ref = gameRef(roomId)
  return runTransaction(db, async (tx) => {
    const cur = await tx.get(ref)
    if (!cur.exists() || cur.data().status !== 'open' || cur.data().round !== game.round) return
    tx.update(ref, { status: 'timeout', answer: displayAnswer(game).slice(0, 100), solvedAt: serverTimestamp() })
  })
}

export const endGame = (roomId) => deleteDoc(gameRef(roomId))
export const stopGame = (roomId) => updateDoc(gameRef(roomId), { status: 'ended' })

// رقم الأسبوع (ترتيب الأسبوع بيبدأ من جديد كل أسبوع)
export function weekKey(ms = serverNow()) {
  const d = new Date(ms)
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y = t.getUTCFullYear()
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)
  return `${y}-W${String(w).padStart(2, '0')}`
}

// العضو كتب رسالة: لو هي الإجابة الصح ياخد النقطة
export async function tryAnswer(roomId, game, text, uid, name) {
  if (!game || game.status !== 'open' || !crypto?.subtle) return false
  const n = normalize(text)
  if (!n || n.length > 100) return false
  const h = await sha256(n)
  if (!game.hashes?.includes(h)) return false
  const week = weekKey()
  try {
    await runTransaction(db, async (tx) => {
      const ref = gameRef(roomId)
      const sRef = doc(db, 'scores', uid)
      const cur = await tx.get(ref)
      const sc = await tx.get(sRef)
      if (!cur.exists() || cur.data().status !== 'open' || !cur.data().hashes.includes(h)) throw new Error('late')
      const old = sc.exists() ? sc.data() : null
      const points = old && old.week === week ? old.points + 1 : 1
      tx.update(ref, { status: 'solved', winner: uid, winnerName: name, answer: n, solvedAt: serverTimestamp() })
      tx.set(sRef, { name, points, week, room: roomId, updatedAt: serverTimestamp() })
    })
    return true
  } catch {
    return false
  }
}

export function useGame(roomId) {
  const [game, setGame] = useState(null)
  useEffect(() => onSnapshot(gameRef(roomId), (s) => {
    if (!s.exists()) return setGame(null)
    const x = s.data({ serverTimestamps: 'estimate' })
    setGame({ ...x, roundAt: x.roundAt?.toMillis?.() || serverNow(), solvedAt: x.solvedAt?.toMillis?.() || null })
  }, () => setGame(null)), [roomId])
  return game
}

export function useLeaderboard(enabled) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(query(collection(db, 'scores'), where('week', '==', weekKey())),
      (s) => setList(s.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => b.points - a.points).slice(0, 20)),
      () => setList([]))
  }, [enabled])
  return list
}
