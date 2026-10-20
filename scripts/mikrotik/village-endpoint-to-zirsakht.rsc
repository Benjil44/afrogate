# Village hAP ax3: move the Afrows tunnels from the retired server 94.74.145.199
# (مخابرات مشهد) to the new server 185.252.30.123 (زیرساخت مشهد), 2026-10-20.
# Server keys are unchanged (copied to the new server), so only the endpoint moves.
#
# Paste into the village router terminal (Winbox > New Terminal, or ssh), or run
# `/import village-endpoint-to-zirsakht.rsc` after uploading it. Safe to re-run:
# every step only touches items that still point at the old IP.
# Verify afterwards: /interface wireguard peers print  (last-handshake < 2 min)
:local old "94.74.145.199"
:local new "185.252.30.123"

# 1) WireGuard peers wg-afrows (51900) and wg-afrows-de (51903)
:foreach p in=[/interface wireguard peers find where endpoint-address=$old] do={
  /interface wireguard peers set $p endpoint-address=$new
}

# 2) per-WAN pin routes to the server (comment "afr:wg-endpoint ...")
:foreach r in=[/ip route find where dst-address=($old . "/32")] do={
  /ip route set $r dst-address=($new . "/32")
}

# 3) firewall / address-list entries that match the old server IP
:foreach x in=[/ip firewall mangle find where dst-address=$old] do={ /ip firewall mangle set $x dst-address=$new }
:foreach x in=[/ip firewall filter find where dst-address=$old] do={ /ip firewall filter set $x dst-address=$new }
:foreach x in=[/ip firewall nat find where dst-address=$old] do={ /ip firewall nat set $x dst-address=$new }
:foreach x in=[/ip firewall address-list find where address=$old] do={ /ip firewall address-list set $x address=$new }

# 4) the stale-tunnel watchdog clears conntrack entries by server IP: rewrite its source
:foreach s in=[/system script find where source~"94\\.74\\.145\\.199"] do={
  :local src [/system script get $s source]
  :local out ""
  :local i [:find $src $old]
  :while ([:typeof $i] = "num") do={
    :set out ($out . [:pick $src 0 $i] . $new)
    :set src [:pick $src ($i + [:len $old]) [:len $src]]
    :set i [:find $src $old]
  }
  /system script set $s source=($out . $src)
}

# 5) drop stale UDP flows to the old IP so the tunnels re-dial at once
:do { /ip firewall connection remove [find where dst-address~"94\\.74\\.145\\.199"] } on-error={}

:log warning "afr: Afrows endpoint moved 94.74.145.199 -> 185.252.30.123"
:put ("peers on new IP: " . [:len [/interface wireguard peers find where endpoint-address=$new]] . \
      ", routes: " . [:len [/ip route find where dst-address=($new . "/32")]])
