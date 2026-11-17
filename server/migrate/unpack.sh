#!/bin/bash
# نقل البيانات من Firebase للسيرفر (بيشتغل على السيرفر بس، كل دقيقتين مع التحديث)
# ١) أول مرة: السيرفر بيعمل قفل بمفتاحين (العام بيتنشر، والخاص مابيخرجش من السيرفر أبدًا)
# ٢) لما يلاقي ملف بيانات مقفول في الريبو: يفكّه بالمفتاح الخاص ويحطه للاستيراد
set -u
M=${KEMET_MIGRATE_DIR:-/opt/kemet/migrate}
REPO=${KEMET_REPO:-/opt/kemet/repo}
mkdir -p $M && chmod 700 $M
if [ ! -f $M/key.pem ]; then
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out $M/key.pem 2>/dev/null && chmod 600 $M/key.pem
  openssl pkey -in $M/key.pem -pubout -out $M/pub.pem
fi
ENC=$REPO/server/migrate/data.tgz.enc
KEY=$REPO/server/migrate/key.bin.enc
[ -f "$ENC" ] && [ -f "$KEY" ] || exit 0
SUM=$(sha256sum "$ENC" | cut -c1-16)
[ -f $M/unpacked-$SUM ] && exit 0
rm -rf $M/in && mkdir -p $M/in
if openssl pkeyutl -decrypt -inkey $M/key.pem -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -in "$KEY" -out $M/pass.bin \
  && openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:$M/pass.bin -in "$ENC" | tar -xz -C $M/in; then
  rm -f $M/pass.bin
  touch $M/unpacked-$SUM
  # الـ hook في PocketBase بيلقط الملف ده ويستورده
  mv $M/in $M/ready
  echo "$(date -u +%FT%TZ) unpacked $SUM" >> $M/log
else
  rm -f $M/pass.bin
  echo "$(date -u +%FT%TZ) unpack FAILED $SUM" >> $M/log
fi
