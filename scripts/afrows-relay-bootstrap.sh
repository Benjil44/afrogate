#!/usr/bin/env bash
# Afrows dedicated relay bootstrap.
#
# Run as root on a FRESH small VPS that is OUTSIDE Ireland and reachable FROM Ireland
# (Turkey / UAE / Armenia / Netherlands, clean IP). It stands up a VLESS+Reality
# inbound that the Afrows Ireland VPS dials, and egresses straight to the open
# internet through this box — giving Afrows a reliable, self-owned exit to add to
# the failover pool (instead of depending on flaky third-party relays).
#
# Reality needs no certificate (it borrows a real site's TLS), so there's nothing
# to renew. The box is outside Ireland, so it can fetch xray from GitHub directly.
#
# Tunables (env): RELAY_PORT (default 443), REALITY_SNI / REALITY_DEST (a real,
# TLS1.3 + h2 site to masquerade as; default www.microsoft.com).
#
# On success it prints the exact params to add to the Afrows relay pool.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }

PORT="${RELAY_PORT:-443}"
REALITY_SNI="${REALITY_SNI:-www.microsoft.com}"
REALITY_DEST="${REALITY_DEST:-${REALITY_SNI}:443}"

echo "==> install xray"
if [ ! -x /usr/local/bin/xray ] && ! command -v xray >/dev/null 2>&1; then
  bash -c "$(curl -fsSL https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install >/dev/null
fi
XRAY="$(command -v xray || echo /usr/local/bin/xray)"

echo "==> BBR + network tuning"
modprobe tcp_bbr 2>/dev/null || true
echo tcp_bbr > /etc/modules-load.d/afrows-bbr.conf
cat > /etc/sysctl.d/99-afrows-net.conf <<'EOF'
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_mtu_probing = 1
net.ipv4.tcp_fastopen = 3
net.ipv4.tcp_slow_start_after_idle = 0
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.ip_forward = 1
EOF
sysctl --system >/dev/null

echo "==> generate Reality keys + identity"
KP="$("$XRAY" x25519)"
PRIV="$(printf '%s\n' "$KP" | grep -iE 'private' | grep -oE '[A-Za-z0-9_-]{43,44}' | head -1)"
PUB="$(printf '%s\n' "$KP"  | grep -iE 'public'  | grep -oE '[A-Za-z0-9_-]{43,44}' | head -1)"
[ -n "$PRIV" ] && [ -n "$PUB" ] || { echo "ERROR: could not parse xray x25519 output:"; echo "$KP"; exit 1; }
SID="$(openssl rand -hex 8)"
UUID="$("$XRAY" uuid)"

echo "==> write relay config"
install -d /usr/local/etc/afrows-relay
cat > /usr/local/etc/afrows-relay/config.json <<EOF
{
  "log": { "loglevel": "warning" },
  "inbounds": [{
    "tag": "relay-in",
    "listen": "0.0.0.0",
    "port": $PORT,
    "protocol": "vless",
    "settings": { "clients": [{ "id": "$UUID" }], "decryption": "none" },
    "streamSettings": {
      "network": "tcp",
      "security": "reality",
      "realitySettings": {
        "show": false,
        "dest": "$REALITY_DEST",
        "xver": 0,
        "serverNames": ["$REALITY_SNI"],
        "privateKey": "$PRIV",
        "shortIds": ["$SID"]
      }
    }
  }],
  "outbounds": [{ "protocol": "freedom", "tag": "direct" }]
}
EOF
"$XRAY" run -test -config /usr/local/etc/afrows-relay/config.json >/dev/null

echo "==> systemd service"
cat > /etc/systemd/system/afrows-relay.service <<EOF
[Unit]
Description=Afrows relay (VLESS+Reality -> internet)
After=network-online.target
Wants=network-online.target
[Service]
ExecStart=$XRAY run -config /usr/local/etc/afrows-relay/config.json
Restart=always
RestartSec=3
LimitNOFILE=1048576
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now afrows-relay

# open the port if a firewall is active
command -v ufw >/dev/null 2>&1 && ufw allow "$PORT"/tcp >/dev/null 2>&1 || true

IP="$(curl -s4 --max-time 8 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
echo
echo "==== Afrows relay ready — add this to the pool ===="
echo "  address:     $IP"
echo "  port:        $PORT"
echo "  uuid:        $UUID"
echo "  security:    reality"
echo "  publicKey:   $PUB"
echo "  shortId:     $SID"
echo "  serverName:  $REALITY_SNI"
echo "  fingerprint: chrome"
echo "  network:     tcp"
echo "  service:     $(systemctl is-active afrows-relay)  cc=$(sysctl -n net.ipv4.tcp_congestion_control)"
