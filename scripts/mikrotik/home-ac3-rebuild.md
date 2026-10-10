# Home hAP ac3: rebuild after a factory reset (foreign traffic via the USA VPS)

Use this to rebuild the operator's **home** router after a factory reset. The script is `home-ac3-rebuild.rsc`, kept in this folder. It was prepared on 2026-10-06 and has **not been applied or tested on hardware yet**. You run every command yourself. Nothing here is applied remotely.

The target unit was reset on 2026-10-06 and reports RouterOS **7.24.3** (stable), hAP ac^3, arm, 256 MiB RAM (180 MiB free), 128 MiB flash (98 MiB free). No upgrade is needed.

What gets built:
- **WAN:** ether5 is Shatel FTTH (DHCP from the ONT, or PPPoE). The main routing table's default route goes out ether5.
- **Home LAN:** ether1, ether3, ether4 and wifi on the bridge, **192.168.50.1/24** (DHCP .10 to .254). It is not 192.168.88.0/24, because that is the village LAN on the other end of ether2.
- **Village link:** ether2 goes to the village hAP ax3's ether4. It has its own subnet, **192.168.51.0/29** (router .1, DHCP .2 to .6). The village gets **plain Shatel internet only**. It never uses the USA tunnel, cannot reach this router's management, and cannot reach the home LAN.
- **WireGuard `wg-home`:** this router is 10.40.0.2 and the USA VPS (93.127.140.50) is 10.40.0.1. The router starts the tunnel, with keepalive 25s. The server port is UDP 51820, and UDP 443 is redirected to the same socket.
- **Routing policy:**
  - Home LAN traffic to Iranian addresses (list `afr-iran-a`/`afr-iran-b`, refreshed weekly) and to private ranges goes **direct** out ether5.
  - Everything else from the home LAN uses routing table `to-usa`, which goes out through `wg-home` to the USA.
  - The router's own traffic (the WireGuard packets, NTP, the list download) always uses the main table, so the tunnel cannot loop through itself. The exception is the router's DNS queries to 1.1.1.1 and 8.8.8.8, which also go through the tunnel.
- **Fail-open** by default. If the tunnel stops answering, foreign traffic leaves through plain Shatel within about 20 s. There is a kill-switch option (see section 8).
- **Firewall:**
  - Traffic to the router is allowed only from the home LAN, plus established connections, ICMP, and DHCP from the village link.
  - winbox, ssh and www are allowed only from 192.168.50.0/24.
  - There is no REST/API user. Nothing manages this router remotely.

## 1. Before you start

1. Have the router reachable over **MAC-Winbox** from a PC on ether3 (or ether1/ether4). It stays reachable that way even when the LAN subnet changes partway through the script.
2. Have the USA server set up first (sections 3a to 3d). You need its **public key** (`afrUsaPub`) for the handshake test and for the script.
3. Copy `home-ac3-rebuild.rsc` to the PC and fill in section 0:
   - `afrAdminPw`: the new admin password. Store it in the password manager **first**.
   - `afrWanMode`: use `dhcp` if the Shatel ONT runs in router mode (it hands out a LAN IP), or `pppoe` if it runs in bridge mode. For `pppoe`, also fill in `afrPppoeUser` and `afrPppoePw`.
   - `afrUsaPub`: the key printed by `cat wg-home.pub` in step 3a.
   - `afrUsaPort`: `51820`, or `443` if only 443 worked in the handshake test (section 4).
   - `afrShatelDns`: Shatel's resolvers. They are used **only** while the tunnel is down. Confirm the values, or set it to `""` to never use them.
   - `afrKillSwitch`: leave this at `"no"` (fail-open) unless you want foreign traffic blocked whenever the tunnel is down.

## 2. Factory reset (done on 2026-10-06; kept for next time)

1. Unplug power. Hold the **RESET** button, power on, and keep holding until the USER LED starts flashing (about 5 s). Then release. This loads the default configuration ("defconf").
   - Do not hold until the LED goes solid and then off. That is Netinstall/CAP mode.
2. Connect the PC to **ether3**. Open Winbox, go to **Neighbors**, and connect by **MAC address**.
3. Log in as `admin`.
   - The password is the one printed on the **sticker** on the bottom of the router. On older units it is empty.
   - If RouterOS asks for a new password right away, use `afrAdminPw`.
4. Check the version with `/system resource print`. It must be **7.x**, because WireGuard needs v7. The script refuses to run on v6.

## 3. USA server setup (93.127.140.50, WAN `enp21s0`)

This is the **final form the operator was given** on 2026-10-06. Log in as the sudo user `administrator` and become root first. Every line is short and there are no heredocs, because long pasted lines get wrapped and broken. Paste one block at a time.

These steps leave `cloudflared` (`afrows-cf`) and the `afrows-relay` user alone. afrows-cf only redirects **TCP** 443 on `lo`, so the UDP 443 used here does not clash with it.

### 3a. Root, check the IP, install, generate the key

```bash
sudo -i
curl -4 -s https://api.ipify.org; echo     # expect 93.127.140.50
ip -4 route get 1.1.1.1                    # expect "dev enp21s0"
apt-get update
apt-get install -y wireguard-tools iptables
umask 077
mkdir -p /etc/wireguard
cd /etc/wireguard
[ -f wg-home.key ] || wg genkey > wg-home.key
wg pubkey < wg-home.key > wg-home.pub
cat wg-home.pub              # -> afrUsaPub in section 0 of the .rsc
```

The key file is created only if it is missing, so pasting this again keeps the same server key.

### 3b. IP forwarding

```bash
echo 'net.ipv4.ip_forward = 1' > /etc/sysctl.d/90-wg-home.conf
sysctl --system > /dev/null
sysctl net.ipv4.ip_forward                 # expect = 1
```

### 3c. Firewall helper `/etc/wireguard/wg-home-fw.sh` (argument A = add, D = delete)

```bash
S=/etc/wireguard/wg-home-fw.sh
echo '#!/bin/sh' > $S
echo 'W=enp21s0; T=10.40.0.0/24' >> $S
echo 'if [ "$1" = A ]; then N=-A; F="-I FORWARD 1"' >> $S
echo 'else N=-D; F="-D FORWARD"; fi' >> $S
echo 'iptables -t nat $N POSTROUTING -s $T -o $W -j MASQUERADE' >> $S
echo 'iptables -t nat $N PREROUTING -i $W -p udp --dport 443 \' >> $S
echo '  -j REDIRECT --to-ports 51820' >> $S
echo 'iptables $F -i wg-home -o $W -j ACCEPT' >> $S
echo 'iptables $F -i $W -o wg-home \' >> $S
echo '  -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT' >> $S
echo 'iptables -t mangle $N FORWARD -o wg-home -p tcp \' >> $S
echo '  --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu' >> $S
echo 'exit 0' >> $S
chmod 700 $S
cat $S                                     # eyeball it: 13 lines
```

The script does the following:
- **NAT:** masquerades only the tunnel subnet, out `enp21s0`.
- **Port 443:** redirects UDP 443 to 51820, so the router can use either port.
- **Forwarding:** allows the tunnel to reach the internet, plus the replies.
- **MSS clamp:** clamps TCP MSS into the tunnel.

It ends with `exit 0`, so a missing rule on `D` never blocks shutdown.

### 3d. `wg-home.conf` and start

```bash
C=/etc/wireguard/wg-home.conf
K=$(cat /etc/wireguard/wg-home.key)
echo '[Interface]' > $C
echo 'Address = 10.40.0.1/24' >> $C
echo 'ListenPort = 51820' >> $C
echo "PrivateKey = $K" >> $C
echo 'PostUp = /etc/wireguard/wg-home-fw.sh A' >> $C
echo 'PostDown = /etc/wireguard/wg-home-fw.sh D' >> $C
chmod 600 $C
unset K
ufw status | head -1                       # active or inactive?
```

If ufw is **active**, run these too:

```bash
ufw allow 51820/udp
ufw allow 443/udp
ufw route allow in on wg-home out on enp21s0
```

Then start it:

```bash
systemctl enable --now wg-quick@wg-home
wg show wg-home                            # port 51820, no peer yet
iptables -t nat -S | grep -E '10.40|443'   # MASQUERADE + REDIRECT
```

Notes:
- **Re-running 3d** rewrites `wg-home.conf` and drops the `[Peer]` block. Run 3e again afterwards.
- **No MTU line**, so the USA side uses the wg-quick default of 1420. If Shatel turns out to be PPPoE and large downloads stall:
  1. Add an `MTU = 1380` line under `[Interface]`. The simplest way is to add `echo 'MTU = 1380' >> $C` to 3d and re-run 3d, then 3e.
  2. Run `systemctl restart wg-quick@wg-home`.
  The MSS clamps on both ends cover TCP in the meantime.
- **No INPUT rules are added.**
  - With ufw active, the `ufw allow` lines open the port. ufw's defaults also accept the ICMP echo that the router's `check-gateway=ping` to 10.40.0.1 needs.
  - With ufw inactive and `iptables -S INPUT | head -1` showing `-P INPUT ACCEPT`, nothing else is needed.
  - If it shows `DROP`, run `iptables -I INPUT -p udp --dport 51820 -j ACCEPT` and `iptables -I INPUT -i wg-home -p icmp -j ACCEPT`.
- The home LAN can reach services on this VPS through the tunnel unless ufw/INPUT blocks 10.40.0.2. The VPS only ever sees the router's NAT address.

### 3e. Add the router as a peer

The router prints its public key in **two places**:
- In the handshake test (section 4, step 1), at the line `:put [/interface wireguard get wg-home public-key]`.
- At the end of the full script, at the line `afr: wg-home (10.40.0.2) router pubkey: ...`.

It is the same key both times, because the script keeps `wg-home`. You can show it again at any time with `/interface wireguard print`.

```bash
P='<ROUTER_PUB>'
wg set wg-home peer "$P" allowed-ips 10.40.0.2/32
C=/etc/wireguard/wg-home.conf
echo '' >> $C
echo '[Peer]' >> $C
echo "PublicKey = $P" >> $C
echo 'AllowedIPs = 10.40.0.2/32' >> $C
grep -c '^\[Peer\]' $C                     # expect 1 (append once)
wg show wg-home                            # peer listed
```

### 3f. Replace the peer (only if the router key ever changes, e.g. after another reset)

```bash
OLD='<old router key>'
NEW='<new router key>'
C=/etc/wireguard/wg-home.conf
cp -a $C $C.bak-$(date +%s)
wg set wg-home peer "$OLD" remove
wg set wg-home peer "$NEW" allowed-ips 10.40.0.2/32
sed -i "s#$OLD#$NEW#g" $C            # '#' delimiter: keys can contain '/'
```

## 4. Handshake test FIRST (before the full script)

Shatel might block WireGuard the way Irancell's DPI does, so prove the tunnel works before rebuilding everything. These commands create the **same** `wg-home` interface that the script uses. Because the script keeps an existing `wg-home`, the key you register on the USA side now stays valid.

1. Plug Shatel into **ether5**. Then, in the router terminal (defconf is still loaded):
   ```
   /interface bridge port remove [find interface=ether5]
   # DHCP ONT:
   /ip dhcp-client add interface=ether5 add-default-route=yes use-peer-dns=yes comment="afr: handshake test"
   # ...or PPPoE ONT instead (only one of the two):
   # /interface pppoe-client add name=pppoe-shatel interface=ether5 user="<user>" password="<pw>" add-default-route=yes use-peer-dns=yes disabled=no comment="afr: handshake test"
   :delay 10s
   /ip dhcp-client print            # status=bound (or /interface pppoe-client print: R flag)
   /tool fetch url="https://www.gstatic.com/generate_204" keep-result=no   # plain internet works

   /interface wireguard add name=wg-home listen-port=51830 mtu=1420 comment="afr: home -> USA 93.127.140.50 wg-home"
   /interface wireguard peers add interface=wg-home public-key="<afrUsaPub>" endpoint-address=93.127.140.50 endpoint-port=51820 allowed-address=0.0.0.0/0 persistent-keepalive=25s comment="afr:peer handshake test"
   /ip address add address=10.40.0.2/24 interface=wg-home comment="afr:wg home"
   :put [/interface wireguard get wg-home public-key]   # -> USA step 3e
   ```
   Use `mtu=1380` instead if you are on PPPoE.
2. On the USA server, run **3e** with that key.
3. Wait 30 s, then check on the router:
   ```
   /interface wireguard peers print detail   # last-handshake = a few seconds, rx > 0
   /ping 10.40.0.1 count=5
   ```
   On the server: `wg show wg-home latest-handshakes` should show a recent timestamp.
4. **If there is no handshake on 51820, try 443:**
   ```
   /interface wireguard peers set [find interface=wg-home] endpoint-port=443
   ```
   Wait 30 s and check again. If 443 works, set `afrUsaPort 443` in the script.
5. **If neither 51820 nor 443 handshakes:**
   - Check that the server side is healthy: `wg show wg-home` shows the peer, `ss -ulpn | grep 51820` shows the socket, `ufw status` lists 51820/udp and 443/udp if ufw is active, and `iptables -t nat -S | grep -E '10.40|443'` shows both NAT rules.
   - Confirm that `rx` stays at 0 on the router.
   - Then **STOP**. Do not run the full script. Report back "Shatel blocks WireGuard to the USA". The fallback path (through Borjino) will be designed separately.
   - Leave the router as it is (defconf with plain Shatel), or roll back as in section 7.

## 5. Cabling (for the full run)

| Port | Plug in |
|---|---|
| ether1 | Home LAN (free) |
| ether2 | Village hAP ax3 **ether4** |
| ether3 | Operator PC (home LAN) |
| ether4 | Home LAN (free) |
| ether5 | Shatel FTTH ONT |
| wifi | Home LAN (left as defconf set it; set the SSID and passphrase by hand) |

## 6. Run the script

1. In Winbox (connected by **MAC**), open **Files** and drag in the edited `home-ac3-rebuild.rsc`.
2. Open **New Terminal** and run:
   ```
   /import file-name=home-ac3-rebuild.rsc verbose=yes
   ```
   - Use `/import`, not copy-paste. Under `/import`, the guard **aborts** the run if any `CHANGE_ME` is left, if the key is not 44 characters long, or if the router is not on RouterOS 7.
   - The script is safe to run again: it keeps the `wg-home` key and rebuilds everything tagged `afr:`.
   - It also removes the handshake-test DHCP/PPPoE client and peer, then adds them again in their final form.
3. Expected run time is about 1 to 3 minutes:
   - A 15 s wait for the Shatel lease.
   - The Iran list download and load, about 2,300 prefixes.
4. Near the end, your PC loses its 192.168.88.x address. Renew DHCP on the PC (`ipconfig /renew`) to get a 192.168.50.x address. MAC-Winbox keeps working the whole time.
5. At the end the script prints the router's `wg-home` public key. If it differs from the key on the USA side (it should not, after the handshake test), run **3f**.
6. To roll back the router: `/system backup load name=pre-afr-rebuild`. This restores the state just before the script ran: defconf plus the handshake test.

## 7. Verify

**Router (Winbox terminal):**
```
/interface wireguard peers print detail                 # last-handshake < 2m, rx/tx growing
/ip route print where routing-table=to-usa              # d1 via 10.40.0.1 ACTIVE; d2 fallback present
/ip firewall address-list print count-only where list=[/ip firewall mangle get [find comment~"iran-list"] dst-address-list]   # ~2000-2300
/tool traceroute 1.1.1.1 routing-table=to-usa count=1   # first hop 10.40.0.1
/tool fetch url="https://api.ipify.org" output=user     # = Shatel IP (the router's OWN traffic is direct by design)
/ip firewall mangle print stats where comment~"afr:mangle"   # counters grow on all four prerouting rules
/log print where message~"afr"
```

**From a home LAN PC (192.168.50.x):**
```
curl -s https://api.ipify.org ; echo                  # = 93.127.140.50 (foreign -> USA)
tracert -d -h 4 1.1.1.1                               # hop 2 = 10.40.0.1
tracert -d -h 4 www.aparat.com                        # Iranian: hop 2 is the Shatel gateway, NOT 10.40.0.1
nslookup example.com 192.168.50.1                     # router DNS answers
```
On the router, `/ip firewall connection print where connection-mark=afr-direct` should list the Iranian-site connections, and `connection-mark=afr-usa` the foreign ones.

**Village link:**
- On the home router: `/ip dhcp-server lease print where server=afr-village` shows the ax3 with an address in 192.168.51.2 to .6.
- On the village ax3: `/ip dhcp-client print where interface=ether4` shows status bound, and `/ping 192.168.51.1 count=3` succeeds.
- From the ax3, `/tool fetch url=https://api.ipify.org output=user src-address=<its 192.168.51.x>` (if it routes that way) must return the **Shatel** IP, never 93.127.140.50.
- From the village side, home 192.168.50.x and the home router's winbox/ssh must **not** respond.

**USA server:**
```bash
wg show wg-home                    # recent handshake, transfer growing
iptables -t nat -S | grep -E '10.40|443'   # MASQUERADE + REDIRECT
systemctl is-active afrows-cf              # cloudflared untouched
systemctl is-active wg-quick@wg-home       # active
```

**Fail-open test (optional):**
- On the server run `systemctl stop wg-quick@wg-home`.
- Within about 20 s, the router's `to-usa` d1 route turns inactive and d2 (Shatel) takes over. `curl api.ipify.org` from the PC then shows the Shatel IP. The log shows `afr: wg-home tunnel DOWN`.
- Run `systemctl start wg-quick@wg-home` and the routes return to the tunnel on their own.
- Connections that were open during the switch break once, because their NAT address changes. New connections work.

## 8. Fail-open vs kill switch

- **Default (fail-open):** if the tunnel dies, foreign traffic goes out plain Shatel. Browsing keeps working, but sites see the Shatel IP and traffic is exposed to Iranian DPI and filtering.
- **Kill switch (fail-closed):** if the tunnel dies, foreign traffic is dropped. Iranian sites still work.
  - To flip without re-running the script:
    ```
    /ip route set [find comment~"afr:usa fail-open"] disabled=yes
    /ip route set [find comment~"afr:usa kill-switch"] disabled=no
    ```
  - Reverse both lines to go back to fail-open.
  - Or set `afrKillSwitch "yes"` and re-run the script.
- While the tunnel is down, the router's DNS gains Shatel's resolvers through the netwatch, so name lookups keep working in either mode. They are removed again when the tunnel comes back.

## 9. Rollback

**Router:**
- Undo the last script run: `/system backup load name=pre-afr-rebuild` (the router reboots).
- Keep everything but stop using the USA: `/interface wireguard disable wg-home`. With fail-open, all traffic then goes out plain Shatel.
- Start from scratch: factory reset (section 2).

**USA server** (as root, `sudo -i`):
```bash
systemctl disable --now wg-quick@wg-home   # runs wg-home-fw.sh D
rm /etc/wireguard/wg-home.*                # conf, key, pub
rm /etc/wireguard/wg-home-fw.sh
rm /etc/sysctl.d/90-wg-home.conf
ufw status | head -1                       # if active, also:
ufw delete allow 51820/udp
ufw delete allow 443/udp
ufw route delete allow in on wg-home out on enp21s0
iptables -t nat -S | grep -cE '10.40|443'  # expect 0
systemctl is-active afrows-cf              # still active
```
- IP forwarding stays on until the next reboot. Turn it off now only if nothing else on the VPS needs it (check for Docker or other VPNs first): `sysctl -w net.ipv4.ip_forward=0`.

## 10. Notes and assumptions to confirm

1. **Shatel mode and DNS.**
   - DHCP or PPPoE? Does PPPoE need a VLAN tag?
   - `afrShatelDns` defaults to 85.15.1.14 and 85.15.1.15. Confirm these, or read them from the lease.
2. **Iran list sources.**
   - Primary: `raw.githubusercontent.com/ipverse/rir-ip/master/country/ir/ipv4-aggregated.txt`. It is RIPE-derived, about 2,300 lines (about 33 KB) with `#` comment lines.
   - Mirror: `www.ipdeny.com/ipblocks/data/aggregated/ir-aggregated.zone`, about 2,100 lines.
   - Both are fetched over Shatel by the router itself. GitHub raw can be throttled in Iran; the mirror covers that.
   - `/tool fetch output=user` holds up to 64 KB, which is plenty for these lists. If a source ever grows past that, the fetch fails and the old list is kept.
   - TLS certificates are **not** verified, because a fresh router has no CA store. A tampered list could at worst send some foreign traffic direct. The count and prefix checks limit the damage. To harden this, import a CA bundle and add `check-certificate=yes` to the two fetches.
   - Until the first list loads, **all** home traffic, Iranian sites included, goes via the USA. The `afr-iran-retry` job retries every hour and at boot.
3. **Script syntax not checked on hardware.** The updater is stored with `source={ ... }`, and the to-usa routes use `gateway=...@main`. Both are standard RouterOS 7 syntax but were not run on 7.24.3. `verbose=yes` will show any line that fails; report it back.
4. **Power and clock.**
   - After a power cut, the router restarts the tunnel on its own.
   - WireGuard rejects a handshake whose timestamp goes backwards, so the router needs NTP (direct over Shatel) before the tunnel can come back. Expect up to about 1 minute.
   - A UPS on the router plus the ONT avoids all of this. That is a hardware fix.
5. **The village side is unchanged.** The village ax3 already treats its ether4 as an untrusted DHCP client with no default route. Nothing about the village's customer egress depends on this router.
6. **The USA VPS sees only 10.40.0.2.** The home LAN is masqueraded into the tunnel, so the VPS needs no route back to 192.168.50.0/24, and USA logs cannot tell home devices apart.
