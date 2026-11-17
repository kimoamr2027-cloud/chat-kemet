#!/bin/bash
# سيرفر شات كيمت: تثبيت وتحديث PocketBase على سيرفر Oracle (Ubuntu)
# بيشتغل أول مرة من سكريبت التشغيل (cloud-init)، وبعدين كل ما الملف ده يتغيّر على GitHub.
# آمن إنه يشتغل أكتر من مرة (idempotent).
set -euo pipefail

REPO_URL="https://github.com/kimoamr2027-cloud/chat-kemet.git"
BRANCH="main"
BASE=/opt/kemet
REPO=$BASE/repo
SITE_ORIGIN="https://kimoamr2027-cloud.github.io"

log() { echo "[kemet-setup $(date -u +%FT%TZ)] $*"; }
[ "$(id -u)" = 0 ] || { echo "لازم يشتغل كـ root"; exit 1; }
mkdir -p $BASE/backups $BASE/pb_data $BASE/pb_public

# ===== ١) البرامج اللي محتاجينها =====
if ! command -v git >/dev/null || ! command -v sqlite3 >/dev/null || ! command -v unzip >/dev/null; then
  log "تثبيت git و sqlite3 و unzip"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y -q
  apt-get install -y -q git sqlite3 unzip curl ca-certificates
fi

# ===== ٢) فتح البورتات 80 و 443 (صور Oracle Ubuntu قافلاها بـ iptables) =====
for p in 80 443; do
  iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport $p -j ACCEPT
done
command -v netfilter-persistent >/dev/null && netfilter-persistent save >/dev/null 2>&1 || true

# ===== ٣) ذاكرة إضافية (swap) للسيرفرات الصغيرة =====
if [ ! -f /swapfile ] && [ "$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)" -lt 4000 ]; then
  log "عمل swap 2G"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ===== ٤) الكود من GitHub =====
if [ ! -d $REPO/.git ]; then
  log "تحميل الكود"
  git clone --depth 1 --branch $BRANCH $REPO_URL $REPO
else
  git -C $REPO fetch --depth 1 origin $BRANCH -q && git -C $REPO reset --hard -q origin/$BRANCH
fi

# ===== ٥) PocketBase (النسخة المكتوبة في server/PB_VERSION) =====
PB_VERSION=$(tr -d ' \n' < $REPO/server/PB_VERSION)
case "$(uname -m)" in
  aarch64|arm64) ARCH=arm64 ;;
  x86_64|amd64) ARCH=amd64 ;;
  *) echo "معمارية مش مدعومة: $(uname -m)"; exit 1 ;;
esac
if [ ! -x $BASE/pocketbase ] || ! $BASE/pocketbase --version | grep -q "$PB_VERSION"; then
  log "تحميل PocketBase $PB_VERSION ($ARCH)"
  tmp=$(mktemp -d)
  curl -fsSL -o $tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip"
  unzip -o -q $tmp/pb.zip -d $tmp
  install -m 755 $tmp/pocketbase $BASE/pocketbase
  rm -rf $tmp
fi

# ===== ٦) اسم السيرفر (https مجاني من sslip.io على رقم الـ IP) =====
if [ ! -s $BASE/domain ]; then
  IP=$(curl -fsS --max-time 10 https://api.ipify.org || curl -fsS --max-time 10 https://ifconfig.me)
  echo "${IP//./-}.sslip.io" > $BASE/domain
fi
DOMAIN=$(cat $BASE/domain)
log "الدومين: $DOMAIN"

# ===== ٧) حساب الأدمن بتاع لوحة PocketBase (الباسورد بيتحفظ على السيرفر بس) =====
if [ ! -s $BASE/superuser.txt ]; then
  PASS=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 24)
  $BASE/pocketbase superuser upsert kimoamr2027@gmail.com "$PASS" --dir $BASE/pb_data >/dev/null
  printf 'email: kimoamr2027@gmail.com\npassword: %s\n' "$PASS" > $BASE/superuser.txt
  chmod 600 $BASE/superuser.txt
fi

# ===== ٨) خدمة PocketBase =====
cat > /etc/systemd/system/kemet.service <<EOF
[Unit]
Description=Chat Kemet (PocketBase)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$BASE
ExecStart=$BASE/pocketbase serve $DOMAIN --dir $BASE/pb_data --publicDir $BASE/pb_public --hooksDir $REPO/server/pb_hooks --migrationsDir $REPO/server/pb_migrations --origins $SITE_ORIGIN,https://$DOMAIN
Restart=always
RestartSec=3
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# ===== ٩) التحديث الأوتوماتيك من GitHub كل دقيقتين =====
cat > /usr/local/bin/kemet-update <<'EOF'
#!/bin/bash
# بيسحب آخر نسخة من GitHub، ولو حاجة اتغيّرت بيعيد التثبيت أو يعمل restart
set -u
REPO=/opt/kemet/repo
cd $REPO || exit 0
before=$(git rev-parse HEAD)
timeout 60 git fetch --depth 1 origin main -q || exit 0
after=$(git rev-parse origin/main)
[ "$before" = "$after" ] && exit 0
changed=$(git diff --name-only "$before" "$after" -- server/ 2>/dev/null || echo server/)
git reset --hard -q origin/main
[ -z "$changed" ] && exit 0
if echo "$changed" | grep -qE '^server/(setup\.sh|PB_VERSION)$'; then
  bash $REPO/server/setup.sh >> /var/log/kemet-setup.log 2>&1
elif echo "$changed" | grep -q '^server/pb_migrations/'; then
  systemctl restart kemet
fi
# التغييرات في pb_hooks بيلقطها PocketBase لوحده (hooksWatch)
EOF
chmod 755 /usr/local/bin/kemet-update

cat > /etc/systemd/system/kemet-update.service <<'EOF'
[Unit]
Description=Chat Kemet auto-update
[Service]
Type=oneshot
ExecStart=/usr/local/bin/kemet-update
EOF
cat > /etc/systemd/system/kemet-update.timer <<'EOF'
[Unit]
Description=Chat Kemet auto-update every 2 minutes
[Timer]
OnBootSec=1min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
EOF

# ===== ١٠) نسخة احتياطية كل يوم (بنحتفظ بآخر ١٤ يوم) =====
cat > /usr/local/bin/kemet-backup <<'EOF'
#!/bin/bash
set -eu
B=/opt/kemet/backups
d=$(date -u +%F)
sqlite3 /opt/kemet/pb_data/data.db ".backup $B/data-$d.db"
gzip -f $B/data-$d.db
tar -czf $B/storage-$d.tgz -C /opt/kemet/pb_data storage 2>/dev/null || true
find $B -type f -mtime +14 -delete
EOF
chmod 755 /usr/local/bin/kemet-backup
echo "17 3 * * * root /usr/local/bin/kemet-backup" > /etc/cron.d/kemet-backup

systemctl daemon-reload
systemctl enable --now kemet-update.timer >/dev/null
systemctl enable kemet >/dev/null
systemctl restart kemet
log "تمام: https://$DOMAIN/api/health"
