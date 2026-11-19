// تسجيل الدخول بجوجل على نفس الدومين (Safari بيقفل الكوكيز بين المواقع فالدخول كان بيطوّل)
// كل طلبات /__/auth/* بتتنقل زي ما هي لـ Firebase
export async function onRequest({ request }) {
  const u = new URL(request.url)
  u.protocol = 'https:'; u.hostname = 'chat-kemet.firebaseapp.com'; u.port = ''
  return fetch(new Request(u.toString(), request))
}
