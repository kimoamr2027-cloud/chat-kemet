// بيانات مشروع Firebase (مش سرية — عادي تبقى في الكود، الحماية بتيجي من Security Rules)
export const firebaseConfig = {
  apiKey: 'AIzaSyAMvkZFogeqw17lkr2WqurFXGMN7kIRE-0',
  // على الدومين الجديد: الدخول بيتم على نفس الموقع (أسرع في Safari) — functions/__/auth
  authDomain: typeof location !== 'undefined' && location.hostname === 'chatkemet.pages.dev' ? 'chatkemet.pages.dev' : 'chat-kemet.firebaseapp.com',
  projectId: 'chat-kemet',
  storageBucket: 'chat-kemet.firebasestorage.app',
  messagingSenderId: '1052218726571',
  appId: '1:1052218726571:web:e3afc67bb47e073603ffee',
}
