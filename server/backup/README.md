# النسخة الاحتياطية (برّه السيرفر)

- السيرفر كل يوم الساعة ٥:١٧ الصبح (مصر) بيعمل نسخة من قاعدة البيانات والصور والفويس،
  ويقفلها بالمفتاح العام `pub.pem` (`offsite.sh`).
- GitHub كل يوم الساعة ٥:٤٧ بياخد النسخة ويحفظها في **Actions ← النسخة الاحتياطية** لمدة ٩٠ يوم.
- الملف متشفّر: محدش يقدر يفتحه (ولا GitHub ولا اللي بيسرق السيرفر) غير اللي معاه **المفتاح الخاص**
  `kemet-backup-private.pem` — وده مع الأدمن بس، مش على السيرفر ولا على GitHub.

## لو احتجنا نرجّع البيانات

1. نزّل آخر نسخة من GitHub: Actions ← «النسخة الاحتياطية» ← آخر تشغيلة ← Artifacts (ملف zip جواه `kemet-backup.enc`).
2. على أي جهاز Linux/Mac فيه openssl:
   ```
   bash server/backup/restore.sh kemet-backup.enc kemet-backup-private.pem ./pb_data
   ```
3. الفولدر `pb_data` (فيه `data.db` و `storage/`) هو بيانات PocketBase: يتحط مكان `/opt/kemet/pb_data` على السيرفر الجديد.
