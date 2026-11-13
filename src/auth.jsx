import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
} from 'firebase/auth'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase.js'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

// الاسم والنوع اللي العضو كتبهم قبل ما يدوس على جوجل
const PENDING = 'kemet-pending-profile'
export function setPendingProfile(p) {
  try { sessionStorage.setItem(PENDING, JSON.stringify(p)) } catch {}
}
function takePendingProfile() {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDING))
    sessionStorage.removeItem(PENDING)
    return v
  } catch { return null }
}

export function AuthProvider({ children }) {
  // undefined = لسه بنحمّل، null = مش مسجل
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(undefined)

  useEffect(() => {
    getRedirectResult(auth).catch(() => {})
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (!u) setProfile(null)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    setProfile(undefined)
    const ref = doc(db, 'users', user.uid)
    return onSnapshot(ref, { includeMetadataChanges: true }, async (snap) => {
      if (snap.exists()) {
        takePendingProfile()
        return setProfile({ id: snap.id, ...snap.data() })
      }
      // لسه بنسأل السيرفر — منحكمش إنه عضو جديد من الكاش
      if (snap.metadata.fromCache) return
      // عضو جديد: لو كان كتب اسمه ونوعه في شاشة الدخول نحفظهم على طول
      const pending = takePendingProfile()
      if (pending?.name) {
        try { await saveProfile(user.uid, pending, true) } catch { setProfile(null) }
      } else {
        setProfile(null)
      }
    }, () => setProfile(null))
  }, [user])

  return <AuthCtx.Provider value={{ user, profile }}>{children}</AuthCtx.Provider>
}

export async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, googleProvider)
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, googleProvider)
      return
    }
    throw e
  }
}

export const signOutUser = () => signOut(auth)

// حفظ بيانات العضو (كل واحد يعدّل بياناته بس — والـ Rules بتتأكد من كده)
export function saveProfile(uid, p, isNew = false) {
  const data = {
    name: String(p.name || '').trim().slice(0, 30),
    gender: p.gender === 'female' ? 'female' : 'male',
    bio: String(p.bio || '').slice(0, 200),
    city: String(p.city || '').trim().slice(0, 40),
    age: Number.isInteger(parseInt(p.age, 10)) ? parseInt(p.age, 10) : null,
    updatedAt: serverTimestamp(),
  }
  if (isNew) data.createdAt = serverTimestamp()
  return setDoc(doc(db, 'users', uid), data, { merge: true })
}

export function authErrorText(e) {
  const c = e?.code || ''
  if (c.includes('popup-closed') || c.includes('cancelled-popup')) return 'قفلت نافذة جوجل قبل ما تكمل'
  if (c.includes('unauthorized-domain')) return 'الدومين ده مش متضاف في Firebase'
  if (c.includes('network')) return 'في مشكلة في النت، جرب تاني'
  return 'حصلت مشكلة في تسجيل الدخول، جرب تاني'
}
