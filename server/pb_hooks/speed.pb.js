// السرعة: المتصفح بيسأل السيرفر «إذن» (CORS preflight) قبل كل طلب، لأن الموقع والسيرفر على عنوانين مختلفين.
// هنا بنقوله يفتكر الإذن ساعتين (أقصى حاجة في Chrome، وSafari بيفتكر اللي يقدر عليه) بدل ما يسأل كل مرة
routerUse(new Middleware((e) => {
  e.response.header().set("Access-Control-Max-Age", "7200")
  return e.next()
}, -100000, "kemetPreflightCache"))
