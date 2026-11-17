// فلتر الشتايم من سيرفر PocketBase (config/filter، والأدمن بس اللي يعدّله)
import { useEffect, useState } from 'react'
import { pb, live } from './client.js'
import { rulesPattern } from '../filterCore.js'
export { hasBadWord, normalizeWord } from '../filterCore.js'

export function useFilter() {
  const [words, setWords] = useState([])
  useEffect(() => {
    const set = (r) => setWords(r?.data?.words || [])
    pb.collection('config').getOne('filter').then(set).catch(() => set(null))
    return live('config', 'filter', (ev) => set(ev.record))
  }, [])
  return words
}

export function saveFilter(words) {
  const list = [...new Set(words.map((w) => w.trim()).filter(Boolean))].slice(0, 300)
  return pb.collection('config').update('filter', { data: { words: list, pattern: rulesPattern(list) } })
}
