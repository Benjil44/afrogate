#!/usr/bin/env bash
# Afrows L2TP/IPsec server bootstrap (run ONCE as root on the Afrows VPS).
#
# Sets up L2TP/IPsec (strongSwan + xl2tpd) for users who can't install an app
# (built-in VPN on Android/iOS/Windows). Egress reuses the existing TPROXY path
# (ppp traffic -> AFROWS_WG mangle chain -> xray tproxy-in:12345 -> Germany), so
# L2TP exits through the same foreign hop as VLESS/WireGuard.
#
# Idempotent: safe to re-run. Generates a PSK + a test user on first run and
# writes AFROWS_L2TP_* env for the backend to deliver later.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }

ENV_FILE=/etc/afrows/afrows.env
TPROXY_PORT=12345
L2TP_LOCAL=10.9.0.1
L2TP_RANGE="10.9.0.10-10.9.0.250"
L2TP_SUBNET=10.9.0.0/24
WAN_IFACE="$(ip route get 1.1.1.1 2>/dev/null | grep -oE 'dev [^ ]+' | awk '{print $2}' | head -1)"

echo "==> install strongswan + xl2tpd"
if ! command -v ipsec >/dev/null 2>&1 || ! command -v xl2tpd >/dev/null 2>&1; then
  # tolerate a flaky mirror index (e.g. backports hash mismatch); drop bad lists
  rm -f /var/lib/apt/lists/*backports* 2>/dev/null || true
  DEBIAN_FRONTEND=noninteractive apt-get update -qq -o Acquire::Check-Valid-Until=false || true
  DEBIAN_FRONTEND=noninteractive apt-get install -y strongswan xl2tpd ppp >/dev/null \
    || { echo "ERROR: package install failed (mirror issue?). Retry later."; exit 1; }
fi

echo "==> PSK + test user (kept if already present)"
mkdir -p "$(dirname "$ENV_FILE")"; touch "$ENV_FILE"
PSK="$( { grep -h '^AFROWS_L2TP_PSK=' "$ENV_FILE" 2>/dev/null || true; } | head -1 | cut -d= -f2- | tr -d '\r')"
[ -n "$PSK" ] || PSK="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
TESTPW="$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)"

echo "==> /etc/ipsec.conf (L2TP/IPsec PSK transport)"
cat > /etc/ipsec.conf <<EOF
config setup
    uniqueids=no
    charondebug="ike 1, knl 1, cfg 0"

conn L2TP-PSK
    keyexchange=ikev1
    type=transport
    authby=secret
    left=%defaultroute
    leftid=$(curl -s --max-time 8 https://api.ipify.org 2>/dev/null || echo %any)
    leftprotoport=17/1701
    right=%any
    rightprotoport=17/%any
    auto=add
    dpddelay=30
    dpdtimeout=120
    dpdaction=clear
    ike=aes256-sha1-modp1024,aes128-sha1-modp1024,3des-sha1-modp1024,aes256-sha256-modp2048!
    esp=aes256-sha1,aes128-sha1,3des-sha1,aes256-sha256!
EOF

echo "==> /etc/ipsec.secrets (PSK)"
printf ': PSK "%s"\n' "$PSK" > /etc/ipsec.secrets
chmod 600 /etc/ipsec.secrets

echo "==> /etc/xl2tpd/xl2tpd.conf"
mkdir -p /etc/xl2tpd
cat > /etc/xl2tpd/xl2tpd.conf <<EOF
[global]
port = 1701
access control = no

[lns default]
ip range = $L2TP_RANGE
local ip = $L2TP_LOCAL
require chap = yes
refuse pap = yes
require authentication = yes
name = AfrowsL2TP
ppp debug = no
pppoptfile = /etc/ppp/options.xl2tpd
length bit = yes
EOF

echo "==> /etc/ppp/options.xl2tpd (MSCHAPv2, MTU 1280 for the stacked egress)"
cat > /etc/ppp/options.xl2tpd <<'EOF'
require-mschap-v2
ms-dns 1.1.1.1
ms-dns 8.8.8.8
asyncmap 0
auth
crtscts
lock
hide-password
modem
name l2tpd
proxyarp
lcp-echo-interval 30
lcp-echo-failure 4
mtu 1280
mru 1280
nodefaultroute
connect-delay 5000
EOF

echo "==> /etc/ppp/chap-secrets (test user; provisioning will manage this later)"
touch /etc/ppp/chap-secrets; chmod 600 /etc/ppp/chap-secrets
grep -q '^l2tptest ' /etc/ppp/chap-secrets || printf '%s\t%s\t%s\t%s\n' "l2tptest" "l2tpd" "$TESTPW" "*" >> /etc/ppp/chap-secrets

echo "==> forwarding + TPROXY egress for the ppp pool (reuse AFROWS_WG chain + table 100)"
sysctl -w net.ipv4.ip_forward=1 >/dev/null
modprobe xt_TPROXY 2>/dev/null || true
ip rule add fwmark 1 lookup 100 2>/dev/null || true
ip route replace local default dev lo table 100
# ensure the TPROXY sink chain exists (created by the wg bootstrap; recreate if missing)
iptables -t mangle -N AFROWS_WG 2>/dev/null || true
iptables -t mangle -C AFROWS_WG -p tcp -j TPROXY --on-port "$TPROXY_PORT" --tproxy-mark 1 2>/dev/null || iptables -t mangle -A AFROWS_WG -p tcp -j TPROXY --on-port "$TPROXY_PORT" --tproxy-mark 1
iptables -t mangle -C AFROWS_WG -p udp -j TPROXY --on-port "$TPROXY_PORT" --tproxy-mark 1 2>/dev/null || iptables -t mangle -A AFROWS_WG -p udp -j TPROXY --on-port "$TPROXY_PORT" --tproxy-mark 1
# route ppp pool traffic into the TPROXY chain (scoped by source subnet, applies to ppp+)
iptables -t mangle -C PREROUTING -s "$L2TP_SUBNET" -j AFROWS_WG 2>/dev/null || iptables -t mangle -A PREROUTING -s "$L2TP_SUBNET" -j AFROWS_WG

echo "==> firewall: allow IKE/NAT-T (UDP 500/4500) + L2TP (UDP 1701)"
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q 'Status: active'; then
  ufw allow 500/udp >/dev/null 2>&1 || true
  ufw allow 4500/udp >/dev/null 2>&1 || true
fi

echo "==> enable + start services"
systemctl enable strongswan-starter xl2tpd >/dev/null 2>&1 || systemctl enable strongswan xl2tpd >/dev/null 2>&1 || true
systemctl restart strongswan-starter 2>/dev/null || systemctl restart strongswan 2>/dev/null || true
systemctl restart xl2tpd

echo "==> write AFROWS_L2TP_* env (server addr + PSK) for backend delivery"
if ! grep -q '^AFROWS_L2TP_PSK=' "$ENV_FILE"; then
  PUBIP="$(curl -s --max-time 8 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
  cat >> "$ENV_FILE" <<EOF
# --- Afrows L2TP/IPsec delivery ---
AFROWS_L2TP_SERVER=$PUBIP
AFROWS_L2TP_PSK=$PSK
EOF
  echo "   wrote AFROWS_L2TP_* (restart afrows-backend to load)"
fi

echo
echo "==== L2TP server ready ===="
echo "  Server     : $(grep '^AFROWS_L2TP_SERVER=' "$ENV_FILE" | cut -d= -f2-)"
echo "  PSK        : $PSK"
echo "  Test user  : l2tptest"
echo "  Test pass  : (only shown on first run) $TESTPW"
echo "  WAN iface  : $WAN_IFACE"
echo "  ipsec      : $(systemctl is-active strongswan-starter 2>/dev/null || systemctl is-active strongswan 2>/dev/null)"
echo "  xl2tpd     : $(systemctl is-active xl2tpd)"
