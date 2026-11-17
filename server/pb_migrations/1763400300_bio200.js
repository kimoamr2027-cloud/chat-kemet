/// <reference path="../pb_data/types.d.ts" />
// النبذة لحد ٢٠٠ حرف (زي التطبيق)
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.getByName("bio").max = 200
  app.save(users)
}, (app) => {})
