---
name: iran-dpi-playbook
description: Sourced playbook of Iranian DPI/throttling behaviour (2025-2026) with a symptom -> mechanism -> countermeasure table, the Afrows measurement method (interleaved rounds, per-flow retransmits, ICMP vs TCP loss), and our own verified findings from the زیرساخت مشهد server. Use when an Iran-side tunnel/chain is slow, frozen, or blocked, before choosing or changing a transport (SS-2022, REALITY, XHTTP, Hysteria2, CDN/ECH), and when planning transport experiments.
---

# Iran DPI playbook (Afrows)

Status legend: **[V-afrows]** measured by us; **[V-src]** a primary measurement source exists;
**[R]** community report (one or a few users, no controlled measurement); **[H]** our hypothesis.
Iranian filtering changes week to week and differs by ISP, by datacenter and by route. Re-measure before
you trust any row. Dates matter: always write the date next to a finding.

## 1. Our environment (as of 2026-10-28)

- Iran entry: 185.252.30.123, datacenter "زیرساخت مشهد". USA exit: 93.127.140.50 (Database Mart, Kansas City),
  RTT about 195 ms. Never use the Germany VPS (Hexogate) or Borjino 185.252.30.127.
- Chains Iran -> USA: main SS-2022 TCP :8447, backup VLESS+REALITY+Vision fp=ios :443.
- Clients on Shatel FTTH home lines reach the Iran entry; see memory `shatel-testing`.

## 2. Our verified findings

| Date | Finding | Grade |
|---|---|---|
| 2026-10-28 | Upload through the chain is about 0.1 MB/s on BOTH SS-2022 and REALITY; download is 1.3-2.5 MB/s | V-afrows |
| 2026-10-28 | The same server uploads 3-6 MB/s directly to Cloudflare and to a US AWS host (postman-echo, RTT 275 ms) | V-afrows |
| 2026-10-28 | ICMP to the USA: 0% loss, 1400 B passes, path MTU 1500 OK | V-afrows |
| 2026-10-28 | During a chain upload, TCP retransmits were 568/3632 segments (about 15%); BBR+fq were on | V-afrows |
| 2026-10-28 | USA ingress itself is fine (11 MB/s from Cloudflare) | V-afrows |
| 2026-10 | From this DC, DPI froze REALITY flows (FIN-WAIT-1 with unacked data) | V-afrows |
| 2026-10-20 | Non-443 TCP ports were blackholed for tunnels; SS-2022 on :8447 works now | V-afrows (changes over time) |
| 2026-10-20 | The USA -> Iran path dropped packets over about 1480 B; `afrows-exit-mss.service` (advmss 1400) fixed it. On 2026-10-28 PMTU 1500 looked OK. Keep the MSS clamp | V-afrows |
| 2026-10 | XHTTP packet-up + REALITY: 0/20 connects. Cloudflare-fronted WS from the DC: 0/6 | V-afrows |
| 2026-10 | Hysteria2 (plain and salamander) never completed a handshake from Shatel home lines; not fully tested from the DC | V-afrows (partial) |
| 2026-10 | On Shatel home lines the uTLS fingerprint decided blocking: chrome blocked, ios passed | V-afrows |
| 2026-10 | Shatel FTTH freezes Cloudflare TLS with an afrows.com SNI after about 64 KB | V-afrows |

**Working hypothesis for the upload problem [H]:** DPI or a policer drops packets of long-lived,
high-entropy upload flows to this one foreign IP. The open question is whether the limit is per flow
(5-tuple), per destination IP, by content entropy, or by flow age. Run experiment E0 below first.
It decides which countermeasure can work.

## 3. Iranian DPI behaviour in 2025-2026 (external)

- **Protocol whitelister** on ports 53/80/443: only DNS/HTTP/HTTPS are allowed there. Other ports were
  historically less filtered [V-src: Bock et al., FOCI 2020]. Our DC showed the reverse in October 2026
  (only 443 open for tunnels), so this is route-dependent.
- **SNI from reassembled TCP:** DPI reassembles fragmented ClientHellos, so fragmenting the ClientHello
  does not help. It blocks VLESS+WS over Cloudflare by SNI within about 24 h, with DNS poisoning to
  10.10.34.34 plus RST floods [R: net4people #628, 2026].
- **REALITY/WireGuard:** reported cut seconds after the handshake (RST, or the server's packets stop)
  [R: #628]. This matches our REALITY freezes.
- **Upload/download ratio analysis** as a proxy signal [R: #628, mechanism not shown].
- **Grey-SNI 6-packet cap:** non-whitelisted SNI on allowed Cloudflare IPs was limited to about 6 packets
  per connection during the 2026 shutdown [R: Lantern corpus, tuleo1 2026].
- **October 2026, some DC routes:** TCP/UDP/GRE/IPIP/SCTP/ESP to abroad were cut after a few packets,
  and only ICMP passed. There was a packet-rate cap of about 50k pps, and holding more than about 30 MB/s
  for a few seconds triggered a reroute (RTT 40 -> 76 ms, then 50-90% loss on bulk transfers for minutes).
  Cloudflare **with ECH** was the only working CDN path (44-48 MB/s) [R: net4people #676, 2026-10-18].
- **ECH:** neither Iran nor China blocks the ECH ClientHello itself. They block encrypted-DNS resolvers
  (Cloudflare/NextDNS DoH) so clients cannot fetch ECH configs [V-src: FOCI 2025 paper on ECH in
  censorship circumvention, via Lantern corpus]. Fetch or pin the ECHConfigList out of band.
- **Throttling without loss or RTT rise** is the signature of a deliberate throttle rather than
  congestion [V-src: Aryan, Aryan, Halderman, FOCI 2013]. In 2013 Iran also dropped or throttled
  long-lived TCP connections after about 60 s while short HTTP connections were unaffected [V-src, as
  cited by Fifield, Turbo Tunnel, FOCI 2020]. The countermeasure is short-lived connections plus a
  session layer.
- **Upload throttling 2022:** home upload capped at 2-6 Mbps. Throttling varied per foreign server
  (two Hetzner boxes behaved differently). An Iranian first hop helped [R: net4people #171].
- **Grey/black IP tiers:** "unclassified" high-volume flows to a foreign IP get it throttled, then blocked
  [R, undated].
- **uTLS:** the fingerprint matters per ISP. Shatel blocked chrome and passed ios (ours, 2026-10).

## 4. Symptom -> likely mechanism -> countermeasure

| Symptom | Likely mechanism | Try |
|---|---|---|
| Handshake OK, then the flow freezes (FIN-WAIT-1, unacked) | Post-handshake classifier (REALITY/WG fingerprint) | Change transport family. Fragment/noise tricks do not fix this |
| Connect fails 0/N, ICMP fine | Port or protocol blackhole, or SNI blocklist | Different port (443 vs high), different SNI, ECH via Cloudflare |
| Upload slow with high retransmits, download OK, ICMP clean, other foreign hosts fine | Per-flow or per-destination-IP policer on upload; maybe entropy- or age-triggered | Run E0 first. Then: many short-lived flows (XHTTP packet-up + xmux rotation), split across ports, a different destination IP (CDN+ECH), or loss-tolerant congestion control over UDP |
| Fast for the first N seconds or MB, then collapses | Flow-age or volume trigger | Rotate connections faster than the trigger (xmux hMaxReusableSecs, cMaxReuseTimes) |
| Everything degrades minutes after a big transfer; RTT rises | Volume-triggered reroute or IP greylisting (#676) | Cap the rate below the trigger. Spread load over IPs. Do not use brute-force congestion control |
| Works on Android client, slow on Windows (same server) | Client fingerprint or behaviour | Compare the uTLS fingerprint and the mux settings |
| CDN path fails without ECH | SNI filtering on the CDN edge | ECH with the outer name cloudflare-ech.com and a pinned config |

Not useful against mid-flow drops: xray fragment, noises and Vision padding (they act on the handshake
or the first packets only), and fragmenting the ClientHello (it is reassembled).

## 5. Measurement method (always)

1. **Interleave, do not batch.** Run at least 3 rounds of A B C, A B C, ... with the same file and the
   same target, and report the median and the range. Iranian paths drift from minute to minute.
2. **Test through a throwaway socks** (127.0.0.1:194xx) on the Iran box. Never touch the production
   inbounds. Use test ports 9450-9459 on the USA, opened only to 185.252.30.123.
3. **Upload and download separately.**
   Upload: curl -x socks5h://127.0.0.1:P --data-binary @/tmp/up20M -o /dev/null -w "%{speed_upload}" https://speed.cloudflare.com/__up
   Download: the same with https://speed.cloudflare.com/__down?bytes=50000000 and "%{speed_download}".
   Make the file with head -c 20M /dev/urandom > /tmp/up20M.
4. **Retransmits per flow, not per host** (the box carries live customers): sample
   ss -tin dst 93.127.140.50 every second. Read retrans, bytes_retrans, cwnd and delivery_rate.
   Use nstat -az TcpRetransSegs TcpOutSegs only on a quiet box.
5. **ICMP vs TCP loss on the same path.** Run ping -c 200 -i 0.2 -s 1372 -M do 93.127.140.50 during the
   upload. Clean ICMP with lossy TCP means policing, not congestion.
6. **Raw-path classifier (E0)** with iperf3 to USA:945x. Compare -P 1 against -P 8 (per-flow vs
   per-IP), random against --repeating-payload (entropy), -t 60 -i 1 (age trigger), -R (direction), and
   -u -b 20M (UDP). These are the cheapest and most decisive tests.
7. **Protect the production IP.** Keep each test at 20 MB or less with 10 s gaps, and stop if base RTT
   jumps (reroute) or loss exceeds 50%. A flagged USA IP takes every customer down.
8. **Record** the date, the client ISP or DC, the transport, the fingerprint, the port, the median MB/s,
   and the retransmit %. Add durable results to section 2 here.

## 6. Countermeasure notes (config pointers)

- **XHTTP packet-up** splits upload into POSTs and rotates TCP connections using extra.xmux
  (cMaxReuseTimes, hMaxRequestTimes, hMaxReusableSecs). Defaults: scMaxEachPostBytes 1 MB and
  scMinPostsIntervalMs 30 [XTLS discussion #4113]. Without TLS it falls back to HTTP/1.1 and packet-up.
  Add VLESS Encryption (generated with "xray vlessenc") when security is none. If any xmux field is set,
  set all of them. maxConnections and maxConcurrency conflict.
- **Hysteria2 Brutal** sends at a fixed rate and compensates for loss. The sender's "up" sets the rate
  and the server caps it. Use salamander obfs and port hopping (sing-box server_ports and hop_interval,
  with an iptables DNAT range on the server). It is risky against volume-triggered reroutes, so keep the
  rate modest.
- **TCP Brutal** (sing-box mux) needs the brutal kernel module (Linux 5.10 or later) on the **sender**.
  For upload that is the Iran box. It is a poor fit for a policer.
- **Xray 26.3.27 Finalmask:** TCP masks fragment, header-custom and sudoku. UDP masks salamander, noise
  and udphop. quicParams.congestion takes brutal or force-brutal, with brutalUp and brutalDown. Field
  shapes are still changing (udphop moved in 26.9.x), so always run xray -test.
- **ECH via Cloudflare:** the xray field is tlsSettings.echConfigList. Iranian resolvers block DoH, so
  pin the config list or fetch it over a working resolver. Cloudflare rotates the keys.
- **Not recommended:** WireGuard (blackholed after the handshake), plain VLESS+WS+CDN identified by SNI
  (blocked within 24 h), and REALITY from this DC (frozen).

## Sources

- net4people/bbs #676 (2026-10): https://github.com/net4people/bbs/issues/676
- net4people/bbs #628 (2026): https://github.com/net4people/bbs/issues/628 (Lantern summary: https://corpus.lantern.io/papers/2026-pooribitwise-iran-advanced-dpi/)
- net4people/bbs #171 (2022-12): https://github.com/net4people/bbs/issues/171
- Lantern, 2026 shutdown analysis: https://corpus.lantern.io/papers/2026-tuleo1-internet-analysis-shutdown/
- ECH in censorship circumvention (FOCI 2025): https://corpus.lantern.io/findings/2025-niere-encrypted__china-iran-ech-via-dns-censorship/
- Turbo Tunnel (Fifield, FOCI 2020), Iran 60 s throttle: https://corpus.lantern.io/findings/2020-fifield-turbo__iran-tcp-termination-obfs4-attack/
- Aryan, Aryan, Halderman, Internet Censorship in Iran: A First Look (FOCI 2013): https://jhalderm.com/pub/papers/iran-foci13.pdf
- Bock et al., Iran's Protocol Whitelister (FOCI 2020): https://usenix.org/conference/foci20/presentation/bock
- XHTTP: Beyond REALITY (modes, xmux): https://github.com/XTLS/Xray-core/discussions/4113
- Xray Finalmask: https://xtls.github.io/config/transports/finalmask.md ; v26.3.27 release: https://github.com/XTLS/Xray-core/releases/tag/v26.3.27
- TCP Brutal: https://github.com/apernet/tcp-brutal ; sing-box: https://sing-box.sagernet.org/configuration/shared/tcp-brutal/
- Hysteria2 client config: https://v2.hysteria.network/docs/advanced/Full-Client-Config/
- xmux default change and DPI (3x-ui #5194): https://github.com/MHSanaei/3x-ui/issues/5194
