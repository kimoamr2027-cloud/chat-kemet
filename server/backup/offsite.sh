#!/bin/bash
# نسخة احتياطية مقفولة علشان تتحفظ برّه السيرفر (GitHub بياخدها كل يوم)
# بتتقفل بالمفتاح العام اللي هنا (pub.pem). المفتاح الخاص اللي بيفتحها مع الأدمن بس، مش على السيرفر ولا على GitHub.
# bash offsite.sh PB_DATA_DIR OUT_FILE
set -euo pipefail
DATA=${1:-/opt/kemet/pb_data}
OUT=${2:-/opt/kemet/offsite/kemet-backup.enc}
PUB=$(dirname "$0")/pub.pem
T=$(mktemp -d)
trap 'rm -rf $T' EXIT
mkdir -p $T/pack $(dirname "$OUT")
# نسخة سليمة من قاعدة البيانات (حتى والسيرفر شغال) + الصور والفويس
sqlite3 "$DATA/data.db" ".backup $T/pack/data.db"
[ -f "$DATA/auxiliary.db" ] && sqlite3 "$DATA/auxiliary.db" ".backup $T/pack/auxiliary.db" || true
[ -d "$DATA/storage" ] && cp -r "$DATA/storage" $T/pack/storage || mkdir -p $T/pack/storage
date -u +%FT%TZ > $T/pack/when.txt
# باسورد عشوائي بيقفل الملف، والباسورد نفسه بيتقفل بالمفتاح العام
head -c 48 /dev/urandom | base64 | tr -d '\n' > $T/pass
openssl pkeyutl -encrypt -pubin -inkey "$PUB" -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -in $T/pass -out $T/key.bin.enc
tar -czf - -C $T/pack . | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass file:$T/pass -out $T/data.tgz.enc
tar -cf "$OUT.tmp" -C $T key.bin.enc data.tgz.enc
mv "$OUT.tmp" "$OUT"
# ملف صغير جنبها فيه الوقت والحجم (علشان نتأكد من بره إن النسخة جديدة)
echo "$(cat $T/pack/when.txt) $(stat -c %s "$OUT")" > "$OUT.txt"
echo "offsite backup: $(du -h "$OUT" | cut -f1) $(cat $T/pack/when.txt)"
