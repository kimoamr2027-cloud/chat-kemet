#!/bin/bash
# بيفتح النسخة الاحتياطية بالمفتاح الخاص (على جهاز الأدمن أو سيرفر جديد)
# bash restore.sh kemet-backup.enc kemet-backup-private.pem OUT_DIR
# OUT_DIR هيبقى فيه: data.db و storage/ — دول هما pb_data بتاع PocketBase
set -euo pipefail
ENC=$1; KEY=$2; OUT=$3
T=$(mktemp -d)
trap 'rm -rf $T' EXIT
tar -xf "$ENC" -C $T
openssl pkeyutl -decrypt -inkey "$KEY" -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -in $T/key.bin.enc -out $T/pass
mkdir -p "$OUT"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:$T/pass -in $T/data.tgz.enc | tar -xzf - -C "$OUT"
echo "restored to $OUT (backup from $(cat "$OUT/when.txt"))"
