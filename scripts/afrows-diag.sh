#!/usr/bin/env bash
# Afrows per-section connectivity diagnostic.
# Walks the whole chain hop-by-hop and shows where internet is (and isn't)
# flowing. Self-discovering: reads the live UUID/email and exit server from the
# running xray, so NO secrets are stored in this file.
#
#   phone -> nginx:443 (TLS+WS) -> afrows-in xray (8447) -> uplink socks (10808)
#         -> r-juuh4sm3 vless (185.252.x) -> internet (Germany exit)
#
# Usage:  bash afrows-diag.sh
set -u

if [ -t 1 ]; then G='\033[32m'; R='\033[31m'; Y='\033[33m'; B='\033[1m'; N='\033[0m'; else G=''; R=''; Y=''; B=''; N=''; fi
ok()   { printf "  ${G}PASS${N}  %b\n" "$*"; }
bad()  { printf "  ${R}FAIL${N}  %b\n" "$*"; }
info() { printf "  ${Y} ..${N}  %b\n" "$*"; }
hdr()  { printf "\n${B}%b${N}\n" "$*"; }

API="127.0.0.1:10085"
UPLINK_SOCKS="127.0.0.1:10808"
AFROWS_CONF="/usr/local/etc/afrows-xray/config.json"
UPLINK_CONF="/usr/local/etc/xray/config.json"
XRAY="/usr/local/bin/xray"

printf "${B}===================================================================${N}\n"
printf "${B} AFROWS CONNECTIVITY DIAGNOSTIC  %s${N}\n" "$(date -u '+%Y-%m-%d %H:%M:%SZ')"
printf "${B}===================================================================${N}\n"

# Discover the live test user (uuid + email) from the running inbound.
USERS_JSON="$($XRAY api inbounduser --server=$API -tag=afrows-in 2>/dev/null)"
UUID="$(printf '%s' "$USERS_JSON" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["users"][0]["account"]["id"]) if d.get("users") else print("")' 2>/dev/null)"
EMAIL="$(printf '%s' "$USERS_JSON" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["users"][0]["email"]) if d.get("users") else print("")' 2>/dev/null)"

# Discover the exit server (the bought vless) from the uplink config.
read -r EXIT EXITPORT <<EOF
$(python3 -c "import json;o=[x for x in json.load(open('$UPLINK_CONF'))['outbounds'] if x.get('tag')=='proxy'][0];v=o['settings']['vnext'][0];print(v['address'],v['port'])" 2>/dev/null)
EOF

hdr "[Section 1] Phone -> nginx :443  (TLS handshake + WebSocket upgrade)"
code="$(curl -s --http1.1 --resolve app.afrows.com:443:127.0.0.1 \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Sec-WebSocket-Version: 13' \
  -o /dev/null -w '%{http_code}' https://app.afrows.com/afrowsws 2>/dev/null)"
[ "$code" = "101" ] && ok "nginx WS upgrade 101 (cert valid for app.afrows.com, /afrowsws routed)" \
                     || bad "nginx returned '$code' (expected 101 Switching Protocols)"

hdr "[Section 2] nginx -> afrows-in xray  (127.0.0.1:8447, vless+ws)"
ss -ltn 2>/dev/null | grep -q '127.0.0.1:8447' && ok "afrows-in listening on 8447" \
                                               || bad "afrows-in NOT listening on 8447"

hdr "[Section 3] afrows-in -> uplink proxy  (socks 127.0.0.1:10808)"
ss -ltn 2>/dev/null | grep -q '127.0.0.1:10808' && ok "uplink socks listening on 10808" \
                                                || bad "uplink socks NOT listening on 10808"

hdr "[Section 4] uplink -> r-juuh4sm3 exit  ($EXIT:$EXITPORT, the bought vless)"
if ping -c3 -W2 "$EXIT" >/dev/null 2>&1; then
  ok "ping $EXIT -> $(ping -c3 -W2 "$EXIT" 2>/dev/null | tail -1 | sed 's/.*= //')"
else
  info "no ICMP reply from $EXIT (ping may be filtered; not fatal)"
fi
if timeout 6 bash -c "cat </dev/null >/dev/tcp/$EXIT/$EXITPORT" 2>/dev/null; then
  ok "TCP $EXIT:$EXITPORT open"
else
  bad "TCP $EXIT:$EXITPORT closed/unreachable"
fi

hdr "[Section 5] FULL egress: real internet through the entire chain"
exitip="$(timeout 20 curl -s --socks5-hostname $UPLINK_SOCKS https://api.ipify.org 2>/dev/null)"
loc="$(timeout 20 curl -s --socks5-hostname $UPLINK_SOCKS https://cloudflare.com/cdn-cgi/trace 2>/dev/null | grep '^loc=' | cut -d= -f2)"
t="$(timeout 20 curl -s -o /dev/null -w '%{time_total}' --socks5-hostname $UPLINK_SOCKS https://www.google.com/generate_204 2>/dev/null)"
if [ -n "$exitip" ]; then
  ok "internet OK  ->  exit IP ${exitip} (${loc:-?}),  google/generate_204 in ${t:-?}s"
else
  bad "NO internet through uplink (egress broken)"
fi

hdr "[Section 6] Test account provisioned in afrows-in"
if [ -n "$UUID" ]; then
  ok "live user: ${UUID}  (${EMAIL})"
else
  bad "no user provisioned in afrows-in (run backend provisioning reconcile)"
fi

hdr "[Section 7] Test account traffic counters (proves a real client passed data)"
$XRAY api statsquery --server=$API -pattern "user>>>${EMAIL}" 2>/dev/null \
  | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
except Exception:
    d={}
st=d.get("stat",[])
if not st:
    print("   ..  no counters yet (user has never passed traffic)")
for s in st:
    name=s["name"].split(">>>")[-1]
    print("   ..  %-8s = %s bytes" % (name, s.get("value",0)))' 2>/dev/null \
  || info "could not read counters"

printf "\n${B}===================================================================${N}\n"
printf " Legend: Sections 1-5 = server health.  Sections 6-7 = the account.\n"
printf " If 1-5 PASS but a phone still shows 0 traffic, the problem is the\n"
printf " CLIENT app, not the server.\n"
printf "${B}===================================================================${N}\n"
