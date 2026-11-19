/// <reference path="../pb_data/types.d.ts" />
// اقتصاد الكوينز: نتابع كسب الألعاب في اليوم (حد أقصى) ودقايق الغرفة الصوتية (مكافأة يومية)
migrate((app) => {
  const w = app.findCollectionByNameOrId("wallets")
  for (const n of ["gday", "gsum", "vday", "vmin"]) w.fields.add(new NumberField({ name: n, onlyInt: true }))
  app.save(w)
}, (app) => {
  const w = app.findCollectionByNameOrId("wallets")
  for (const n of ["gday", "gsum", "vday", "vmin"]) w.fields.removeByName(n)
  app.save(w)
})
