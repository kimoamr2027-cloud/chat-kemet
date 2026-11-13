import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  initializeFirestore, connectFirestoreEmulator,
  persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
} from 'firebase/firestore'
import { connectAuthEmulator } from 'firebase/auth'
import { firebaseConfig } from './firebase-config.js'

const useEmulator = !!import.meta.env.VITE_USE_EMULATOR
export const app = initializeApp(useEmulator
  ? { ...firebaseConfig, apiKey: 'demo-key', projectId: 'demo-kemet', authDomain: 'demo-kemet.firebaseapp.com' }
  : firebaseConfig)
export const auth = getAuth(app)
auth.languageCode = 'ar'

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

// كاش على الجهاز علشان التطبيق يفتح بسرعة ويشتغل لو النت ضعيف
let localCache
try {
  localCache = persistentLocalCache({ tabManager: persistentMultipleTabManager() })
} catch {
  localCache = memoryLocalCache()
}
export const db = initializeFirestore(app, { localCache })

// للتجربة على الكمبيوتر بس (Firebase Emulator)
if (useEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  // دخول تجريبي للاختبارات الأوتوماتيك بس (مش موجود في النسخة الحقيقية)
  window.__kemetTestLogin = async (email, name) => {
    const { signInWithCredential } = await import('firebase/auth')
    const cred = GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, name, email_verified: true }))
    return signInWithCredential(auth, cred)
  }
}
