/// <reference path="../pb_data/types.d.ts" />
// الأدمن: اسمه في الشات «الأدمن» ومن غير نوع ولا سن — للأدمنز الموجودين دلوقتي ورسايلهم القديمة (مرة واحدة)
// (الأدمن الجديد بيتظبط لوحده من hooks/auth.pb.js)
migrate((app) => {
  try {
    const lib = require(`${__hooks}/lib.js`)
    for (const uid of lib.roles(app).admins) lib.adminize(app, uid)
  } catch (err) { console.log("admin name migration failed: " + err) }
}, (app) => {})
