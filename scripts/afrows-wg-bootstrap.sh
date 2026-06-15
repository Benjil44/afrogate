#!/usr/bin/env bash
# Afrows WireGuard server bootstrap (run ONCE as root on a fresh VPS).
#
# Sets up the kernel WireGuard egress used by the mobile app:
#   - wg0 (10.8.0.1/24, UDP 51822) with TPROXY egress wired into wg0.conf PostUp
#     so it persists across reboots and is scoped to wg0
#   - net.ipv4.ip_forward
#   - the AFROWS_WG_* delivery env in /etc/afrows/afrows.env (server PUBLIC key +
#     endpoint), which the backend uses to render client .conf files
#   - the reconciler/units/sudoers (delegated to update-afrows.sh on each deploy)
#
# PREREQUISITE (not handled here): the `afrows-wg` xray service must provide the
# TPROXY sink + Germany egress — a dokodemo-door `tproxy-in` on 127.0.0.1:12345
# (sockopt tproxy) routed to the `proxy` outbound. That's part of the xray setup.
#
# Idempotent: safe to re-run; it won't clobber an existing wg0.conf or env.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }

IFACE=wg0
SUBNET_CIDR=10.8.0.1/24
LISTEN_PORT=51822
TPROXY_PORT=12345
ENV_FILE=/etc/afrows/afrows.env
PUBLIC_IP="$(curl -s --max-time 8 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"

echo "==> install wireguard-tools"
command -v wg >/dev/null 2>&1 || { apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y wireguard-tools; }

echo "==> ip forwarding"
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-afrows-wg.conf
sysctl -w net.ipv4.ip_forward=1 >/dev/null

echo "==> server keys"
umask 077; mkdir -p /etc/wireguard
[ -f /etc/wireguard/server.key ] || wg genkey | tee /etc/wireguard/server.key | wg pubkey > /etc/wireguard/server.pub
SERVER_PUB="$(cat /etc/wireguard/server.pub)"

echo "==> $IFACE config (TPROXY in PostUp so it persists + is scoped to $IFACE)"
if [ -f "/etc/wireguard/$IFACE.conf" ]; then
  echo "   /etc/wireguard/$IFACE.conf exists — leaving as-is"
else
  cat > "/etc/wireguard/$IFACE.conf" <<EOF
[Interface]
Address = $SUBNET_CIDR
ListenPort = $LISTEN_PORT
PrivateKey = $(cat /etc/wireguard/server.key)
Table = off
PostUp = sysctl -w net.ipv4.ip_forward=1; modprobe xt_TPROXY 2>/dev/null || true; ip rule add fwmark 1 lookup 100 2>/dev/null || true; ip route replace local default dev lo table 100; iptables -t mangle -N AFROWS_WG 2>/dev/null || true; iptables -t mangle -F AFROWS_WG; iptables -t mangle -A AFROWS_WG -p tcp -j TPROXY --on-port $TPROXY_PORT --tproxy-mark 1; iptables -t mangle -A AFROWS_WG -p udp -j TPROXY --on-port $TPROXY_PORT --tproxy-mark 1; iptables -t mangle -C PREROUTING -i %i -j AFROWS_WG 2>/dev/null || iptables -t mangle -A PREROUTING -i %i -j AFROWS_WG
PostDown = iptables -t mangle -D PREROUTING -i %i -j AFROWS_WG 2>/dev/null || true; iptables -t mangle -F AFROWS_WG 2>/dev/null || true; iptables -t mangle -X AFROWS_WG 2>/dev/null || true; ip rule del fwmark 1 lookup 100 2>/dev/null || true
EOF
  chmod 600 "/etc/wireguard/$IFACE.conf"
fi

echo "==> bring up + enable $IFACE"
systemctl enable "wg-quick@$IFACE" >/dev/null 2>&1 || true
wg-quick up "$IFACE" 2>/dev/null || systemctl restart "wg-quick@$IFACE" || true

echo "==> AFROWS_WG_* delivery env"
mkdir -p "$(dirname "$ENV_FILE")"; touch "$ENV_FILE"
if grep -q '^AFROWS_WG_SERVER_PUBLIC_KEY=' "$ENV_FILE"; then
  echo "   AFROWS_WG_* already set — leaving as-is"
else
  cat >> "$ENV_FILE" <<EOF
# --- Afrows native WireGuard delivery (public params; server PUBLIC key only) ---
AFROWS_WG_SERVER_PUBLIC_KEY=$SERVER_PUB
AFROWS_WG_ENDPOINT=$PUBLIC_IP:$LISTEN_PORT
AFROWS_WG_DNS=1.1.1.1
AFROWS_WG_SUBNET=10.8.0.0/24
AFROWS_WG_INTERFACE=$IFACE
AFROWS_WG_ADDRESS_START=16
AFROWS_WG_KEEPALIVE=25
AFROWS_WG_MTU=1280
AFROWS_WG_ALLOWED_IPS=0.0.0.0/0
EOF
  echo "   wrote AFROWS_WG_* (endpoint $PUBLIC_IP:$LISTEN_PORT) — restart afrows-backend to load"
fi

echo "==> reconciler infra (also ensured on every deploy by update-afrows.sh)"
REPO=/opt/afrows
if [ -f "$REPO/scripts/afrows-wg-reconcile.sh" ]; then
  sed 's/\r$//' "$REPO/scripts/afrows-wg-reconcile.sh" > /usr/local/sbin/afrows-wg-reconcile.sh; chmod 0755 /usr/local/sbin/afrows-wg-reconcile.sh
  sed 's/\r$//' "$REPO/scripts/systemd/afrows-wg-reconcile.service" > /etc/systemd/system/afrows-wg-reconcile.service
  sed 's/\r$//' "$REPO/scripts/systemd/afrows-wg-reconcile.timer" > /etc/systemd/system/afrows-wg-reconcile.timer
  TMP="$(mktemp)"; sed 's/\r$//' "$REPO/scripts/systemd/afrows-wg-reconcile.sudoers" > "$TMP"; visudo -cf "$TMP" >/dev/null 2>&1 && install -m 0440 "$TMP" /etc/sudoers.d/afrows-wg; rm -f "$TMP"
  systemctl daemon-reload; systemctl enable --now afrows-wg-reconcile.timer
fi

echo "==> done. wg show $IFACE:"; wg show "$IFACE" 2>/dev/null | sed -E 's#(private key:).*#\1 <hidden>#' || true
