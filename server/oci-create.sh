#!/bin/bash
# Chat Kemet: creates the free Oracle Cloud server automatically.
# Run inside OCI Cloud Shell:
#   curl -fsSL https://raw.githubusercontent.com/kimoamr2027-cloud/chat-kemet/main/server/oci-create.sh | bash
# Safe to run again: it reuses anything already created.
set -uo pipefail

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*"; exit 1; }
q() { "$@" 2>/dev/null | tr -d '"' | grep -v '^None$' || true; }

# ----- tenancy (root compartment) -----
T="${OCI_TENANCY:-}"
[ -z "$T" ] && T=$(grep -hm1 '^tenancy' /etc/oci/config ~/.oci/config 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' ')
[ -z "$T" ] && T=$(q oci os ns get-metadata --query 'data."default-s3-compartment-id"' --raw-output)
[ -z "$T" ] && die "Could not find your tenancy. Make sure you are in Cloud Shell."
say "Tenancy: ${T:0:40}..."

AD=$(q oci iam availability-domain list --compartment-id "$T" --query 'data[0].name' --raw-output)
[ -z "$AD" ] && die "Could not read availability domains."
say "Availability domain: $AD"

# ----- already exists? -----
INST=$(q oci compute instance list --compartment-id "$T" --display-name kemet-server --lifecycle-state RUNNING --query 'data[0].id' --raw-output)

if [ -z "$INST" ]; then
  # ----- network -----
  VCN=$(q oci network vcn list --compartment-id "$T" --display-name kemet-vcn --query 'data[0].id' --raw-output)
  if [ -z "$VCN" ]; then
    say "Creating network (VCN)"
    VCN=$(q oci network vcn create --compartment-id "$T" --display-name kemet-vcn --cidr-block 10.0.0.0/16 --dns-label kemet \
      --wait-for-state AVAILABLE --query 'data.id' --raw-output)
    [ -z "$VCN" ] && die "VCN creation failed."
  fi

  IGW=$(q oci network internet-gateway list --compartment-id "$T" --vcn-id "$VCN" --query 'data[0].id' --raw-output)
  if [ -z "$IGW" ]; then
    say "Creating internet gateway"
    IGW=$(q oci network internet-gateway create --compartment-id "$T" --vcn-id "$VCN" --is-enabled true --display-name kemet-igw \
      --wait-for-state AVAILABLE --query 'data.id' --raw-output)
    [ -z "$IGW" ] && die "Internet gateway creation failed."
  fi

  RT=$(q oci network vcn get --vcn-id "$VCN" --query 'data."default-route-table-id"' --raw-output)
  SL=$(q oci network vcn get --vcn-id "$VCN" --query 'data."default-security-list-id"' --raw-output)

  say "Routing internet traffic"
  oci network route-table update --rt-id "$RT" --force \
    --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"$IGW\"}]" >/dev/null \
    || die "Route table update failed."

  say "Opening ports 22, 80, 443"
  oci network security-list update --security-list-id "$SL" --force \
    --ingress-security-rules '[
      {"source":"0.0.0.0/0","protocol":"6","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":22,"max":22}}},
      {"source":"0.0.0.0/0","protocol":"6","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":80,"max":80}}},
      {"source":"0.0.0.0/0","protocol":"6","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":443,"max":443}}},
      {"source":"0.0.0.0/0","protocol":"1","isStateless":false,"icmpOptions":{"type":3,"code":4}}
    ]' \
    --egress-security-rules '[{"destination":"0.0.0.0/0","protocol":"all","isStateless":false}]' >/dev/null \
    || die "Security list update failed."

  SUB=$(q oci network subnet list --compartment-id "$T" --vcn-id "$VCN" --display-name kemet-subnet --query 'data[0].id' --raw-output)
  if [ -z "$SUB" ]; then
    say "Creating public subnet"
    SUB=$(q oci network subnet create --compartment-id "$T" --vcn-id "$VCN" --display-name kemet-subnet --cidr-block 10.0.0.0/24 \
      --dns-label pub --wait-for-state AVAILABLE --query 'data.id' --raw-output)
    [ -z "$SUB" ] && die "Subnet creation failed."
  fi

  # ----- ssh key (stays in your Cloud Shell, for emergencies) -----
  [ -f ~/.ssh/id_rsa.pub ] || ssh-keygen -t rsa -b 4096 -N "" -f ~/.ssh/id_rsa -q

  # ----- startup script -----
  INIT=$(mktemp)
  cat > "$INIT" <<'EOF'
#!/bin/bash
curl -fsSL https://raw.githubusercontent.com/kimoamr2027-cloud/chat-kemet/main/server/setup.sh -o /root/kemet-setup.sh && bash /root/kemet-setup.sh > /var/log/kemet-setup.log 2>&1
EOF

  image_for() { # shape
    local img=""
    for v in 24.04 22.04; do
      img=$(q oci compute image list --compartment-id "$T" --operating-system "Canonical Ubuntu" --operating-system-version "$v" \
        --shape "$1" --sort-by TIMECREATED --sort-order DESC --query 'data[0].id' --raw-output)
      [ -n "$img" ] && break
    done
    echo "$img"
  }

  # ----- launch: try the biggest free size first, then smaller ones -----
  try_launch() { # shape ocpus mem
    local shape=$1 ocpus=$2 mem=$3 img cfg out
    img=$(image_for "$shape")
    [ -z "$img" ] && { echo "no image for $shape"; return 1; }
    cfg=()
    [ "$shape" = "VM.Standard.A1.Flex" ] && cfg=(--shape-config "{\"ocpus\":$ocpus,\"memoryInGBs\":$mem}")
    say "Trying $shape ${ocpus:+($ocpus CPU / ${mem}GB)}"
    out=$(oci compute instance launch --compartment-id "$T" --availability-domain "$AD" --display-name kemet-server \
      --shape "$shape" "${cfg[@]}" --image-id "$img" --subnet-id "$SUB" --assign-public-ip true \
      --user-data-file "$INIT" --ssh-authorized-keys-file ~/.ssh/id_rsa.pub \
      --wait-for-state RUNNING --max-wait-seconds 900 --query 'data.id' --raw-output 2>&1)
    if echo "$out" | grep -q '^ocid1\.instance'; then INST=$(echo "$out" | grep -m1 '^ocid1\.instance'); return 0; fi
    echo "$out" | grep -iE 'capacity|limit|error|message' | head -3
    return 1
  }

  try_launch VM.Standard.A1.Flex 4 24 \
    || try_launch VM.Standard.A1.Flex 2 12 \
    || try_launch VM.Standard.A1.Flex 1 6 \
    || try_launch VM.Standard.E2.1.Micro "" "" \
    || die "Oracle has no free servers available right now (Out of capacity). Wait an hour and run the same command again."
fi

IP=$(q oci compute instance list-vnics --instance-id "$INST" --query 'data[0]."public-ip"' --raw-output)
[ -z "$IP" ] && die "Server created but no public IP found."
DOMAIN="${IP//./-}.sslip.io"
say "Server is RUNNING. Public IP: $IP"
say "Installing the chat server (takes 2-5 minutes)..."

for i in $(seq 1 60); do
  if curl -fsS --max-time 5 "https://$DOMAIN/api/kemet/status" >/dev/null 2>&1; then
    say "DONE! Chat server is live: https://$DOMAIN/api/kemet/status"
    echo
    echo "Send this line to Claude:  SERVER=$DOMAIN"
    exit 0
  fi
  sleep 10
done
echo
echo "The server is still installing. Send this line to Claude:  SERVER=$DOMAIN"
