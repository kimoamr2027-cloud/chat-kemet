#!/bin/bash
# Chat Kemet: opens the voice-room ports (LiveKit) on the Oracle network.
# Run inside OCI Cloud Shell:
#   curl -fsSL https://raw.githubusercontent.com/kimoamr2027-cloud/chat-kemet/main/server/oci-voice-ports.sh | bash
# Adds TCP 7881 and UDP 7882 and keeps every rule that is already there. Safe to run again.
set -uo pipefail

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*"; exit 1; }
q() { "$@" 2>/dev/null | tr -d '"' | grep -v '^None$' || true; }

T="${OCI_TENANCY:-}"
[ -z "$T" ] && T=$(grep -hm1 '^tenancy' /etc/oci/config ~/.oci/config 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' ')
[ -z "$T" ] && T=$(q oci os ns get-metadata --query 'data."default-s3-compartment-id"' --raw-output)
[ -z "$T" ] && die "Could not find your tenancy. Make sure you are in Cloud Shell."

VCN=$(q oci network vcn list --compartment-id "$T" --display-name kemet-vcn --query 'data[0].id' --raw-output)
[ -z "$VCN" ] && die "Could not find the kemet-vcn network."
SL=$(q oci network vcn get --vcn-id "$VCN" --query 'data."default-security-list-id"' --raw-output)
[ -z "$SL" ] && die "Could not find the security list."

say "Reading the current rules"
oci network security-list get --security-list-id "$SL" --query 'data."ingress-security-rules"' > /tmp/kemet-ingress.json 2>/dev/null \
  || die "Could not read the security list."

python3 - /tmp/kemet-ingress.json <<'PY' > /tmp/kemet-ingress-new.json
import json, sys
rules = json.load(open(sys.argv[1])) or []
def has(proto, port):
    for r in rules:
        opt = r.get('tcp-options') or r.get('udp-options') or r.get('tcpOptions') or r.get('udpOptions') or {}
        rng = opt.get('destination-port-range') or opt.get('destinationPortRange') or {}
        if r.get('protocol') == proto and rng.get('min', 0) <= port <= rng.get('max', -1):
            return True
    return False
# keep the existing rules in the format the CLI expects (camelCase)
def camel(r):
    out = {'source': r.get('source'), 'protocol': r.get('protocol'), 'isStateless': bool(r.get('is-stateless', r.get('isStateless', False)))}
    for k, nk in (('tcp-options', 'tcpOptions'), ('udp-options', 'udpOptions'), ('icmp-options', 'icmpOptions')):
        v = r.get(k) or r.get(nk)
        if v:
            if 'destination-port-range' in v:
                v = {'destinationPortRange': v['destination-port-range']}
            out[nk] = v
    if r.get('description'):
        out['description'] = r['description']
    return out
new = [camel(r) for r in rules]
if not has('6', 7881):
    new.append({'source': '0.0.0.0/0', 'protocol': '6', 'isStateless': False, 'tcpOptions': {'destinationPortRange': {'min': 7881, 'max': 7881}}, 'description': 'kemet voice tcp'})
if not has('17', 7882):
    new.append({'source': '0.0.0.0/0', 'protocol': '17', 'isStateless': False, 'udpOptions': {'destinationPortRange': {'min': 7882, 'max': 7882}}, 'description': 'kemet voice udp'})
print(json.dumps(new))
PY
[ -s /tmp/kemet-ingress-new.json ] || die "Could not prepare the new rules."

say "Opening voice ports 7881 (TCP) and 7882 (UDP)"
oci network security-list update --security-list-id "$SL" --force \
  --ingress-security-rules "file:///tmp/kemet-ingress-new.json" >/dev/null \
  || die "Security list update failed."

say "Done! Voice ports are open."
oci network security-list get --security-list-id "$SL" \
  --query 'data."ingress-security-rules"[].{proto:protocol, tcp:"tcp-options"."destination-port-range".min, udp:"udp-options"."destination-port-range".min}' \
  --output table 2>/dev/null || true
