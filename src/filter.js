// فلتر الشتايم (الكلمات بتتحفظ في config/filter والأدمن بس اللي يعدّلها)
import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'
import { rulesPattern } from './filterCore.js'
export { hasBadWord, normalizeWord } from './filterCore.js'

export function useFilter() {
  const [words, setWords] = useState([])
  useEffect(() => onSnapshot(doc(db, 'config', 'filter'),
    (s) => setWords(s.exists() ? s.data().words || [] : []), () => setWords([])), [])
  return words
}

export function saveFilter(words) {
  const list = [...new Set(words.map((w) => w.trim()).filter(Boolean))].slice(0, 300)
  return setDoc(doc(db, 'config', 'filter'), { words: list, pattern: rulesPattern(list), updatedAt: serverTimestamp() })
}
