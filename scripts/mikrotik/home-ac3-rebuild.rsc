# =============================================================================
# HOME MikroTik hAP ac3 — FULL REBUILD after factory reset — RouterOS 7.x
# PREPARED 2026-10-06, NOT YET APPLIED ANYWHERE. Review every <CHANGE_ME> first.
# Target: RouterOS 7.24.3 (the reset unit: hAP ac^3, arm, 256 MiB RAM).
# Runbook: scripts/mikrotik/home-ac3-rebuild.md (read it before running; do the
# USA server setup + the handshake test in the runbook FIRST).
#
# PHYSICAL LAYOUT (operator, 2026-10-06):
#   ether5 = Shatel FTTH            WAN (DHCP from the ONT, or PPPoE)
#   ether2 = link to VILLAGE ax3    ether4 there. Plain link: own subnet
#                                   192.168.51.0/29, DHCP server here, Shatel
#                                   NAT only. NEVER via USA, no router mgmt,
#                                   no access to the home LAN.
#   ether1/3/4 + wifi = home LAN    bridge 192.168.50.1/24 (NOT 192.168.88.0/24:
#                                   that is the village LAN across ether2)
#
# USA VPS 93.127.140.50 (Ubuntu): wg-home 10.40.0.1/24, udp 51820 (udp 443 is
#   redirected to the same socket). This router is 10.40.0.2 and INITIATES the
#   tunnel (persistent-keepalive 25s), so the home side needs no open port.
#
# ROUTING POLICY: home LAN -> Iranian destinations (afr-iran-a/b list, weekly
#   refresh) + private/afr-direct = straight out ether5. Everything else from
#   the home LAN = routing table "to-usa" -> wg-home -> USA.
#   FAIL-OPEN by default: if the tunnel is dead (check-gateway ping 10.40.0.1),
#   to-usa falls back to Shatel. Set afrKillSwitch "yes" for fail-closed.
#   The router's OWN traffic (WireGuard to the USA endpoint, NTP, list fetch)
#   always uses the main table -> ether5, so the tunnel can never recurse.
#   Only the router's DNS queries to 1.1.1.1/8.8.8.8 are marked into to-usa.
#
# HOW TO RUN: upload via Winbox > Files, then, from a MAC-Winbox session (the
#   LAN subnet changes mid-run), in New Terminal:
#     /import file-name=home-ac3-rebuild.rsc verbose=yes
#   Use /import, not copy-paste: the guard in section 0 only aborts under
#   /import. Safe to re-run: every object it owns carries an "afr:" comment and
#   is removed + re-added; wg-home is only created if missing, so re-running
#   (and the runbook's handshake test) KEEPS the private key.
#
# WHAT IT REPLACES: the whole /ip firewall filter + nat table (incl. defconf)
#   is rebuilt. Mangle / routes / address-lists are only touched by "afr:".
# Secrets: none in this file. The USA server PUBLIC key is not a secret.
# =============================================================================

# ---- 0. SET THESE (edit before uploading) -----------------------------------
:global afrAdminPw "<CHANGE_ME_ADMIN_PASSWORD>"
# ether5 mode: "dhcp" (ONT in router mode) or "pppoe" (ONT in bridge mode)
:global afrWanMode "dhcp"
:global afrPppoeUser "<CHANGE_ME_SHATEL_PPPOE_USER>"
:global afrPppoePw "<CHANGE_ME_SHATEL_PPPOE_PASSWORD>"
# Fallback gateway, used only if DHCP has not bound yet when the routes are
# built. The DHCP-client lease script (section 5) overwrites it on every lease.
:global afrGwFallback "192.168.1.1"
# USA server wg-home PUBLIC key (runbook step 3: cat /etc/wireguard/wg-home.pub)
:global afrUsaPub "<CHANGE_ME_USA_WG_HOME_PUBKEY>"
:global afrUsaIp "93.127.140.50"
# 51820, or 443 if only 443 handshook in the runbook's test (the server answers on both)
:global afrUsaPort 51820
# Afrows server: always direct (Iranian DC, never via the USA)
:global afrAfrowsIp "94.74.145.199"
# Shatel resolvers, used by the router ONLY while the tunnel is down (netwatch,
# section 11). Confirm with the Shatel DHCP lease / support. "" = never use them.
:global afrShatelDns "85.15.1.14,85.15.1.15"
# "no" = fail-open (tunnel down -> foreign traffic leaves via plain Shatel).
# "yes" = kill switch (tunnel down -> foreign traffic is dropped).
:global afrKillSwitch "no"

# Guard: refuse to run with placeholders or on RouterOS 6.
{
  :global afrAdminPw; :global afrWanMode; :global afrPppoeUser; :global afrUsaPub; :global afrUsaPort; :global afrKillSwitch
  :if ([:pick [/system resource get version] 0 1] != "7") do={ :error "afr: RouterOS 7 required (WireGuard + routing tables)" }
  :if ($afrAdminPw ~ "CHANGE_ME") do={ :error "afr: set afrAdminPw first" }
  :if (($afrUsaPub ~ "CHANGE_ME") || ([:len $afrUsaPub] != 44)) do={ :error "afr: set afrUsaPub (44-char base64 key from the USA server)" }
  :if ($afrWanMode = "pppoe" && (($afrPppoeUser ~ "CHANGE_ME") || ($afrPppoePw ~ "CHANGE_ME"))) do={ :error "afr: set PPPoE credentials first" }
  :if ($afrWanMode != "dhcp" && $afrWanMode != "pppoe") do={ :error "afr: afrWanMode must be dhcp or pppoe" }
  :if ($afrKillSwitch != "no" && $afrKillSwitch != "yes") do={ :error "afr: afrKillSwitch must be no or yes" }
  :if ([:typeof [:tonum $afrUsaPort]] != "num") do={ :error "afr: afrUsaPort must be a number" }
}

# ---- 1. Rollback point + basics ----------------------------------------------
/system backup save name=pre-afr-rebuild dont-encrypt=yes
/system identity set name=home-ac3
/system clock set time-zone-autodetect=no time-zone-name=Asia/Tehran
# IPv6 off: it would bypass the to-usa policy and needs its own firewall.
/ipv6 settings set disable-ipv6=yes

# ---- 2. Interface lists ------------------------------------------------------
# WAN = Shatel uplink, LAN = home, VILLAGE = untrusted plain link on ether2.
{
  :if ([:len [/interface list find name=WAN]] = 0) do={ /interface list add name=WAN comment="afr: Shatel uplink" }
  :if ([:len [/interface list find name=LAN]] = 0) do={ /interface list add name=LAN comment="afr: home LAN" }
  :if ([:len [/interface list find name=VILLAGE]] = 0) do={ /interface list add name=VILLAGE comment="afr: untrusted link to village ax3" }
}

# ---- 3. Home LAN bridge: ether1/3/4 (+ wifi as defconf left it) --------------
# ether2 and ether5 come OUT of the bridge. The new LAN address is added now;
# the defconf 192.168.88.1/24 is removed only at the very end (section 14).
{
  :if ([:len [/interface bridge find name=bridge]] = 0) do={ /interface bridge add name=bridge comment="afr: home LAN bridge" }
  /interface bridge port remove [find where interface="ether2" or interface="ether5"]
  :foreach p in={"ether1";"ether3";"ether4"} do={
    :if ([:len [/interface bridge port find interface=$p]] = 0) do={ /interface bridge port add bridge=bridge interface=$p comment="afr: home LAN port" }
  }
  /ip address remove [find where comment~"^afr:(lan|village)"]
  /ip address add address=192.168.50.1/24 interface=bridge comment="afr:lan home"
  /ip address add address=192.168.51.1/29 interface=ether2 comment="afr:village link"

  # DHCP: drop defconf + our own servers/pools/networks, then re-add both.
  /ip dhcp-server remove [find where interface="bridge" or interface="ether2"]
  /ip pool remove [find where name="default-dhcp" or comment~"^afr:"]
  /ip dhcp-server network remove [find where address="192.168.88.0/24" or comment~"^afr:"]
  /ip pool add name=afr-lan ranges=192.168.50.10-192.168.50.254 comment="afr: home LAN pool"
  /ip dhcp-server add name=afr-lan interface=bridge address-pool=afr-lan comment="afr: home LAN dhcp"
  /ip dhcp-server network add address=192.168.50.0/24 gateway=192.168.50.1 dns-server=192.168.50.1 comment="afr: home LAN dhcp net"
}

# ---- 4. Village link (ether2): one lease for the village ax3 ether4 ----------
# /29 = room for the ax3 plus a laptop for debugging. Public DNS on purpose: the
# village gets no access to this router (input chain). The village ax3 already
# ignores the gateway/DNS (add-default-route=no, use-peer-dns=no on its ether4).
{
  /ip pool add name=afr-village ranges=192.168.51.2-192.168.51.6 comment="afr: village link pool"
  /ip dhcp-server add name=afr-village interface=ether2 address-pool=afr-village lease-time=1h comment="afr: village link dhcp"
  /ip dhcp-server network add address=192.168.51.0/29 gateway=192.168.51.1 dns-server=1.1.1.1,8.8.8.8 comment="afr: village link dhcp net"
}

# ---- 5. WAN on ether5 (Shatel) -------------------------------------------------
# The DHCP/PPPoE client owns the MAIN default route (distance 1). The lease
# script rewrites the gateway of every route whose comment contains "gw=ether5"
# (the to-usa fail-open fallback) and the Shatel gateway entry in afr-direct.
{
  :global afrWanMode; :global afrPppoeUser; :global afrPppoePw
  :local leaseScript ":if (\$bound=1) do={:local gw \$\"gateway-address\"; :foreach r in=[/ip route find where comment~\"gw=ether5\"] do={/ip route set \$r gateway=(\$gw . \"@main\")}; :foreach a in=[/ip firewall address-list find where comment~\"^afr:direct shatel-gw\"] do={/ip firewall address-list set \$a address=\$gw}}"
  # removes defconf (ether1) and the handshake-test client (ether5)
  /ip dhcp-client remove [find where interface="ether1" or interface="ether2" or interface="ether5"]
  :do { /interface pppoe-client remove [find name=pppoe-shatel] } on-error={}
  :if ($afrWanMode = "dhcp") do={
    /ip dhcp-client add interface=ether5 add-default-route=yes default-route-distance=1 use-peer-dns=no use-peer-ntp=no script=$leaseScript comment="afr: ether5 Shatel FTTH (dhcp)"
  } else={
    # If Shatel needs a VLAN tag, create it on ether5 and point interface= at it.
    /interface pppoe-client add name=pppoe-shatel interface=ether5 user=$afrPppoeUser password=$afrPppoePw add-default-route=yes default-route-distance=1 use-peer-dns=no disabled=no comment="afr: ether5 Shatel FTTH (pppoe)"
  }
  /interface list member remove [find where interface="ether1" or interface="ether2" or interface="ether5" or interface="pppoe-shatel" or interface="bridge" or interface="wg-home"]
  :if ($afrWanMode = "dhcp") do={ /interface list member add list=WAN interface=ether5 comment="afr:" } else={ /interface list member add list=WAN interface=pppoe-shatel comment="afr:" }
  /interface list member add list=LAN interface=bridge comment="afr:"
  /interface list member add list=VILLAGE interface=ether2 comment="afr:"
}

# ---- 6. Resolve the current Shatel gateway (wait for the lease) ---------------
:delay 15s
:global afrGw ""
{
  :global afrWanMode; :global afrGwFallback; :global afrGw
  :if ($afrWanMode = "dhcp") do={
    :local g [/ip dhcp-client get [find interface=ether5] gateway]
    :if ([:len $g] > 0) do={ :set afrGw $g } else={ :set afrGw $afrGwFallback; :put "afr: WARNING ether5 DHCP not bound, using fallback $afrGwFallback (lease script fixes it later)" }
  } else={ :set afrGw "pppoe-shatel" }
  :put ("afr: Shatel gateway = " . $afrGw)
}

# ---- 7. WireGuard to the USA (router initiates) --------------------------------
# Created only if missing -> re-running keeps the private key. RouterOS makes
# the key itself; it never leaves the router. MTU 1380 under PPPoE (1492), 1420
# otherwise. allowed-address=0.0.0.0/0 adds NO routes in RouterOS (section 8 does).
{
  :global afrWanMode; :global afrUsaIp; :global afrUsaPub; :global afrUsaPort
  :local mtu 1420
  :if ($afrWanMode = "pppoe") do={ :set mtu 1380 }
  :if ([:len [/interface wireguard find name=wg-home]] = 0) do={
    /interface wireguard add name=wg-home listen-port=51830 mtu=$mtu comment="afr: home -> USA 93.127.140.50 wg-home"
  }
  /interface wireguard set [find name=wg-home] mtu=$mtu
  /interface wireguard peers remove [find where comment~"^afr:peer"]
  /interface wireguard peers add interface=wg-home public-key=$afrUsaPub endpoint-address=$afrUsaIp endpoint-port=[:tonum $afrUsaPort] \
      allowed-address=0.0.0.0/0 persistent-keepalive=25s comment=("afr:peer wg-home -> " . $afrUsaIp . ":" . $afrUsaPort)
  /ip address remove [find where comment~"^afr:wg"]
  /ip address add address=10.40.0.2/24 interface=wg-home comment="afr:wg home"
}

# ---- 8. Routing table to-usa (policy routing for foreign traffic) ------------
# Main table: Shatel default from the DHCP/PPPoE client (unchanged by mangle).
# to-usa:  d1 via 10.40.0.1 (wg-home), check-gateway=ping -> inactive ~20s after
#            the tunnel stops answering.
#          d2 via Shatel  = FAIL-OPEN fallback   (disabled when kill switch on)
#          d3 blackhole   = KILL SWITCH          (disabled when kill switch off)
# Gateways are resolved in the main table (@main).
{
  :global afrWanMode; :global afrGw; :global afrKillSwitch
  :if ([:len [/routing table find name=to-usa]] = 0) do={ /routing table add name=to-usa fib comment="afr: foreign traffic via USA" }
  /ip route remove [find where comment~"^afr:"]
  :local fbGw $afrGw
  :if ($afrWanMode = "dhcp") do={ :set fbGw ($afrGw . "@main") }
  :local fbDisabled "no"
  :local bhDisabled "yes"
  :if ($afrKillSwitch = "yes") do={ :set fbDisabled "yes"; :set bhDisabled "no" }
  /ip route add dst-address=0.0.0.0/0 gateway="10.40.0.1@main" routing-table=to-usa distance=1 check-gateway=ping comment="afr:usa default via wg-home"
  /ip route add dst-address=0.0.0.0/0 gateway=$fbGw routing-table=to-usa distance=2 disabled=$fbDisabled comment="afr:usa fail-open fallback via Shatel gw=ether5"
  /ip route add dst-address=0.0.0.0/0 blackhole routing-table=to-usa distance=3 disabled=$bhDisabled comment="afr:usa kill-switch blackhole"
}

# ---- 9. Address lists ------------------------------------------------------------
# afr-direct (static, each entry has a purpose) + afr-iran-a/b (fetched weekly,
# section 12; only one of the two is active, the mangle rule points at it).
# afr-dns-tunnel = the router's own resolvers, forced through the tunnel.
{
  :global afrAfrowsIp; :global afrUsaIp; :global afrGw; :global afrWanMode
  /ip firewall address-list remove [find where comment~"^afr:(direct|dns)"]
  :foreach n in={"10.0.0.0/8";"172.16.0.0/12";"192.168.0.0/16";"100.64.0.0/10";"169.254.0.0/16";"224.0.0.0/4"} do={
    /ip firewall address-list add list=afr-direct address=$n comment="afr:direct private/cgnat/multicast"
  }
  /ip firewall address-list add list=afr-direct address=$afrAfrowsIp comment="afr:direct Afrows server (Iranian DC)"
  /ip firewall address-list add list=afr-direct address=$afrUsaIp comment="afr:direct USA VPS public IP (no WG-in-WG)"
  :if ($afrWanMode = "dhcp") do={
    :do { /ip firewall address-list add list=afr-direct address=$afrGw comment="afr:direct shatel-gw" } on-error={}
  }
  /ip firewall address-list add list=afr-dns-tunnel address=1.1.1.1 comment="afr:dns router resolver"
  /ip firewall address-list add list=afr-dns-tunnel address=8.8.8.8 comment="afr:dns router resolver"
}

# ---- 10. Firewall (filter + nat rebuilt from scratch; mangle by comment) -------
# Keep whichever Iran list is currently active across re-runs.
:global afrIranActive "afr-iran-a"
{
  :global afrIranActive
  :local r [/ip firewall mangle find where comment~"^afr:mangle iran-list"]
  :if ([:len $r] > 0) do={ :set afrIranActive [/ip firewall mangle get ($r->0) dst-address-list] }
}
/ip firewall filter remove [find where dynamic=no]
/ip firewall nat remove [find where dynamic=no]
/ip firewall mangle remove [find where comment~"^afr:"]

/ip firewall filter
# --- input: what may talk TO the router ---
add chain=input connection-state=established,related,untracked action=accept comment="afr:in accept established/related (WG replies)"
add chain=input connection-state=invalid action=drop comment="afr:in drop invalid"
add chain=input protocol=icmp action=accept comment="afr:in accept icmp (ping/PMTU)"
add chain=input in-interface=ether2 protocol=udp dst-port=67 action=accept comment="afr:in village DHCP only (lease renewals)"
add chain=input in-interface-list=LAN action=accept comment="afr:in accept home LAN (192.168.50.0/24)"
add chain=input action=drop comment="afr:in drop rest (WAN, village ether2, wg-home)"
# --- forward: what may pass THROUGH the router ---
# Fasttrack only flows that need no routing mark (afr-direct + village). Marked
# afr-usa flows must stay in the slow path or they would skip mark-routing.
add chain=forward connection-state=established,related connection-mark=afr-direct action=fasttrack-connection comment="afr:fwd fasttrack home->Iran/direct"
add chain=forward connection-state=established,related connection-mark=no-mark action=fasttrack-connection comment="afr:fwd fasttrack village (unmarked)"
add chain=forward connection-state=established,related,untracked action=accept comment="afr:fwd accept established/related"
add chain=forward connection-state=invalid action=drop comment="afr:fwd drop invalid"
add chain=forward in-interface-list=LAN out-interface=wg-home action=accept comment="afr:fwd home LAN -> USA tunnel"
add chain=forward in-interface-list=LAN out-interface-list=WAN action=accept comment="afr:fwd home LAN -> Shatel (Iran direct + fail-open)"
add chain=forward in-interface-list=VILLAGE out-interface-list=WAN action=accept comment="afr:fwd village -> Shatel ONLY"
add chain=forward action=drop comment="afr:fwd drop rest (village<->home, village->tunnel, inbound)"

/ip firewall nat
add chain=srcnat out-interface-list=WAN action=masquerade comment="afr:nat masquerade out Shatel"
add chain=srcnat out-interface=wg-home action=masquerade comment="afr:nat masquerade into wg-home (USA sees only 10.40.0.2)"

# Home LAN: classify each connection ONCE (the connection-mark sticks, so a
# list swap never re-routes live flows). Order matters: direct, Iran, rest.
# The router's own DNS queries to 1.1.1.1/8.8.8.8 are routed through the tunnel.
{
  :global afrIranActive
  /ip firewall mangle add chain=prerouting in-interface=bridge connection-mark=no-mark dst-address-list=afr-direct action=mark-connection new-connection-mark=afr-direct passthrough=yes comment="afr:mangle direct static"
  /ip firewall mangle add chain=prerouting in-interface=bridge connection-mark=no-mark dst-address-list=$afrIranActive action=mark-connection new-connection-mark=afr-direct passthrough=yes comment="afr:mangle iran-list (swapped by afr-iran-update)"
  /ip firewall mangle add chain=prerouting in-interface=bridge connection-mark=no-mark dst-address-type=!local action=mark-connection new-connection-mark=afr-usa passthrough=yes comment="afr:mangle everything else -> usa"
  /ip firewall mangle add chain=prerouting in-interface=bridge connection-mark=afr-usa action=mark-routing new-routing-mark=to-usa passthrough=no comment="afr:mangle route afr-usa via to-usa"
  /ip firewall mangle add chain=output dst-address-list=afr-dns-tunnel protocol=udp dst-port=53 action=mark-routing new-routing-mark=to-usa passthrough=no comment="afr:mangle router DNS udp via to-usa"
  /ip firewall mangle add chain=output dst-address-list=afr-dns-tunnel protocol=tcp dst-port=53 action=mark-routing new-routing-mark=to-usa passthrough=no comment="afr:mangle router DNS tcp via to-usa"
  /ip firewall mangle add chain=forward protocol=tcp tcp-flags=syn action=change-mss new-mss=clamp-to-pmtu passthrough=yes comment="afr:mss clamp (wg-home 1420/1380, PPPoE 1492)"
}

# ---- 11. DNS + NTP + tunnel netwatch --------------------------------------------
# Resolver: 1.1.1.1 / 8.8.8.8 via the tunnel (section 10). Shatel DNS is added
# by the netwatch ONLY while 10.40.0.1 is unreachable, then removed again.
# NTP goes direct (main table): WireGuard needs a sane clock after power loss.
/ip dns set servers=1.1.1.1,8.8.8.8 allow-remote-requests=yes
/ip dns static remove [find where name="router.lan" or comment~"^afr:"]
/ip dns static add name=router.lan address=192.168.50.1 comment="afr: router"
/system ntp client set enabled=yes mode=unicast
/system ntp client servers remove [find]
/system ntp client servers add address=ir.pool.ntp.org
/system ntp client servers add address=time.cloudflare.com
/system ntp client servers add address=pool.ntp.org
{
  :global afrShatelDns; :global afrKillSwitch
  :local mode "FAIL-OPEN via plain Shatel"
  :if ($afrKillSwitch = "yes") do={ :set mode "BLOCKED (kill switch)" }
  :local down (":log warning \"afr: wg-home tunnel DOWN, foreign traffic now " . $mode . "\"")
  :local up ":log info \"afr: wg-home tunnel UP, foreign traffic via USA\"; /ip dns set servers=1.1.1.1,8.8.8.8"
  :if ([:len $afrShatelDns] > 0) do={ :set down ($down . "; /ip dns set servers=1.1.1.1,8.8.8.8," . $afrShatelDns) }
  /tool netwatch remove [find where comment~"^afr:"]
  /tool netwatch add host=10.40.0.1 interval=30s timeout=2s comment="afr:watch wg-home tunnel" down-script=$down up-script=$up
}

# ---- 12. Iran CIDR list: weekly atomic refresh ----------------------------------
# Sources (RIPE-derived, plain "a.b.c.d/nn" per line, '#' comments skipped):
#   1. github ipverse/rir-ip  country/ir/ipv4-aggregated.txt  (~2,300 lines, ~33 KB)
#   2. ipdeny.com  aggregated/ir-aggregated.zone              (~2,100 lines, mirror)
# Fills the INACTIVE list (afr-iran-a <-> afr-iran-b), sanity-checks the count
# (1000..10000, prefix /8../32), then repoints the mangle rule and clears the
# old list. A failed or partial fetch never touches the active list.
# ~2,300 static entries use well under 1 MB; this unit reports 256 MiB RAM
# (180 MiB free) and 128 MiB flash (98 MiB free) on RouterOS 7.24.3.
/system scheduler remove [find where name~"^afr-iran-(update|retry)"]
/system script remove [find where name="afr-iran-update"]
/system script add name=afr-iran-update policy=read,write,policy,test comment="afr: refresh Iranian CIDR list (atomic a/b swap)" source={
:local urls {"https://raw.githubusercontent.com/ipverse/rir-ip/master/country/ir/ipv4-aggregated.txt";"https://www.ipdeny.com/ipblocks/data/aggregated/ir-aggregated.zone"}
:local rule [/ip firewall mangle find where comment~"^afr:mangle iran-list"]
:if ([:len $rule] = 0) do={ :log error "afr-iran-update: mangle iran-list rule missing"; :error "afr: no rule" }
:set rule ($rule->0)
:local active [/ip firewall mangle get $rule dst-address-list]
:local next "afr-iran-a"
:if ($active = "afr-iran-a") do={ :set next "afr-iran-b" }
:local data ""
:foreach u in=$urls do={
  :if ([:len $data] = 0) do={
    :do {
      :local r [/tool fetch url=$u output=user as-value]
      :if (($r->"status") = "finished" && [:len ($r->"data")] > 10000) do={ :set data ($r->"data") } else={ :log warning ("afr-iran-update: short/failed fetch " . $u) }
    } on-error={ :log warning ("afr-iran-update: fetch error " . $u) }
  }
}
:if ([:len $data] = 0) do={ :log error "afr-iran-update: all sources failed, keeping $active"; :error "afr: fetch failed" }
/ip firewall address-list remove [find where list=$next]
:local n 0
:local bad 0
:local pos 0
:local len [:len $data]
:while ($pos < $len) do={
  :local eol [:find $data "\n" $pos]
  :if ([:typeof $eol] = "nil") do={ :set eol $len }
  :local line [:pick $data $pos $eol]
  :set pos ($eol + 1)
  :if ([:len $line] > 0 && [:pick $line ([:len $line] - 1)] = "\r") do={ :set line [:pick $line 0 ([:len $line] - 1)] }
  :if ([:len $line] > 0 && [:pick $line 0 1] != "#") do={
    :local s [:find $line "/"]
    :local ok false
    :if ([:typeof $s] = "num") do={
      :local pfx [:tonum [:pick $line ($s + 1) [:len $line]]]
      :if ([:typeof [:toip [:pick $line 0 $s]]] = "ip" && [:typeof $pfx] = "num" && $pfx >= 8 && $pfx <= 32) do={ :set ok true }
    }
    :if ($ok) do={
      :do { /ip firewall address-list add list=$next address=$line comment="afr:iran"; :set n ($n + 1) } on-error={ :set bad ($bad + 1) }
    } else={ :set bad ($bad + 1) }
  }
}
:if ($n < 1000 || $n > 10000) do={
  /ip firewall address-list remove [find where list=$next]
  :log error ("afr-iran-update: implausible count " . $n . " (bad " . $bad . "), keeping " . $active)
  :error "afr: bad list"
}
/ip firewall mangle set $rule dst-address-list=$next
/ip firewall address-list remove [find where list=$active]
:log info ("afr-iran-update: " . $n . " Iranian prefixes now in " . $next . " (skipped " . $bad . ")")
}
/system scheduler add name=afr-iran-update interval=7d start-time=04:10:00 on-event="/system script run afr-iran-update" policy=read,write,policy,test comment="afr: weekly Iran list refresh"
# Retry hourly (and at boot) while the active list is empty/too small.
/system scheduler add name=afr-iran-retry interval=1h start-time=startup policy=read,write,policy,test comment="afr: retry Iran list until loaded" \
    on-event=":delay 60s; :local r [/ip firewall mangle find where comment~\"^afr:mangle iran-list\"]; :if ([:len \$r] > 0) do={:local l [/ip firewall mangle get (\$r->0) dst-address-list]; :if ([:len [/ip firewall address-list find where list=\$l]] < 1000) do={/system script run afr-iran-update}}"
:put "afr: loading the Iran list now (up to ~2 min)..."
:do { /system script run afr-iran-update } on-error={ :put "afr: WARNING Iran list not loaded yet (afr-iran-retry retries hourly). Until then ALL home traffic goes via USA." }

# ---- 13. Management surface + users ---------------------------------------------
# Only the home LAN. Nothing manages this router remotely: no REST user, no api.
/ip service
set telnet disabled=yes
set ftp disabled=yes
set api disabled=yes
set api-ssl disabled=yes
set www-ssl disabled=yes
set ssh disabled=no address=192.168.50.0/24
set www disabled=no address=192.168.50.0/24
set winbox disabled=no address=192.168.50.0/24
/ip ssh set strong-crypto=yes
/tool mac-server set allowed-interface-list=LAN
/tool mac-server mac-winbox set allowed-interface-list=LAN
/ip neighbor discovery-settings set discover-interface-list=LAN
/tool bandwidth-server set enabled=no
/ip proxy set enabled=no
/ip socks set enabled=no
/ip upnp set enabled=no
{
  :global afrAdminPw
  /user set [find name=admin] password=$afrAdminPw
}

# ---- 14. LAN cut-over: drop the defconf 192.168.88.1/24 ------------------------
# Your PC loses its 192.168.88.x IP here; the MAC-Winbox session keeps working.
# Renew the PC's DHCP lease afterwards: it gets 192.168.50.x.
/ip address remove [find where address="192.168.88.1/24"]

# ---- 15. Output -------------------------------------------------------------------
:delay 2s
:put "=================================================================="
:put ("afr: wg-home (10.40.0.2) router pubkey: " . [/interface wireguard get [find name=wg-home] public-key])
:put "afr: if this key differs from the one in the USA [Peer], swap it there (runbook step 3c)."
:put ("afr: Iran list in use: " . [/ip firewall mangle get ([/ip firewall mangle find where comment~"^afr:mangle iran-list"]->0) dst-address-list])
:put "=================================================================="
/system script environment remove [find where name~"^afr(AdminPw|PppoePw)\$"]
