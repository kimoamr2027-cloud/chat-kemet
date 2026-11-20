/// <reference path="../pb_data/types.d.ts" />
// الدخول: التطبيق بيدخل بجوجل (أو اسم المستخدم) عن طريق Firebase زي ما هو،
// وبيبعت توكن Firebase هنا، وإحنا بنتأكد منه عند جوجل ونرجّع توكن PocketBase
routerAdd("POST", "/api/kemet/auth", (e) => {
  const idToken = String((e.requestInfo().body || {}).idToken || "")
  if (!idToken || idToken.length > 5000) throw new BadRequestError("missing token")
  const base = $os.getenv("KEMET_IDTK_URL") || "https://identitytoolkit.googleapis.com"
  const key = $os.getenv("KEMET_FIREBASE_KEY") || "AIzaSyAMvkZFogeqw17lkr2WqurFXGMN7kIRE-0"
  const res = $http.send({
    url: base + "/v1/accounts:lookup?key=" + key,
    method: "POST",
    body: JSON.stringify({ idToken }),
    headers: { "content-type": "application/json" },
    timeout: 15,
  })
  const u = res.statusCode === 200 && res.json && res.json.users && res.json.users[0]
  if (!u || !u.localId) throw new UnauthorizedError("invalid token")

  // زائر = داخل من غير جوجل ولا إيميل وباسورد (Firebase anonymous)
  const guest = !(u.providerUserInfo && u.providerUserInfo.length) && !u.email
  let rec
  try {
    rec = $app.findRecordById("users", u.localId)
    if (rec.getBool("guest") !== guest) { rec.set("guest", guest); $app.saveNoValidate(rec) }
  } catch (_) {
    rec = new Record($app.findCollectionByNameOrId("users"))
    rec.set("id", u.localId)
    rec.set("email", u.email || (u.localId.toLowerCase() + "@users.kemet.local"))
    rec.set("emailVisibility", false)
    rec.set("verified", true)
    rec.set("rooms", [])
    rec.set("guest", guest)
    rec.setPassword($security.randomString(40))
    $app.save(rec)
  }
  return $apis.recordAuthResponse(e, rec, "")
})

// تعديل البروفايل: حاجات معينة بس، وبأحجام مظبوطة
onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  if (e.hasSuperuserAuth()) return e.next()
  const r = e.record
  const old = r.original()
  for (const f of ["email", "verified", "emailVisibility", "guest", "welcomed"]) {
    if (String(r.get(f)) !== String(old.get(f))) lib.forbid("مش مسموح تغيّر " + f)
  }
  const name = r.getString("name").trim()
  r.set("name", name)
  if (name !== old.getString("name")) {
    if (!lib.str(name, 1, 30)) lib.fail("الاسم لازم من ١ لـ ٣٠ حرف")
    if (!lib.clean(e.app, name)) lib.fail("الاسم فيه كلمة ممنوعة")
  }
  const avatar = r.getString("avatar")
  if (avatar && avatar !== old.getString("avatar") && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(avatar)) lib.fail("صورة غلط")
  // الزائر مايقدرش يحط صورة بروفايل غير لما يسجّل
  if (avatar && avatar !== old.getString("avatar") && old.getBool("guest")) lib.forbid("سجّل حسابك الأول علشان تحط صورة")
  const rooms = lib.readJSON(r, "rooms") || []
  if (!Array.isArray(rooms) || rooms.length > 100 || rooms.some((x) => typeof x !== "string" || x.length > 40)) lib.fail("rooms غلط")
  if (!lib.clean(e.app, r.getString("bio"))) lib.fail("النبذة فيها كلمة ممنوعة")
  e.next()
}, "users")
