// نسخة PocketBase: Firestore مش مستخدم خالص (كل استخدامه ورا IS_PB)، فبنحط مكانه ملف فاضي
// علشان مايتحمّلش مع الشات (كان حوالي ٥٧٠ كيلو). أي حاجة تتنادى هنا بترجع من غير ما تعمل حاجة
const noop = () => {}
const off = () => noop
const fail = () => Promise.reject(new Error('firestore disabled in PocketBase build'))
export const Timestamp = { now: () => null, fromDate: () => null, fromMillis: () => null }
export const addDoc = fail
export const arrayRemove = () => null
export const arrayUnion = () => null
export const collection = () => null
export const connectFirestoreEmulator = noop
export const deleteDoc = fail
export const deleteField = () => null
export const doc = () => null
export const getCountFromServer = fail
export const getDoc = fail
export const getDocFromCache = fail
export const getDocs = fail
export const increment = () => null
export const initializeFirestore = () => null
export const limit = () => null
export const memoryLocalCache = () => null
export const onSnapshot = off
export const orderBy = () => null
export const persistentLocalCache = () => null
export const persistentMultipleTabManager = () => null
export const query = () => null
export const runTransaction = fail
export const serverTimestamp = () => null
export const setDoc = fail
export const updateDoc = fail
export const where = () => null
export const writeBatch = () => ({ set: noop, update: noop, delete: noop, commit: fail })
