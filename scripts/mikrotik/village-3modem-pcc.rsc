# =============================================================================
# Village 3-modem load-balancing (PCC) — RouterOS 7.x, hAP ax3
# DRAFT / REVIEW BEFORE APPLYING. Not yet tested on the live router.
# Implements docs/superpowers/plans/2026-06-18-village-3modem-aggregation.md.
#
# GOAL: spread many parallel user connections across all 3 LTE modems so ~150
# users use ~50 per modem in parallel (no single-modem queue). This raises
# AGGREGATE throughput for parallel flows + survives any single SIM dying. It
# does NOT speed up a single stream (independent CGNAT LTE ISPs can't be bonded).
#
# TOPOLOGY (operator-corrected 2026-07-24 — VERIFY gateways/tunnel-ports live via
#   `/ip dhcp-client print` and `/interface wireguard print` before applying; the
#   old docs listed different modems, so the gw IPs below are UNCONFIRMED):
#   m1  Irelandcell-227 ether1  gw <VERIFY>  tunnel wg-afr1 (udp 51900)  BACKUP
#   m2  Irelandcell-228 ether2  gw <VERIFY>  tunnel wg-afr2 (udp 51902)  BEST latency -> gaming pin
#   m3  Irelandcell-229 ether5  gw <VERIFY>  tunnel wg-afr3 (udp 51903)  BACKUP
#   ether3 = LAN 192.168.88.1/24 (diag) ; ether4 = Starlink (untouched)
#   Afrows VPS = 94.74.145.199 ; gw placeholders below use the OLD doc values —
#   replace after reading the live dhcp-client gateways.
#
# PREREQUISITES (do these FIRST — this script assumes they exist):
#   1. The 3 modem-pinned WireGuard tunnels wg-afr1/wg-afr2/wg-afr3 exist and
#      handshake (Phase 1 of the plan; built on the Afrows side as wg-vil1/2/3).
#   2. Afrows ECMPs user egress across wg-vil1/2/3 (Phase 2 upload direction).
#   3. You have a SECOND way in (Germany 10.9.0.2) in case a rule cuts access.
#
# SAFETY: additive + scoped; never touches wg-germany / friends' tunnels. Wrap the
# apply in safe-mode (Winbox: press Ctrl-X before pasting; auto-reverts if your
# session drops). A backup is taken first. Replace every <PLACEHOLDER> after
# verifying against the live config (interface names, gateways, gaming source IPs).
# =============================================================================

# ---- 0. Backup first (rollback point) --------------------------------------
/system backup save name=("pre-3modem-pcc-" . [/system clock get date])
/export file=("pre-3modem-pcc-" . [/system clock get date])

# ---- 1. Per-modem routing tables -------------------------------------------
/routing table
add name=to-m1 fib comment="afrows-3modem: Mobinnet/ether1"
add name=to-m2 fib comment="afrows-3modem: Irelandcell-228/ether2"
add name=to-m3 fib comment="afrows-3modem: Irelandcell-227/ether5"

# ---- 2. Per-modem default routes (check-gateway pulls a dead link) ----------
/ip route
add dst-address=0.0.0.0/0 gateway=192.168.8.1  routing-table=to-m1 check-gateway=ping comment="afrows-3modem m1"
add dst-address=0.0.0.0/0 gateway=192.168.9.1  routing-table=to-m2 check-gateway=ping comment="afrows-3modem m2"
add dst-address=0.0.0.0/0 gateway=192.168.12.1 routing-table=to-m3 check-gateway=ping comment="afrows-3modem m3"

# ---- 3. Masquerade each modem uplink (NAT so return stays on the same modem) -
# Skip any that already exist (check /ip firewall nat first). srcnat by out-interface.
/ip firewall nat
add chain=srcnat out-interface=ether1 action=masquerade comment="afrows-3modem nat m1"
add chain=srcnat out-interface=ether2 action=masquerade comment="afrows-3modem nat m2"
add chain=srcnat out-interface=ether5 action=masquerade comment="afrows-3modem nat m3"

# ---- 4. Pin the 3 Afrows WG tunnels, one per modem (THE core aggregation) ----
# Each tunnel's OUTER udp (to the same Afrows IP, distinguished by dst-port) is
# forced out its modem, so the 3 tunnels ride 3 modems. Afrows ECMPs users across
# them, giving ~3x aggregate uplink. output chain = router-originated (the tunnels).
/ip firewall mangle
add chain=output protocol=udp dst-address=94.74.145.199 dst-port=51900 action=mark-routing new-routing-mark=to-m1 passthrough=no comment="afrows-3modem pin wg-afr1->m1"
add chain=output protocol=udp dst-address=94.74.145.199 dst-port=51902 action=mark-routing new-routing-mark=to-m2 passthrough=no comment="afrows-3modem pin wg-afr2->m2"
add chain=output protocol=udp dst-address=94.74.145.199 dst-port=51903 action=mark-routing new-routing-mark=to-m3 passthrough=no comment="afrows-3modem pin wg-afr3->m3"

# ---- 5. GAMING pins to the best modem (Irelandcell-228/m2), bypasses the LB -----
# PCC adds jitter/reordering; keep latency-sensitive gaming on one low-ping modem.
# <GAMING_SRC> = the gaming source set (egress_tier='gaming' peer IPs + home router
# tunnel IP). List them or use an address-list. Placed BEFORE the PCC block.
/ip firewall mangle
add chain=prerouting src-address-list=afrows-gaming connection-state=new action=mark-connection new-connection-mark=cm-gaming passthrough=yes comment="afrows-3modem gaming mark"
add chain=prerouting connection-mark=cm-gaming action=mark-routing new-routing-mark=to-m2 passthrough=no comment="afrows-3modem gaming->m2 (best latency)"

# ---- 6. PCC: balance all OTHER decapsulated user connections across 3 modems -
# Applies to forwarded traffic arriving from the Afrows tunnels heading to the
# internet (in-interface = the wg tunnel that carries user egress). PCC hashes
# each NEW connection into one of 3 buckets by both-addresses-and-ports, so ~1/3
# of connections take each modem; conntrack keeps each connection on its modem.
# <USER_IN_IFACE> = the interface user egress arrives on (e.g. wg-village-de, or a
# bridge/list of wg-afr1..3 if egress is decapsulated locally). Verify on the box.
/ip firewall mangle
add chain=prerouting in-interface=<USER_IN_IFACE> connection-mark=no-mark connection-state=new dst-address-type=!local \
    per-connection-classifier=both-addresses-and-ports:3/0 action=mark-connection new-connection-mark=cm-m1 passthrough=yes comment="afrows-3modem pcc 0->m1"
add chain=prerouting in-interface=<USER_IN_IFACE> connection-mark=no-mark connection-state=new dst-address-type=!local \
    per-connection-classifier=both-addresses-and-ports:3/1 action=mark-connection new-connection-mark=cm-m2 passthrough=yes comment="afrows-3modem pcc 1->m2"
add chain=prerouting in-interface=<USER_IN_IFACE> connection-mark=no-mark connection-state=new dst-address-type=!local \
    per-connection-classifier=both-addresses-and-ports:3/2 action=mark-connection new-connection-mark=cm-m3 passthrough=yes comment="afrows-3modem pcc 2->m3"
# route by the connection mark (whole connection sticks to one modem)
add chain=prerouting connection-mark=cm-m1 action=mark-routing new-routing-mark=to-m1 passthrough=no comment="afrows-3modem pcc route m1"
add chain=prerouting connection-mark=cm-m2 action=mark-routing new-routing-mark=to-m2 passthrough=no comment="afrows-3modem pcc route m2"
add chain=prerouting connection-mark=cm-m3 action=mark-routing new-routing-mark=to-m3 passthrough=no comment="afrows-3modem pcc route m3"

# ---- 7. Per-modem netwatch: pull a dead SIM out of the pool automatically ----
# Probe a foreign IP THROUGH each modem; on down raise that modem's route distance
# so PCC/pinning skips it; on up restore. (check-gateway in step 2 also helps, but
# netwatch catches SIM-data-death where the link is up but no data flows.)
/tool netwatch
add host=1.1.1.1 interval=30s comment="afrows-3modem watch m2 (best)" \
    down-script=":do {/ip route set [find comment=\"afrows-3modem m2\"] distance=200} on-error={}" \
    up-script=":do {/ip route set [find comment=\"afrows-3modem m2\"] distance=1} on-error={}"
# (add matching netwatch entries per modem, each probing via its own table/modem)

# =============================================================================
# APPLY / ROLLBACK
#   Apply:   in Winbox New Terminal press Ctrl-X (safe mode), paste this, verify
#            connectivity, then press Ctrl-X again to COMMIT. If your session
#            drops, safe mode auto-reverts everything.
#   Verify:  /ip route print where routing-table~"to-m"    (all 3 gateways reachable)
#            /interface wireguard peers print   (wg-afr1/2/3 all handshaking)
#            run 3-6 parallel downloads through the village egress; confirm each
#            modem's /interface counters climb ~evenly.
#   Rollback: /system backup load name=pre-3modem-pcc-*   (or remove the rules by
#            comment: /ip firewall mangle remove [find comment~"afrows-3modem"] ; etc.)
# =============================================================================
