import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
} from 'firebase/auth'
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, arrayUnion, deleteField } from 'firebase/firestore'
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
  const [privacy, setPrivacy] = useState(DEFAULT_PRIVACY)

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
        try { await saveProfile(user.uid, pending, true) } catch (e) { console.warn('profile save failed', e?.code); setProfile(null) }
      } else {
        setProfile(null)
      }
    }, () => setProfile(null))
  }, [user])

  // إعدادات الخصوصية (سرية — في settings/{uid})
  useEffect(() => {
    if (!user) { setPrivacy(DEFAULT_PRIVACY); return }
    return onSnapshot(doc(db, 'settings', user.uid),
      (s) => setPrivacy({ ...DEFAULT_PRIVACY, ...(s.exists() ? s.data() : {}) }),
      () => setPrivacy(DEFAULT_PRIVACY))
  }, [user])

  return <AuthCtx.Provider value={{ user, profile, privacy }}>{children}</AuthCtx.Provider>
}

export const DEFAULT_PRIVACY = { blocked: {}, dmWho: 'rooms', receipts: true, showOnline: true }

export function updatePrivacy(uid, patch) {
  return setDoc(doc(db, 'settings', uid), patch, { merge: true })
}
export function blockUser(uid, other, name) {
  return setDoc(doc(db, 'settings', uid), { blocked: { [other]: { name: (name || '').slice(0, 30), at: serverTimestamp() } } }, { merge: true })
}
export function unblockUser(uid, other) {
  return updateDoc(doc(db, 'settings', uid), { [`blocked.${other}`]: deleteField() })
}

// العضو دخل غرفة (بيتحسب في "الأعضاء اللي معايا في الغرف")
export function joinRoom(uid, roomId) {
  return setDoc(doc(db, 'users', uid), { rooms: arrayUnion(roomId), updatedAt: serverTimestamp() }, { merge: true })
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
