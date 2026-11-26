import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, signInAnonymously, linkWithPopup, linkWithRedirect,
  EmailAuthProvider, linkWithCredential, signInWithEmailAndPassword, updatePassword, reauthenticateWithPopup,
} from 'firebase/auth'
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, arrayUnion, deleteField } from 'firebase/firestore'
import { auth, db, googleProvider, popupResolver } from './firebase.js'
import { useRolesDoc, useMyBan } from './roles.js'
import { pb, pbLogin, pbRefresh, live } from './pb/client.js'
import { logDiag } from './diag.js'

// النسخة اللي بتشتغل على سيرفر PocketBase (الدخول لسه بجوجل/Firebase)
export const IS_PB = import.meta.env.VITE_BACKEND === 'pb'
const pbProfile = (r) => (r && r.name ? { id: r.id, ...r } : null)

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
  // نسخة PocketBase: لو الدخول محفوظ على الموبايل، الشات بيفتح على طول بيه (من غير مانستنى جوجل يتأكد)،
  // وجوجل بيتأكد في الخلفية — لو طلع مش داخل أو حساب تاني بنخرج عادي
  const saved = IS_PB && pb.authStore.isValid && pb.authStore.record?.id ? pb.authStore.record : null
  const [user, setUser] = useState(saved ? { uid: saved.id, optimistic: true } : undefined)
  const [profile, setProfile] = useState(saved ? (pbProfile(saved) ?? undefined) : undefined)
  const [privacy, setPrivacy] = useState(DEFAULT_PRIVACY)

  useEffect(() => {
    // بنكمّل الدخول بجوجل بس لو كان بادئ بالـ redirect
    if (localStorage.getItem('kemet-redirect')) {
      localStorage.removeItem('kemet-redirect')
      // (لو زائر كان بيسجّل بجوجل: نحدّث السيرفر إنه بقى عضو مسجّل)
      getRedirectResult(auth, popupResolver).then((r) => { if (r?.operationType === 'link') pbRefresh(r.user).catch(() => {}) }).catch(() => {})
    }
    return onAuthStateChanged(auth, async (u) => {
      // سيرفر PocketBase: بنبدّل توكن Firebase بتوكن السيرفر قبل أي حاجة
      if (IS_PB) {
        if (u) { try { await pbLogin(u) } catch (e) { console.warn('pb login failed', e?.status); logDiag('pb.login', e, String(e?.status || '')) } }
        else pb.authStore.clear()
      }
      setUser(u)
      if (!u) setProfile(null)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    setProfile((p) => (p && p.id === user.uid ? p : undefined))
    if (IS_PB) {
      let done = false
      const got = async (r) => {
        const p = pbProfile(r)
        if (p) { takePendingProfile(); return setProfile(p) }
        if (done) return setProfile(null)
        done = true
        const pending = takePendingProfile()
        if (pending?.name) {
          // (بنحط البيانات على طول من رد السيرفر، من غير ما نستنى التحديث اللحظي اللي ساعات بيتأخر على الآيفون)
          try { const rec = await saveProfile(user.uid, pending, true); if (pbProfile(rec)) setProfile(pbProfile(rec)) } catch (e) { logDiag('profile.save', e, String(e?.status || '')); setProfile(null) }
        } else setProfile(null)
      }
      pb.collection('users').getOne(user.uid).then(got).catch(() => setProfile(null))
      return live('users', user.uid, (ev) => { done = true; setProfile(pbProfile(ev.record)) })
    }
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
  }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  // إعدادات الخصوصية (سرية — في settings/{uid})
  useEffect(() => {
    if (!user) { setPrivacy(DEFAULT_PRIVACY); return }
    if (IS_PB) {
      const set = (r) => setPrivacy(pbPrivacy(r))
      pb.collection('settings').getOne(user.uid).then(set).catch(() => set(null))
      return live('settings', user.uid, (ev) => set(ev.action === 'delete' ? null : ev.record))
    }
    return onSnapshot(doc(db, 'settings', user.uid),
      (s) => setPrivacy({ ...DEFAULT_PRIVACY, ...(s.exists() ? s.data() : {}) }),
      () => setPrivacy(DEFAULT_PRIVACY))
  }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  // الأدوار (الأدمن والمشرفين) + لو أنا محظور من التطبيق
  const roles = useRolesDoc(!!user)
  const myBan = useMyBan(user?.uid)

  return <AuthCtx.Provider value={{ user, profile, privacy, roles, myBan }}>{children}</AuthCtx.Provider>
}

export const DEFAULT_PRIVACY = { blocked: {}, dmWho: 'rooms', receipts: true, showOnline: true }

// سيرفر PocketBase: الحقول المقلوبة (noReceipts/hideOnline) علشان الافتراضي يبقى "شغال"
const pbPrivacy = (r) => (r ? {
  ...DEFAULT_PRIVACY, blocked: r.blocked || {}, dmWho: r.dmWho || 'rooms', notif: r.notif || {},
  receipts: !r.noReceipts, showOnline: !r.hideOnline,
} : DEFAULT_PRIVACY)
async function pbSettings(uid, fn) {
  const col = pb.collection('settings')
  let cur = null
  try { cur = await col.getOne(uid) } catch (e) { if (e?.status !== 404) throw e }
  const patch = fn(cur ? pbPrivacy(cur) : DEFAULT_PRIVACY)
  const data = {}
  if ('blocked' in patch) data.blocked = patch.blocked
  if ('dmWho' in patch) data.dmWho = patch.dmWho
  if ('notif' in patch) data.notif = patch.notif
  if ('receipts' in patch) data.noReceipts = !patch.receipts
  if ('showOnline' in patch) data.hideOnline = !patch.showOnline
  return cur ? col.update(uid, data) : col.create({ id: uid, ...data })
}

export function updatePrivacy(uid, patch) {
  if (IS_PB) return pbSettings(uid, () => patch)
  return setDoc(doc(db, 'settings', uid), patch, { merge: true })
}
export function blockUser(uid, other, name) {
  if (IS_PB) return pbSettings(uid, (p) => ({ blocked: { ...p.blocked, [other]: { name: (name || '').slice(0, 30), at: new Date().toISOString() } } }))
  return setDoc(doc(db, 'settings', uid), { blocked: { [other]: { name: (name || '').slice(0, 30), at: serverTimestamp() } } }, { merge: true })
}
export function unblockUser(uid, other) {
  if (IS_PB) return pbSettings(uid, (p) => { const { [other]: _, ...rest } = p.blocked; return { blocked: rest } })
  return updateDoc(doc(db, 'settings', uid), { [`blocked.${other}`]: deleteField() })
}

// العضو دخل غرفة (بيتحسب في "الأعضاء اللي معايا في الغرف")
export async function joinRoom(uid, roomId) {
  if (IS_PB) {
    const me = await pb.collection('users').getOne(uid, { fields: 'rooms' })
    const list = Array.isArray(me.rooms) ? me.rooms : []
    return list.includes(roomId) ? null : pb.collection('users').update(uid, { rooms: [...list, roomId].slice(-100) })
  }
  return setDoc(doc(db, 'users', uid), { rooms: arrayUnion(roomId), updatedAt: serverTimestamp() }, { merge: true })
}

// ===== الزوار =====
// الزائر: داخل من غير جوجل ولا باسورد (اسم فرعوني اتختارله)
export const isGuest = (user, profile) => !!(user?.isAnonymous || profile?.guest)

export async function signInAsGuest(name, gender) {
  setPendingProfile({ name, gender })
  await signInAnonymously(auth)
}

const iosHomeApp = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) && (window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches)

// الزائر يسجّل: بيفضل نفس الحساب (رسايله واسمه) وبيبقى عضو مسجّل
export async function guestToGoogle() {
  if (iosHomeApp() && location.hostname === 'chatkemet.pages.dev') {
    localStorage.setItem('kemet-redirect', '1')
    return linkWithRedirect(auth.currentUser, googleProvider, popupResolver)
  }
  try {
    await linkWithPopup(auth.currentUser, googleProvider, popupResolver)
  } catch (e) {
    // سفاري قفل النافذة: نروح لجوجل في نفس الصفحة ونرجع
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment' || e?.code === 'auth/web-storage-unsupported') {
      localStorage.setItem('kemet-redirect', '1')
      return linkWithRedirect(auth.currentUser, googleProvider, popupResolver)
    }
    throw e
  }
  await pbRefresh(auth.currentUser)
}
export async function guestToEmail(email, password) {
  const e = String(email || '').trim().toLowerCase()
  await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(e, password))
  await auth.currentUser.reload()
  await pbRefresh(auth.currentUser)
}
export function signupErrorText(e) {
  const c = e?.code || ''
  if (c.includes('credential-already-in-use') || c.includes('email-already-in-use')) return 'الحساب ده متسجّل قبل كده — اخرج وادخل بيه من صفحة الدخول'
  if (c.includes('invalid-email')) return 'الإيميل مكتوب غلط'
  if (c.includes('weak-password')) return 'الباسورد لازم ٦ حروف أو أرقام على الأقل'
  if (c.includes('popup-closed') || c.includes('cancelled-popup')) return 'قفلت نافذة جوجل قبل ما تكمل'
  if (c.includes('network')) return 'في مشكلة في النت، جرب تاني'
  if (c.includes('provider-already-linked')) return 'حسابك مسجّل بجوجل خلاص'
  return 'حصلت مشكلة، جرب تاني' + (c ? ` (${c.replace('auth/', '')})` : '')
}

export async function signInWithGoogle() {
  // الآيفون والشات مفتوح من الأيقونة: النافذة المنبثقة بتعلّق، فبنروح لجوجل في نفس الصفحة ونرجع
  // (بيشتغل لأن صفحة الدخول على نفس الموقع: chatkemet.pages.dev/__/auth)
  const iosApp = /iPhone|iPad|iPod/i.test(navigator.userAgent) && (window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches)
  if (iosApp && location.hostname === 'chatkemet.pages.dev') {
    localStorage.setItem('kemet-redirect', '1')
    await signInWithRedirect(auth, googleProvider, popupResolver)
    return
  }
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

export const signOutUser = () => {
  pb.authStore.clear()
  // نمسح الذاكرة اللي على الموبايل (الغرف والرسايل) علشان اللي يدخل بعدك مايشوفهاش
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('kemet-c1-')) localStorage.removeItem(k) } catch {}
  return signOut(auth)
}

// 🗑 امسح حسابي: السيرفر بيمسح كل البيانات، وبعدين بنمسح حساب الدخول نفسه ونخرج
export async function deleteMyAccount() {
  await pb.send('/api/kemet/account/delete', { method: 'POST', body: { confirm: 'امسح' } })
  try { await auth.currentUser?.delete() } catch { /* لو جوجل طلب دخول من جديد: الحساب اتمسح من الشات خلاص */ }
  try { localStorage.removeItem('kemet-settings') } catch { /* مش مهم */ }
  await signOutUser().catch(() => {})
}

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
  if (IS_PB) {
    const { updatedAt, ...rest } = data
    if (rest.age === null) delete rest.age
    return pb.collection('users').update(uid, rest)
  }
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

// بيقبل الإيميل أو اسم المستخدم
export function loginWithUsername(username, password) {
  const v = String(username || '').trim()
  return signInWithEmailAndPassword(auth, v.includes('@') ? v.toLowerCase() : usernameEmail(v), password)
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
    return 'الإيميل/اسم المستخدم أو الباسورد غلط'
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
