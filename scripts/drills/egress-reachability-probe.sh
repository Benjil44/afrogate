#!/usr/bin/env bash
# Egress P4 reachability probe — READ-ONLY. Answers the facts the P4 topology design
# branches on, empirically, from the VPS. Changes NOTHING: no config writes, no service
# restarts, no DB writes, no secrets printed (only exit host:port, never uuids/keys).
#
#   run on the VPS:  bash egress-reachability-probe.sh
#
# It reports:
#   Q4  which uplinks exist and which is the DIRECT (non-village) datacenter uplink
#   Q2  is that direct uplink usable / uncensored (vs the village tunnels)
#   Q3  can bought VLESS exits be reached over the DIRECT uplink (bypassing the village)
set -u
say() { printf '\n=== %s ===\n' "$*"; }
UPLINK_CFG="${AFROWS_UPLINK_CFG:-/usr/local/etc/xray/config.json}"
PROBE_URLS=("https://www.gstatic.com/generate_204" "http://cp.cloudflare.com/generate_204")

# --- Q4: interfaces, default routes, and which iface is the direct uplink ----------
say "Q4  interfaces + routes (identify direct vs village)"
ip -brief -4 addr show 2>/dev/null | grep -v '127.0.0.1' || true
echo "-- default route(s):"; ip route show default 2>/dev/null || true
DIRECT_IFACE="$(ip route show default 2>/dev/null | awk '/default/{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1); exit}}')"
echo "-- resolved DIRECT uplink iface (default route, non-wg): ${DIRECT_IFACE:-<none>}"
echo "-- village tunnels present:"; ip -brief link show 2>/dev/null | grep -iE 'wg-village|wg-germany' || echo "   (none found)"
# any second non-village global uplink?
echo "-- candidate non-village uplinks (global-scope, not wg/lo):"
ip -brief -4 addr show 2>/dev/null | awk '{print $1}' | grep -viE '^(lo|wg-)' || echo "   (only the default uplink)"

# --- Q2: is the DIRECT uplink usable / uncensored -------------------------------
say "Q2  direct-uplink usability (bound to $DIRECT_IFACE)"
if [ -z "${DIRECT_IFACE:-}" ]; then
  echo "   SKIP: no direct iface resolved"
else
  for u in "${PROBE_URLS[@]}"; do
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 8 --interface "$DIRECT_IFACE" "$u" 2>/dev/null)"
    echo "   $u -> HTTP ${code:-ERR} (204/200 = reachable)"
  done
  # a rough censorship gauge: a few foreign sites often filtered on a censored uplink
  for host in www.google.com www.youtube.com api.telegram.org; do
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 8 --interface "$DIRECT_IFACE" "https://$host" 2>/dev/null)"
    echo "   https://$host -> ${code:-ERR} (000/timeout suggests filtered/blocked on this uplink)"
  done
fi

# --- Q3: can bought VLESS exits be reached over the DIRECT uplink ----------------
say "Q3  VLESS exit reachability over the DIRECT uplink (bypassing the village)"
if [ ! -r "$UPLINK_CFG" ]; then
  echo "   SKIP: $UPLINK_CFG not readable"
elif [ -z "${DIRECT_IFACE:-}" ]; then
  echo "   SKIP: no direct iface"
else
  # Extract ONLY address:port of relay-* vless outbounds (never uuids/keys).
  mapfile -t EXITS < <(python3 - "$UPLINK_CFG" <<'PY'
import json,sys
try:
    d=json.load(open(sys.argv[1]))
except Exception as e:
    sys.exit(0)
seen=set()
for o in d.get("outbounds",[]):
    if str(o.get("tag","")).startswith("relay-") and o.get("protocol")=="vless":
        for v in o.get("settings",{}).get("vnext",[]):
            k=f'{v.get("address")}:{v.get("port")}'
            if k not in seen:
                seen.add(k); print(k)
PY
)
  if [ "${#EXITS[@]}" -eq 0 ]; then
    echo "   (no relay-* VLESS exits found in the uplink pool)"
  fi
  ok=0; total=0
  for e in "${EXITS[@]}"; do
    host="${e%:*}"; port="${e##*:}"; total=$((total+1))
    # TCP+TLS reach over the DIRECT iface. time_connect>0 = TCP reached the exit;
    # time_appconnect>0 = TLS/reality handshake completed. A connect error prints 000/0.
    read -r code tconn tapp < <(curl -s -o /dev/null \
      -w '%{http_code} %{time_connect} %{time_appconnect}' \
      -m 10 --interface "$DIRECT_IFACE" "https://$host:$port" 2>/dev/null || echo "000 0 0")
    reach="NO"
    if awk "BEGIN{exit !($tconn>0)}" 2>/dev/null; then reach="TCP-OK"; fi
    if awk "BEGIN{exit !($tapp>0)}" 2>/dev/null; then reach="TCP+TLS-OK"; fi
    [ "$reach" != "NO" ] && ok=$((ok+1))
    echo "   $host:$port  -> $reach  (connect=${tconn}s tls=${tapp}s)"
  done
  echo "   ---> $ok/$total bought VLESS exits reachable over the DIRECT uplink"
  echo "   (>=1 reachable => an independent VLESS-primary path exists => P4 code-feasible;"
  echo "    0 reachable   => VLESS is village-dependent => P4 needs a real independent uplink first)"
fi

say "DONE (read-only; nothing was changed)"
