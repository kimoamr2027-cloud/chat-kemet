import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
  EmailAuthProvider, linkWithCredential, signInWithEmailAndPassword, updatePassword, reauthenticateWithPopup,
} from 'firebase/auth'
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, arrayUnion, deleteField } from 'firebase/firestore'
import { auth, db, googleProvider, popupResolver } from './firebase.js'
import { useRolesDoc, useMyBan } from './roles.js'

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
    // بنكمّل الدخول بجوجل بس لو كان بادئ بالـ redirect
    if (localStorage.getItem('kemet-redirect')) {
      localStorage.removeItem('kemet-redirect')
      getRedirectResult(auth, popupResolver).catch(() => {})
    }
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

  // الأدوار (الأدمن والمشرفين) + لو أنا محظور من التطبيق
  const roles = useRolesDoc(!!user)
  const myBan = useMyBan(user?.uid)

  return <AuthCtx.Provider value={{ user, profile, privacy, roles, myBan }}>{children}</AuthCtx.Provider>
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
    await signInWithPopup(auth, googleProvider, popupResolver)
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      localStorage.setItem('kemet-redirect', '1')
      await signInWithRedirect(auth, googleProvider, popupResolver)
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
  if (typeof p.avatar === 'string') data.avatar = p.avatar
  if (isNew) data.createdAt = serverTimestamp()
  return setDoc(doc(db, 'users', uid), data, { merge: true })
}

// ===== الدخول باسم المستخدم والباسورد =====
// اسم المستخدم بيتحوّل لإيميل داخلي (مش حقيقي ومش بيتبعتله حاجة) علشان Firebase
const USER_DOMAIN = 'users.chat-kemet.web.app'
export const USERNAME_RE = /^[a-z0-9._]{3,20}$/
export const normalizeUsername = (u) => String(u || '').trim().toLowerCase()
const usernameEmail = (u) => `${normalizeUsername(u)}@${USER_DOMAIN}`

// اسم المستخدم بتاعي (لو عامل واحد)
export function myUsername(user) {
  const p = user?.providerData?.find((x) => x.providerId === 'password')
  return p?.email?.endsWith('@' + USER_DOMAIN) ? p.email.split('@')[0] : null
}

export async function createUsernameLogin(username, password) {
  const u = normalizeUsername(username)
  await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(usernameEmail(u), password))
  await auth.currentUser.reload()
  return u
}

export function loginWithUsername(username, password) {
  return signInWithEmailAndPassword(auth, usernameEmail(username), password)
}

export async function changePassword(newPassword) {
  try {
    await updatePassword(auth.currentUser, newPassword)
  } catch (e) {
    // لازم يكون داخل من قريب: نأكد بجوجل ونجرب تاني
    if (e?.code === 'auth/requires-recent-login' && auth.currentUser.providerData.some((p) => p.providerId === 'google.com')) {
      await reauthenticateWithPopup(auth.currentUser, googleProvider, popupResolver)
      await updatePassword(auth.currentUser, newPassword)
    } else throw e
  }
}

export function passwordErrorText(e) {
  const c = e?.code || ''
  if (c.includes('email-already-in-use') || c.includes('credential-already-in-use')) return 'اسم المستخدم ده محجوز، اختار اسم تاني'
  if (c.includes('provider-already-linked')) return 'انت عامل اسم مستخدم وباسورد قبل كده'
  if (c.includes('weak-password')) return 'الباسورد ضعيف، لازم ٦ حروف أو أرقام على الأقل'
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-email'))
    return 'اسم المستخدم أو الباسورد غلط'
  if (c.includes('too-many-requests')) return 'محاولات كتير غلط، استنى شوية وجرب تاني'
  if (c.includes('requires-recent-login')) return 'لازم تخرج وتدخل تاني الأول، وبعدين غيّر الباسورد'
  if (c.includes('network')) return 'في مشكلة في النت، جرب تاني'
  return 'حصلت مشكلة، جرب تاني'
}

export function authErrorText(e) {
  const c = e?.code || ''
  if (c.includes('popup-closed') || c.includes('cancelled-popup')) return 'قفلت نافذة جوجل قبل ما تكمل'
  if (c.includes('unauthorized-domain')) return 'الدومين ده مش متضاف في Firebase'
  if (c.includes('network')) return 'في مشكلة في النت، جرب تاني'
  if (c.includes('web-storage-unsupported') || c.includes('operation-not-supported')) return 'المتصفح ده مش بيدعم الدخول بجوجل — جرّب Chrome أو Safari'
  return 'حصلت مشكلة في تسجيل الدخول، جرب تاني'
}
