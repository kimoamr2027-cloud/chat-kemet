// شحن الكوينز بفودافون كاش (يدوي): العضو بيحوّل ويبعت الطلب، والأدمن بيوافق
// الباقات الحقيقية على السيرفر (server/pb_hooks/topup.pb.js)
import { useEffect, useState } from 'react'
import { pb, live } from './pb/client.js'

export const PACKS = [[10, 500], [25, 1375], [50, 2875], [100, 6000], [200, 12500]]
export const bonusOf = ([egp, coins]) => coins - egp * 50

export const getPay = () => pb.send('/api/kemet/pay', { method: 'GET' })
export const setPayNumber = (vodafone) => pb.send('/api/kemet/pay', { method: 'POST', body: { vodafone } })
export const sendTopup = (pack, sender, proof) => pb.send('/api/kemet/topup', { method: 'POST', body: { pack, sender, proof } })
export const adminTopups = () => pb.send('/api/kemet/topups', { method: 'GET' })
export const decideTopup = (id, ok, note = '') => pb.send('/api/kemet/topup/decide', { method: 'POST', body: { id, ok, note } })

// طلبات العضو (آخر ١٠) وبتتحدّث لوحدها لما الأدمن يوافق
export function useMyTopups(uid) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!uid) return
    let dead = false
    const load = () => pb.collection('topups').getList(1, 10, { filter: `owner='${uid}'`, sort: '-created', skipTotal: true })
      .then((r) => { if (!dead) setList(r.items) }).catch(() => { if (!dead) setList([]) })
    load()
    const off = live('topups', '*', () => load())
    return () => { dead = true; off() }
  }, [uid])
  return list
}

// الأدمن: مكسب الشات
export const getEarnings = () => pb.send('/api/kemet/earnings', { method: 'GET' })
