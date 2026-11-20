# الصوت المباشر (الغرفة الصوتية): LiveKit للصوت + Caddy قدام PocketBase
# بيتقري من setup.sh (source) — بيستخدم BASE و REPO و ARCH و DOMAIN و SITE_ORIGIN و log
# Caddy بياخد 80 و 443 (https) ويوزّع: /rtc للصوت والباقي لـ PocketBase على 127.0.0.1:8090
# لو حاجة منهم ماتحمّلتش، أو Caddy ماشتغلش: PocketBase بيرجع لوحده زي الأول

LK=$BASE/livekit
VOICE=0

voice_install() {
  mkdir -p $LK
  local LKV CV tmp
  LKV=$(tr -d ' \n' < $REPO/server/LIVEKIT_VERSION)
  CV=$(tr -d ' \n' < $REPO/server/CADDY_VERSION)
  if [ ! -x $LK/livekit-server ] || ! $LK/livekit-server --version 2>/dev/null | grep -q "$LKV"; then
    log "تحميل LiveKit $LKV"
    tmp=$(mktemp -d)
    ( curl -fsSL -o $tmp/lk.tgz "https://github.com/livekit/livekit/releases/download/v${LKV}/livekit_${LKV}_linux_${ARCH}.tar.gz" \
      && tar -xzf $tmp/lk.tgz -C $tmp livekit-server && install -m 755 $tmp/livekit-server $LK/livekit-server ) || log "تحذير: LiveKit ماتحمّلش"
    rm -rf $tmp
  fi
  if [ ! -x /usr/local/bin/caddy ] || ! /usr/local/bin/caddy version 2>/dev/null | grep -q "v$CV"; then
    log "تحميل Caddy $CV"
    tmp=$(mktemp -d)
    ( curl -fsSL -o $tmp/caddy.tgz "https://github.com/caddyserver/caddy/releases/download/v${CV}/caddy_${CV}_linux_${ARCH}.tar.gz" \
      && tar -xzf $tmp/caddy.tgz -C $tmp caddy && install -m 755 $tmp/caddy /usr/local/bin/caddy ) || log "تحذير: Caddy ماتحمّلش"
    rm -rf $tmp
  fi
  # voice-off: لو حبينا نقفل الصوت يدوي
  if [ -x $LK/livekit-server ] && [ -x /usr/local/bin/caddy ] && [ ! -f $BASE/voice-off ]; then VOICE=1; else return 0; fi

  [ -s $LK/secret ] || { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40 > $LK/secret; chmod 600 $LK/secret; }
  printf '%s\n' \
    "port: 7880" \
    "rtc:" \
    "  tcp_port: 7881" \
    "  udp_port: 7882" \
    "  use_external_ip: true" \
    "keys:" \
    "  kemet: $(cat $LK/secret)" \
    "room:" \
    "  empty_timeout: 600" \
    "logging:" \
    "  level: warn" > $LK/livekit.yaml
  chmod 600 $LK/livekit.yaml

  printf '%s\n' \
    "[Unit]" \
    "Description=Chat Kemet voice (LiveKit)" \
    "After=network-online.target" \
    "Wants=network-online.target" \
    "[Service]" \
    "ExecStart=$LK/livekit-server --config $LK/livekit.yaml" \
    "Restart=always" \
    "RestartSec=3" \
    "LimitNOFILE=65536" \
    "[Install]" \
    "WantedBy=multi-user.target" > /etc/systemd/system/livekit.service

  mkdir -p /etc/caddy /var/lib/caddy
  printf '%s\n' \
    "$DOMAIN {" \
    "	encode gzip" \
    "	@voice path /rtc /rtc/*" \
    "	reverse_proxy @voice 127.0.0.1:7880" \
    "	reverse_proxy 127.0.0.1:8090 {" \
    "		flush_interval -1" \
    "	}" \
    "}" > /etc/caddy/Caddyfile

  printf '%s\n' \
    "[Unit]" \
    "Description=Chat Kemet front (Caddy)" \
    "After=network-online.target" \
    "Wants=network-online.target" \
    "[Service]" \
    "Environment=XDG_DATA_HOME=/var/lib/caddy XDG_CONFIG_HOME=/etc/caddy" \
    "ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile" \
    "Restart=always" \
    "RestartSec=3" \
    "LimitNOFILE=65536" \
    "[Install]" \
    "WantedBy=multi-user.target" > /etc/systemd/system/caddy.service

  # بورتات الصوت (ولازم تتفتح كمان في Oracle Security List)
  iptables -C INPUT -p tcp --dport 7881 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 7881 -j ACCEPT
  iptables -C INPUT -p udp --dport 7882 -j ACCEPT 2>/dev/null || iptables -I INPUT -p udp --dport 7882 -j ACCEPT
  command -v netfilter-persistent >/dev/null && netfilter-persistent save >/dev/null 2>&1 || true
}

# خدمة PocketBase: مع Caddy بتسمع على 127.0.0.1:8090، ومن غيره بتاخد 80 و 443 بنفسها
pb_unit() {
  local SERVE VENV
  if [ "$1" = proxy ]; then
    SERVE="serve --http 127.0.0.1:8090"
    VENV="Environment=KEMET_LK_PUBLIC=wss://$DOMAIN"
  else
    SERVE="serve $DOMAIN"
    VENV=""
  fi
  printf '%s\n' \
    "[Unit]" \
    "Description=Chat Kemet (PocketBase)" \
    "After=network-online.target" \
    "Wants=network-online.target" \
    "" \
    "[Service]" \
    "Type=simple" \
    "WorkingDirectory=$BASE" \
    "$VENV" \
    "ExecStart=$BASE/pocketbase $SERVE --dir $BASE/pb_data --publicDir $BASE/pb_public --hooksDir $REPO/server/pb_hooks --migrationsDir $REPO/server/pb_migrations --origins $SITE_ORIGIN,https://chatkemet.pages.dev,https://$DOMAIN" \
    "Restart=always" \
    "RestartSec=3" \
    "LimitNOFILE=65536" \
    "" \
    "[Install]" \
    "WantedBy=multi-user.target" > /etc/systemd/system/kemet.service
}

# التشغيل: لو الموقع ماشتغلش من خلال Caddy في دقيقتين، نرجع PocketBase لوحده زي الأول
voice_start() {
  systemctl enable livekit caddy >/dev/null 2>&1
  systemctl restart livekit
  systemctl restart kemet
  systemctl restart caddy
  local ok=0 i
  for i in $(seq 40); do
    curl -fsS --max-time 5 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" >/dev/null 2>&1 && { ok=1; break; }
    sleep 3
  done
  if [ $ok = 1 ]; then
    echo "on $(date -u +%FT%TZ)" > $BASE/voice-state
    log "الصوت المباشر شغال"
  else
    log "تحذير: Caddy ماشتغلش — رجعنا PocketBase لوحده"
    systemctl stop caddy livekit
    systemctl disable caddy livekit >/dev/null 2>&1
    pb_unit direct
    systemctl daemon-reload
    systemctl restart kemet
    echo "failed $(date -u +%FT%TZ)" > $BASE/voice-state
  fi
}
