#!/usr/bin/env bash
# Afrows WireGuard reconciler (runs as ROOT on a systemd timer).
#
# The backend runs unprivileged and only writes the desired peer state into the
# `wireguard_peers` table. This script is the ONLY component that touches wg0:
#   1) applies desired peers to wg0  (wg set ... allowed-ips / remove)
#   2) writes live usage back        (wg show <iface> dump -> rx/tx/handshake)
#
# The DB is the source of truth: every run re-applies all 'present' peers, so
# peers survive a reboot (wg-quick@wg0 restores the static conf, then this timer
# re-adds the DB peers within one interval). It never rewrites wg0.conf, so the
# statically-configured peers (e.g. the MikroTik gateway) are left untouched.
set -euo pipefail

ENV_FILE="${AFROWS_ENV_FILE:-/etc/afrows/afrows.env}"
IFACE="$(grep -h '^AFROWS_WG_INTERFACE=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' | tr -d '"')"
IFACE="${IFACE:-wg0}"
DBURL="$(grep -h '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r')"
[ -n "$DBURL" ] || { echo "afrows-wg-reconcile: DATABASE_URL not found in $ENV_FILE" >&2; exit 1; }

# Bail quietly if the interface isn't up yet (e.g. before wg-quick@wg0 starts).
wg show "$IFACE" >/dev/null 2>&1 || { echo "afrows-wg-reconcile: $IFACE not up yet" >&2; exit 0; }

q() { psql "$DBURL" -At -F '|' -c "$1"; }

# 1) APPLY: add/update peers marked present
while IFS='|' read -r pub addr; do
  [ -n "$pub" ] || continue
  wg set "$IFACE" peer "$pub" allowed-ips "$addr"
done < <(q "SELECT client_public_key, client_address FROM wireguard_peers WHERE interface='$IFACE' AND desired_state='present';")

# 1b) REMOVE peers marked absent
while IFS='|' read -r pub; do
  [ -n "$pub" ] || continue
  wg set "$IFACE" peer "$pub" remove 2>/dev/null || true
done < <(q "SELECT client_public_key FROM wireguard_peers WHERE interface='$IFACE' AND desired_state='absent';")

# 2) METER: wg show dump -> per-peer usage. dump columns (peer lines):
#    pubkey  psk  endpoint  allowed-ips  latest-handshake  rx  tx  keepalive
wg show "$IFACE" dump | tail -n +2 | while IFS=$'\t' read -r pub _psk _ep _allowed hs rx tx _ka; do
  [ -n "$pub" ] || continue
  hs_sql="NULL"; [ "${hs:-0}" != "0" ] && hs_sql="to_timestamp($hs)"
  psql "$DBURL" -q -c "UPDATE wireguard_peers SET rx_bytes=${rx:-0}, tx_bytes=${tx:-0}, last_handshake_at=$hs_sql, updated_at=now() WHERE interface='$IFACE' AND client_public_key=$$${pub}$$;"
done

# 2b) roll per-peer usage into the owning client_configs.used_bytes (rx+tx)
psql "$DBURL" -q -c "
  UPDATE client_configs cc
  SET used_bytes = wp.rx_bytes + wp.tx_bytes, updated_at = now()
  FROM wireguard_peers wp
  WHERE wp.client_config_id = cc.id AND wp.interface = '$IFACE';
"
