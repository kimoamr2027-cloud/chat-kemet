# نقل البيانات من Firebase

- `export.py` بيقرا بيانات Firestore (على جهاز المطوّر) ويعمل فولدر فيه `data.json` والصور والفويس.
- الفولدر بيتقفل بالمفتاح **العام** بتاع السيرفر (`/api/kemet/migrate/pubkey`) ويترفع هنا كـ `data.tgz.enc` + `key.bin.enc`.
- البيانات المقفولة محدش يقدر يفتحها غير السيرفر (المفتاح الخاص في `/opt/kemet/migrate/key.pem` ومابيخرجش).
- `unpack.sh` (على السيرفر) بيفكها، و`pb_hooks/migrate.pb.js` بيستوردها مرة واحدة، والحالة في `/api/kemet/migrate/status`.
