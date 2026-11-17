#!/bin/bash
# بيقفل فولدر البيانات بالمفتاح العام بتاع السيرفر (على جهاز المطوّر)
# bash pack.sh DATA_DIR PUBKEY.pem OUT_DIR
set -euo pipefail
DATA=$1; PUB=$2; OUT=$3
T=$(mktemp -d)
head -c 48 /dev/urandom | base64 | tr -d '\n' > $T/pass
openssl pkeyutl -encrypt -pubin -inkey "$PUB" -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -in $T/pass -out "$OUT/key.bin.enc"
tar -czf - -C "$DATA" . | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass file:$T/pass -out "$OUT/data.tgz.enc"
rm -rf $T
echo "packed: $(du -h "$OUT/data.tgz.enc" | cut -f1)"
