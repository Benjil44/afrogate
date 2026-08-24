#!/usr/bin/env bash
# Afrows egress SPEED diagnostic — READ-ONLY. Run on the VPS to localize the bottleneck
# on the client -> VPS -> VLESS-exit path when Afrows is slower than a direct VLESS exit.
# Changes NOTHING (no config writes, no restarts, no secrets printed).
#
#   bash egress-speed-diagnose.sh
set -u
say() { printf '\n=== %s ===\n' "$*"; }
AFXRAY="${AFROWS_XRAY_CFG:-/usr/local/etc/afrows-xray/config.json}"
UPLINK="${AFROWS_UPLINK_CFG:-/usr/local/etc/xray/config.json}"
DL="https://speed.cloudflare.com/__down?bytes=25000000"   # 25 MB throughput probe

# --- 1) ENTRY: is the client-facing inbound CDN-fronted or a raw-IP:443? ----------
say "1) ENTRY inbound (afrows-xray) — raw-IP vs CDN/reality decides ISP throttling"
if [ -r "$AFXRAY" ]; then
  python3 - "$AFXRAY" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
for ib in d.get("inbounds",[]):
    ss=ib.get("streamSettings",{}) or {}
    host=""
    ws=ss.get("wsSettings") or ss.get("httpupgradeSettings") or ss.get("grpcSettings") or {}
    host=(ws.get("headers",{}) or {}).get("Host","") or ws.get("host","") or (ss.get("realitySettings",{}) or {}).get("serverNames","") or (ss.get("tlsSettings",{}) or {}).get("serverName","")
    print(f"  port={ib.get('port')} proto={ib.get('protocol')} net={ss.get('network')} sec={ss.get('security')} host/SNI={host or '(none - RAW IP)'}")
PY
  echo "  -> if sec=none/tls on a raw IP with no Host/SNI, the censor throttles this entry."
  echo "     the fast DIRECT exits use CDN domains (Cloudflare) — that is why they are ~10x faster."
else
  echo "  (afrows-xray config not readable at $AFXRAY)"
fi

# --- 2) MTU/MSS on the tunnels (wrong MTU => fragmentation => throughput collapse) -
say "2) MTU on wg / afrows interfaces (a too-high MTU on a tunnel kills throughput)"
ip -brief link show 2>/dev/null | grep -iE 'wg-|afrows' || echo "  (no wg-/afrows interfaces)"
echo "  -> wg over the internet usually needs MTU ~1380-1420; MSS should be clamped. 1500 on a tunnel = fragmentation."

# --- 3) EGRESS legs: VPS throughput out each path -------------------------------
say "3) EGRESS throughput from the VPS (which path is the bottleneck?)"
def_iface="$(ip route show default 2>/dev/null | awk '/default/{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1);exit}}')"
for probe in "direct:$def_iface" "village:wg-village" "germany:wg-village-de"; do
  name="${probe%%:*}"; ifc="${probe##*:}"
  if [ -n "$ifc" ] && ip link show "$ifc" >/dev/null 2>&1; then
    mb="$(curl -s -o /dev/null --interface "$ifc" -m 25 -w '%{speed_download}' "$DL" 2>/dev/null)"
    mbps="$(awk "BEGIN{printf \"%.1f\", ($mb*8/1000000)}" 2>/dev/null)"
    echo "  $name ($ifc): ${mbps:-ERR} Mbps down"
  else
    echo "  $name ($ifc): interface absent"
  fi
done
echo "  -> compare to the client's through-Afrows SpeedTest; if a leg here is already slow, that leg is the cap."

# --- 4) VPS -> VLESS exit RTT (is the exit near, or a detour?) --------------------
say "4) latency VPS -> the pool's VLESS exits (high RTT = a detour or a far/slow exit)"
if [ -r "$UPLINK" ]; then
  python3 - "$UPLINK" <<'PY' | while read host; do
import json,sys
d=json.load(open(sys.argv[1]))
seen=set()
for o in d.get("outbounds",[]):
    if str(o.get("tag","")).startswith("relay-") and o.get("protocol")=="vless":
        for v in o.get("settings",{}).get("vnext",[]):
            a=v.get("address")
            if a and a not in seen: seen.add(a); print(a)
PY
    r="$(ping -c 3 -W 2 "$host" 2>/dev/null | awk -F'/' '/rtt|round-trip/{print $5" ms avg"}')"
    echo "  relay $host -> ${r:-no ICMP (may be normal)}"
  done
else
  echo "  (uplink pool config not readable at $UPLINK)"
fi

# --- 5) which relays are selected + pool basis (P3) ------------------------------
say "5) pool selection (did P3 pick a fast, healthy relay?)"
journalctl -u afrows-uplink-pool-sync --since '30 min ago' 2>/dev/null | tail -6 || echo "  (no journal)"

say "READ-ONLY DONE — nothing changed. Report sections 1-5 back for the fix."
