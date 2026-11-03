# Hexogate data plane and subscription system (reference for rebuilding Afrows)

Written 2026-11-03 from a **read-only** inspection of the Hexogate panel host (OVH Frankfurt,
162.19.253.235), the upstream PasarGuard source, one decoded live subscription and public DNS.
No secrets, keys, DB contents, UUIDs or tokens were read or are recorded here. Host paths below
are on 162.19.253.235 unless stated otherwise. Extends `docs/hexogate-reference-and-afrows-roadmap.md`
and **corrects** several points in it (see section 9).

Evidence legend: `[H:path:line]` = file on the Hexogate host; `[C:path]` = file inside the
`pasarguard-sub-renderer-canary` container image; `[SUB]` = the decoded subscription (28 links);
`[DNS]` = public resolution via 1.1.1.1 on 2026-11-02.

---

## 1. Topology

```
                  +------------------------------------------------------+
                  |  Panel host (OVH FRA 162.19.253.235), Docker          |
                  |  Caddy :443 -> UDS sockets                            |
                  |   - pasarguard-pasarguard-1 (panel, API, node mgr)    |
                  |   - pasarguard-sub-renderer-canary (/sub/* only)      |
                  |   - hexo-sub-signer (body signatures, tenant hosts)   |
                  |   - mysql, hexogate bot (postgres/redis/mariadb)      |
                  |  systemd: hexo-sub-scorer, hexo-row-doctor,           |
                  |   hexo-autoheal-v2 (DNS failover), hexo-iran-quorum,  |
                  |   hexo-node-serve-watch, hexo-health, front tunnel    |
                  +----------------------+-------------------------------+
                                         | PasarGuard node API (one node
                                         | container per core, ports 62050-62350)
       +---------------------------------+----------------------------------+
       |                     |                      |                       |
 Hetzner "cells"       Leaseweb FRA/NL        other exits              Fastly CDN
 (DE cell 01-12,       109.70.74.x,           TR, SE, US, CA, RO,      (199.232.x),
  FI cell 01-08)       85.17.151.103 NL-02    NL-migrated, DE-05       fronted XHTTP
 = FRONT nodes         = DE / NL exits        = EXIT nodes             -> origin node
       |  relay (outbound chain, DC to DC)          ^
       +--------------------------------------------+

 Iran client (Economy) -> .ir name -> FRONT node or EXIT node directly (foreign IP)
 Iran client (VIP)     -> .ir name -> Iranian relay (ParsAbr 81.12.34.83/.84) -> exit
 Subscription fetch    -> panel.hexogate.net -> Caddy (direct, or Iran front --Fastly XHTTP--> :2087)
```

### 1.1 Panel vs nodes
- The panel is PasarGuard (Marzban fork) built into local images `hexogatepanel:<tag>`
  [H:/opt/pasarguard/docker-compose.yml:3]. It never carries customer traffic.
- Nodes are **PasarGuard node containers**, several per physical box, each with its own core
  config (`core_configs` table) and its own API port. Examples [H:/etc/hexogate/autoheal.json `nodes`]:
  node 183 `DE-01 ▸ HTTP80 + CDN` 195.26.26.114:62050 core 9 (container `node-uk-gcore`);
  node 187 `DE-01 ▸ HTTP-Obfs` 109.70.74.79:62180 core 28; node 184 `DE-01 ▸ Shadowsocks`
  109.70.74.79:62060 core 11; node 211 `TR-01 ▸ VIP ML-KEM` 153.52.92.237:62190 core 51;
  node 249 `US-02 ▸ CDN` 139.144.203.245:62250 core 50. One box runs "HTTP", "SS", "Full",
  "VIP" cores side by side as separate nodes, so transports are isolated and restartable alone.
- Panel-node link = PasarGuard node API (gRPC/REST on the node port, API-key auth; upstream
  https://github.com/PasarGuard/node). The Hexogate build adds a NATS-based node worker
  [C:/code/app/node/worker.py, nats_memory.py].
- `hexo-node-serve-watch` (30 s) reconnects nodes that say "connected" but whose Xray is not serving.

### 1.2 Fleet (live score file, 2026-11-02 20:43 UTC)
`/var/lib/pasarguard/sub-load-scores.json` (`boxes`) and `/var/lib/pasarguard/fleet-live.json`
(minute history keys) list about 47 boxes:

| Role | Boxes |
|---|---|
| Front "cells" (Hetzner) | DE cell 01-12 (09-12 also a "TLS" variant; 91.107.x, 2.31.172.244), FI cell 01-08 (65.108.x / 65.109.x) |
| Exits | DE-05 195.26.26.114, DE-CIP 2.28.59.182, NL-migrated 194.29.79.233, NL-02 85.17.151.103, SE-02 172.234.105.211, US-02 139.144.203.245, CA-01 172.105.19.30, RO-01 45.82.102.38, TR-01 206.1.98.88 / 153.52.92.237, TR-02 82.47.161.107 |
| Iranian relays (VIP only) | iran-vip-relay-e / e2 = 81.12.34.84 / .83 (ParsAbr); relay-d (Webdade) is a probe vantage |

Row paths show the chaining: `DE cell 12 > DE cell 10 > DE cell 11 > DE cell 09 > TR-02`
(7 rows), `SE-02 > NL-migrated > TR-02` (14 rows), `NL-migrated > NL-02`. 54 scored rows.

### 1.3 Is there an Iranian relay tier?
- **Economy rows: no.** Clients dial foreign IPs directly via `.ir` names [DNS]:
  `9e20f9103865.salzivo.ir` -> 5.75.195.10 (Hetzner, HTTP rows), `2389eeb055f6.salzivo.ir` ->
  91.107.151.253 and `f96eb7fd66d4.salzivo.ir` -> 91.107.150.62 (Hetzner, Reality rows),
  `*.valzema.ir` / `*.welzora.ir` -> 109.70.74.95 (Leaseweb DE), `*.tanzora.ir` -> 91.107.254.41 /
  5.75.207.110 (SS), Fastly rows -> 199.232.78.159 / 199.232.97.159.
- **VIP rows: yes.** VIP names (`*.livfira.ir`, `*.panfelo.ir`) resolve to Iranian relays
  81.12.34.84 (primary) / .83 (secondary), one port per country (uk 2053, de 8445, tr 2087,
  us 8444, ro 2096) [H:/etc/hexogate/autoheal.json `vip`]. Its `notes`: relays run "Xray
  dokodemo per port, SNI-routed, VLESS XHTTP+TLS via Cloudflare to each exit's local VIP inbound".
- **Panel: partly.** An "Iran front" fronts the panel and in-app APIs.
  `hexogate-front-tunnel-origin.service` runs Xray with a VLESS **XHTTP packet-up + TLS** inbound
  on :2087 that may only reach 127.0.0.1:443 (Caddy) [H:/etc/hexogate/front-tunnel/origin.json];
  the Iran side reaches it via Fastly. Caddy: "Public DNS points at the Iran front, which forwards
  dashboard/API with this Host" [H:/opt/pasarguard/Caddyfile:209-224]. `panel.hexogate.com`
  resolves to 81.30.108.245 (Web Dadeh, Tehran, AS49556); `panel.hexogate.net` to the OVH host.

## 2. Inbounds, host rows and transports

PasarGuard separates **inbounds** (Xray inbounds in a node's core config, keyed by tag) from
**hosts** (rows that render one subscription link for an inbound: address list, port list, SNI
list, Host list, path, fp, ALPN, remark, `vless_route`, ...). Every link is one host row with a
numeric id (e.g. 17162, 17769) used by the policy and the scorer.

### 2.1 The 28 links of the sample subscription [SUB]
| # | Block | Shape |
|---|---|---|
| 0 | info | XHTTP+TLS via Fastly, SNI `firefox.com`, fp firefox; remark = usage readout "▌ 👤 user ▸ 📅 1405-08-12 ▸ 💠 99.06 MB / 500.0 MB" |
| 1-7 | 🌐 HTTP | `tcp` + `headerType=http`, Host `dynu.com`, `security=none`, `encryption=mlkem768x25519plus.native...` (VLESS Encryption). One name (Hetzner front), **port = country**: TR2 2091, NL 2092, RO 2093, SE 2094, US 2095, CA 2096. DE uses its own Leaseweb name :2086, Host `support-shield.nvidia.it`, flow `xtls-rprx-vision` |
| 8 | 🔒 HTTPS | DE: `tcp` + http header, TLS SNI = own `.valzema.ir` name, Host `play-fe.googleapis.com`, fp chrome, ALPN http/1.1 |
| 9-16 | 🛡 Reality | port 8080, SNI/Host `firmwaresign.partners.nvidia.com`, fp chrome, ALPN h2,http/1.1, no Vision. NL/NL2/TR2/US/CA share one front name; SE/RO another; DE its own Leaseweb name; per-row short-id |
| 17-23 | 🚀 Fastly | XHTTP `mode=auto` + TLS to Fastly POP IPs, SNI `cdn.fastly.steamstatic.com`, Host = one `*.global.ssl.fastly.net` service for all countries, **path selects the exit** (`/?ed=2048`, `/3b756c5b33/?ed=2048`, ...), `xPaddingBytes 100-1000`, ALPN h2, plus `pinSHA256`/`pcs` (pinned cert hash) and `vcn=play.google.com` (verify cert by that name, since SNI != cert name) |
| 24-27 | 🧦 SS | chacha20-ietf-poly1305, random high ports 34606-38845, `*.tanzora.ir` |

### 2.2 One entry, many countries: `vless_route` (not per-node UUIDs)
What looked like "per-node derived UUIDs" is the **VLESS route** feature. A PasarGuard host row
has a `vless_route` field; the renderer overwrites the **third group** of the user's UUID with it
[C:/code/app/subscription/base.py:205-227; used in links.py:263, xray.py:423, singbox.py:290,
clash.py:640]:

    parts = uuid.split("-"); parts[2] = route; return "-".join(parts)

Xray-core matches VLESS users while ignoring those route bytes and exposes them to routing
(`vlessRoute` rule field), so the **front** node sends each row to a different exit outbound.
In the sample the Reality rows on one front carry routes 4001 (TR2), 4002 (NL2), 4005 (US),
4006 (CA), 4007 (NL). HTTP rows use the **port** as selector, Fastly rows the **path**. Each
user has ONE UUID; there is no per-node secret derivation.

### 2.3 `.ir` entry names
- Random hex labels (12-19 chars, optional `r` prefix) on many cheap `.ir` zones: salzivo,
  valzema, welzora, tanzora, darzelo, brizuma, xorvia, xorvex, zelvian, livfira, panfelo
  [SUB; H:/etc/hexogate/autoheal-v2.json `direct`, `vip`].
- Names are **DNS failover handles**: `hexo-autoheal-v2` (fast loop 2 min, slow loop 5 min)
  probes from Iranian vantages and re-points DNS (`mode: dns`) under budgets
  (`fleet_guard.max_dns_changes_per_tick 8`, `entry_outage_max_dns_changes_per_tick 24`,
  `direct_policy.confirm_ticks 2`, `min_dead_vantages 2`, failback after 36 clean ticks and
  >= 3 h). Each `direct.<cc>.names[]` entry has `home_ip`, `ports`, `alternates`; VIP names have
  a primary and a secondary relay IP [H:/etc/hexogate/autoheal-v2.json, autoheal.json].
- A whole zone can be DNS/SNI-filtered in Iran (the `hexolexo.xyz` case), so rotating labels in
  one zone does not help; spreading over many zones does
  [H:autoheal-v2.json `_comment_dns_survey_known_hijacks_hcfix_20261007`].

### 2.4 Per-user stable sharding of addresses, SNIs, ports
Hexogate patched `process_host`: multi-valued host fields are chosen **deterministically per
user**: `sha256("<user_id>|<tag>|<remark>[|slot]")` mod `len(sorted(values))`, with independent
slots for address, `sni`, `host`, `port` and `short_id` [C:/code/app/subscription/share.py:285-360].
One row can list several names/IPs; each user always gets the same one on every refresh and
device, and a block on one IP only hits a slice of users. A policy key `pick_remarks` freezes
the hash input, so renaming rows never moves users [C:presentation_policy.py docstring].

### 2.5 Rotation observed within 24 hours (2026-11-02 -> 2026-11-03)
Re-fetching the same subscription the next day (v2rayNG UA) gave 28 rows with a **different mix**:
- The **Fastly block is gone** for this user; a new **🔐 TLS** block (7 rows) leads it.
  Shape: VLESS + TLS + `xtls-rprx-vision`, `tcp`, fp chrome, ALPN h2,http/1.1, port 443, with
  `vless_route` 4001-4007 selecting the exit. Address and SNI are **Hetzner reverse-DNS
  names** (`static.<a>.<b>.98.91.clients.your-server.de`, 91.98.x Falkenstein, AS24940), and the SNI
  is the rDNS name of a *different* cell. Checked from the USA VPS: 91.98.96.102 presents a
  **Let’s Encrypt** certificate (issuer YE2) for `static.133.164.107.91.clients.your-server.de`,
  issued 2026-11-03 09:42 UTC. So: real certificates, no owned domain, an SNI that looks like any
  Hetzner customer, rotated daily.
- **Reality moved** from `:8080` + `firmwaresign.partners.nvidia.com` to **random high ports
  (31931-39309)** on 4-hex labels of a fresh zone `denzaro.ir` (-> 91.107.150.62 / 5.75.207.110),
  SNI `www3.denzaro.ir`, new public key. The DE Reality row on `welzora.ir:8080` stayed.
- `Profile-Title` status emoji changed from ✅ to ⌛️ (expiring / low data).

Takeaway: the fleet changes transport, port, SNI and zone **per day**; the subscription is the
delivery channel for that churn, which is why the 6 h refresh interval matters.

## 3. Subscription pipeline

```
client --GET /sub/<token>--> Caddy (panel.hexogate.net / .com / reseller and tenant hosts)
   encode gzip ("compressed answers fit in one TCP flight")            [H:Caddyfile:23-31]
   --> UDS sub-renderer-canary.socket (lb_try 20 s; no raw-panel fallback:
       502/503 means the client keeps its old list)
       renderer = stock PasarGuard subscription router only (no dashboard, nodes, scheduler);
       catalog refreshed from DB every 30 s; 15 s render cache   [H:/opt/pasarguard/overrides/group8-sub-renderer/sub_renderer.py]
       1. app-only filter (some rows only when UA matches "Hexogate/1.0")
       2. group presentation policy (visibility per group, curated scopes, renames)
       3. order_hosts_for_user (method blocks, fixed country order, optional live scores)
       4. per-user stable pick (address / SNI / Host / port / short-id)
       5. format by User-Agent (links | xray json | sing-box | clash / clash-meta | outline | wireguard)
   tenant host sub.blurayteam.ir --> hexo-sub-signer --> renderer; adds X-Hexo-Sub-Sig
```

### 3.1 Token
- Shape: `base64url("v3,<user_id>,<unix_ts>")` + `.` + 43 base64url chars (32 bytes, a full
  SHA-256-sized MAC). That is newer than Marzban's `base64(username,ts)` + 10-char truncated
  `sha256(data+secret)`. The token is minted by the panel (`app/utils/jwt.py`), **not** by
  hexo-sub-signer.
- The timestamp is the issue time (about 1 day before the user's `expire`), so the URL does not
  itself expire; access ends with the user's expiry or a token reset. The exact MAC input was
  not dumped from the private image (open question).

### 3.2 hexo-sub-signer (signs bodies, not tokens)
[H:/opt/pasarguard/hexo-sub-signer/hexo_sub_signer.py:1-97] Only for a tenant-owned host
(sub.blurayteam.ir). It fetches the normal answer (renderer first, panel on failure) and adds
`X-Hexo-Sub-Sig: v1.<unix-ts>.<base64url(DER ECDSA-P256-SHA256 signature)>` over
`b"hexo-sub-v1\n" + ts + b"\n" + hex(sha256(body))`. The tenant's app embeds the public key and
rejects lists not signed by Hexogate. Container: `network_mode: none`, UDS only, 192 MB.

### 3.3 Headers (sample)
- `Profile-Title: base64:` "✅ <user> · 400.94 MB · 1405-08-12" (status emoji, data left, Jalali expiry);
- `Profile-Update-Interval: 6`;
- `Profile-Web-Page-Url` = the same `/sub/<token>` URL (HTML page for browsers);
- `Subscription-Userinfo: upload; download; total; expire`;
- `Content-Disposition` filename = user code;
- `Announce: base64:`, `Announce-Url`, `Support-Url` (empty);
- `Cache-Control: no-cache, no-store`, `Expires: 0`.

### 3.4 Ordering and presentation [C:/code/app/subscription/presentation_policy.py]
- Blocks (same for all groups since 2026-10-31): info -> VIP -> HTTP -> HTTPS -> Reality ->
  Fastly -> Shadowsocks -> other. The code cites the measured 24 h in-app connect success:
  "HTTP 76-82 %, HTTPS 72-87 %, Reality 67-76 %, Fastly 59-64 %, SS 55 %".
- Inside a block: fixed country order NL, NL2, DE, TR, TR2, SE, US, CA, RO.
- `USE_LIVE_SCORES = False` ("owner 2026-10-31: disable the auto switch order"). When on, the
  sort key is (block, unhealthy, -score, country, host id): unhealthy rows sink within their block.
- Block and country are parsed from the **remark**: `<flag> <CC> ▸ <emoji> <method>`
  (`🌐 HTTP`, `🔒 HTTPS`, `🛡 Reality`, `🚀 Fastly`, `🧦 Shadowsocks`).
- Policy JSON `group-presentation-policy.json` (~40 KB, reloaded on change within 2 s; an
  invalid edit keeps the last good one): `host_group_visibility`, per-group `scopes`
  (regex + selected host ids + optional rename), `hide_unless_non_target_authorized_host_ids`,
  `pick_remarks`. More than 60 timestamped backups show it is the main operational lever.
- Duplicate info rows de-duplicated; equal names get " 2", " 3" by host id; per-reseller
  `ADMIN_NOTE_ROWS` add a notice row. Everything fails open.

### 3.5 Usage pseudo-link
Row 0 is a real, working link whose remark is the usage template (`{USERNAME}`, Jalali expiry,
used/total), so every client shows usage. Code note: sing-box/Hiddify drop XHTTP rows, so note
rows are copied from a plain HTTP row instead.

### 3.6 Per-client formats
PasarGuard selects the format from the User-Agent [C:share.py:44-80]; the measured result is in 3.7.

### 3.7 Per-client output (measured 2026-11-03, same token, `curl -A`)
| User-Agent | Format | Notes |
|---|---|---|
| `v2rayNG/1.10.20` | plain-text links (not base64), 28 rows | includes the XHTTP info row |
| browser, unknown, `Hexogate/1.0`, `sing-box/1.12.0`, `Hiddify/2.5.7` | base64 links, 28 rows | `Hexogate/1.0` would also unhide app-only rows (none for this user) |
| `HiddifyNext/2.5.7` | sing-box JSON: selector `proxy` + urltest `Best Latency` + 27 outbounds | **info row dropped** (no XHTTP in sing-box); HTTP rows use the sing-box `http` transport |
| `Streisand/1.6` | Xray JSON array, 28 full configs (`proxy` vless + DIRECT + BLOCK) | 86 KB |
| `clash-verge/v2.2.3`, `ClashMeta/1.19` | Clash-Meta YAML, 28 proxies + groups `PROXY`, `Fastest` | types `vless`, `ss` |

Headers are identical across formats, and so is the order (the policy is format-agnostic).

## 4. Health, load and failover

| Component | Interval | What it does |
|---|---|---|
| `hexo-sub-scorer` | 2 min | Row score = 1 - utilisation of the **worst box on its path** (front + exit). u = max(bw/cap, (cpu+steal)/100, 0.6 x load1/cores, 0.5 x tcp/tcp_cap, memory penalty); EWMA alpha 0.3; cap from `/etc/hexo-sub-scorer/capacity.json` or max(1.15 x 24 h max, 500 Mbps); a box flat at its 24 h max counts as saturated. Unhealthy if a node on the path is not connected, the Iran quorum says unreachable, or row-doctor's last real-client test failed. Hysteresis 0.12 over 2 runs, quantised to 0.05. Atomic write of `sub-load-scores.json`; the renderer ignores it when older than 10 min or `enabled=false` [H:/usr/local/libexec/hexo-sub-scorer:1-278] |
| `hexo-row-doctor` | 30 min | Pulls a reference user's subscription, tests rows with a real client, switches dead rows off/on, Telegram |
| `hexo-iran-quorum` | 10 min | Reachability from Iranian vantages (relays + a home PC) -> `iran-quorum/latest.json` |
| `hexo-autoheal-v2` | 2 / 5 min | Probes from Iranian vantages (ssh forced commands, xray probes to `cp.cloudflare.com/generate_204`), moves DNS for direct and VIP names, DNS-hijack survey of subscription domains |
| `hexo-node-serve-watch` | 30 s | Reconnects "connected but not serving" nodes |
| `hexo-health`, `hexo-fleet-alerts`, `hexo-panel-vitals`, `hexo-hc-deadman` | 1-30 min | One Telegram sender; app telemetry (config deaths, connect-success floor) |
| `hexo-datacenter-asn-enforce`, `hexo-attack-asn-observer` | 1 h / 15 min | Accounts used from datacenter ASNs (resale) are enforced; `ir-asn.tsv` |
| Hexogate app | continuous | In-app config-health / config-speed / diagnostics posted back through the Iran front (Caddy `app_api`) |

## 5. Why it works on every Iranian ISP and is fast
1. **No Iranian datacenter on the Economy path.** Residential ISP -> foreign DC directly, so the
   DC-level international policing Afrows hits (per-flow upload cut, frozen REALITY) never applies.
2. **Front/exit split with route selectors.** A few well-reachable Hetzner DE/FI "cells" take the
   Iranian handshake; exits in other countries are reached DC-to-DC. One name + port/route/path
   serves many countries, so fewer IPs need to stay clean.
3. **Transport diversity per country**, ordered by **measured** in-app success.
4. **DNS failover from Iranian vantages** with budgets and hysteresis; many zones.
5. **Per-user sharding** of addresses/SNIs: one blocked IP never kills every user.
6. **Hardened subscription delivery**: gzip into one TCP flight, an Iran front for the panel,
   503 rather than a broken list, 6 h refresh, body signatures for tenant apps.
7. Continuous real-client testing (row-doctor, app telemetry) driving hide/show.

## 6. Free or near-free building blocks for the same design (Iran, late 2026)
| Option | What it gives | From Iran | Limits / risk |
|---|---|---|---|
| **Hetzner rDNS + Let’s Encrypt** (no domain cost; box ~4-5 EUR/month) | Real TLS certificate for `static.*.clients.your-server.de`; Hexogate lead transport since 11-03 | Works for Hexogate today (top block) | Needs Hetzner boxes; the rDNS zone could one day be SNI-blocked wholesale |
| **Cheap `.ir` zones** (~1-2 USD/year each) | Disposable entry names, DNS failover, domestic-looking DNS | Resolve reliably inside Iran | Needs an Iranian registrant (nic.ir); a zone can be seized or SNI-filtered |
| **Fastly developer account** | Domain fronting (SNI of a big Fastly customer, Host = own `*.global.ssl.fastly.net`), XHTTP | Fastly stayed reachable when Cloudflare was blocked; Hexogate used it until 11-02 (59-64 % app success, second lowest) | Free allowance (sources disagree: 50 USD credit vs ~100 GB/month), card now required, few services; proxying breaks ToS, so account-ban risk |
| **Gcore free CDN** | 1 TB/month, free TLS | Hexogate uses Gcore Labs for RO-01 (Bucharest) and a node named `node-uk-gcore` "HTTP80 + CDN" | 1 TB cap; card requirement unclear; CDN ranges may be filtered like Cloudflare |
| **Cloudflare Workers / CDN** | Free WS/XHTTP relay | VLESS+WS behind CF is SNI-blocklisted within ~24 h and fragmenting is defeated by reassembly (Lantern 2026); Hexogate retired its CF rows on 2026-10-16 (policy backups `cfretire`) | CF terms forbid proxying VPN traffic; only ECH rows passed Hexogate relays |
| **Oracle Cloud Always Free** | ARM VM, generous egress | Usable as an exit | Oracle export terms bar access by Iranian nationals; idle instances are reclaimed; needs a non-Iranian card. Not for a commercial service |
| **Existing Afrows USA/DE boxes** | Zero new cost | Already deployed | Add the front/exit transports there first (Phase 0) |

Ranking for Afrows: (1) Hetzner front cells with rDNS + LE TLS + Vision and `vlessRoute` exit
selection; (2) many cheap `.ir` zones with DNS failover; (3) Fastly fronting as a secondary path;
(4) Gcore as a backup CDN. Cloudflare Workers and Oracle free are not worth building on.

## 7. Open questions
- Exact MAC construction behind the `v3` token, and how a per-user token reset works.
- Front-node core configs (inbound tags, `vlessRoute` rules, front -> exit chain transport) live in
  MySQL `core_configs`, which was not read (DB credentials). The scorer proves the chain exists
  (front inbound -> routed outbound -> exit IP) but not its transport.
- Iran side of the panel front: `panel.hexogate.com` resolves to **81.30.108.245 (Web Dadeh,
  Tehran, AS49556)**; `panel.hexogate.net` to the OVH panel directly. The Fastly service used by
  the front tunnel was not identified.
- Registrar / DNS API that autoheal drives for the `.ir` zones (no credentials in the config; that
  code path was not read).
- How the daily TLS/Reality rotation (new zone, ports, LE certs) is automated; files in /root such
  as `claude-cellsisp-*` and `claude-cellswap` suggest operator/agent-run rotations.

## 8. Sources
- Host: /opt/pasarguard/{docker-compose*.yml, Caddyfile, hexo-sub-signer/hexo_sub_signer.py,
  overrides/group8-sub-renderer/*}, /usr/local/libexec/hexo-sub-scorer, /etc/hexogate/autoheal.json,
  /etc/hexogate/autoheal-v2.json, /etc/hexogate/front-tunnel/origin.json (ids masked),
  /var/lib/pasarguard/sub-load-scores.json, systemd unit descriptions.
- Image: /code/app/subscription/{presentation_policy.py, share.py, base.py, links.py}.
- Upstream: https://github.com/PasarGuard/panel, https://github.com/PasarGuard/node;
  Xray routing (`vlessRoute`): https://xtls.github.io/en/config/routing.html
- ASN: ipinfo.io lookups from the Afrows USA VPS, 2026-11-03.
- Iran DPI 2026: [Lantern: SNI blocklist without DNS record](https://corpus.lantern.io/findings/2026-pooribitwise-iran-advanced-dpi__iran-sni-blocklist-without-dns-record/),
  [Lantern paper](https://corpus.lantern.io/papers/2026-pooribitwise-iran-advanced-dpi/),
  [Lantern shutdown analysis](https://corpus.lantern.io/findings/2026-tuleo1-internet-analysis-shutdown__iran-dpi-not-ip-blocks/),
  [LowEndTalk: Fastly reachable while Cloudflare blocked](https://lowendtalk.com/discussion/comment/4447908/),
  [Cloudflare community on proxy ToS](https://community.cloudflare.com/t/vpn-proxy-not-allowed-while-logging-in/709363).
- Free tiers: [Fastly developer accounts](https://www.fastly.com/blog/its-free-instant-and-yours-fastlys-free-developer-accounts-are-here),
  [Fastly account types](https://www.fastly.com/documentation/guides/organizations-and-accounts/billing/account-types/),
  [CostBench Fastly free plan](https://costbench.com/software/cdn-edge/fastly/free-plan/),
  [Gcore free plan (fitgap)](https://us.fitgap.com/products/013022/gcore), [cdnplanet Gcore](https://www.cdnplanet.com/cdns/gcore/),
  [Oracle Free Tier FAQ](https://www.oracle.com/sa-ar/cloud/free/faq/), [Oracle export terms as quoted by UANI](https://www.unitedagainstnucleariran.com/node/27440).

## 9. Corrections to `docs/hexogate-reference-and-afrows-roadmap.md`
- "Per-node derived UUIDs" -> Xray **`vless_route`** exit selector (same UUID; 3rd group = route id).
- "Customers connect directly" holds for Economy rows; **VIP rows go through Iranian relays**
  (ParsAbr AS198154), and the panel has an Iranian front (Web Dadeh AS49556).
- Not 5 node IPs but about 47 boxes (Hetzner DE/FI "cells" as fronts; Leaseweb, Linode/Akamai,
  Gcore, Datacamp, Netlen and others as exits), with several PasarGuard node containers per box.
- Ordering is **static** now (`USE_LIVE_SCORES = False` since 2026-10-31); the scorer still runs.
  Block order HTTP -> HTTPS -> Reality -> Fastly -> SS, and since 11-03 a TLS block first.
- hexo-sub-signer signs **response bodies** for one tenant app; it does not issue tokens.
- Transports rotate daily (Fastly removed, Hetzner-rDNS TLS + Vision added, Reality moved).

## 10. What Afrows should copy, in order
1. **Front/exit split with `vlessRoute`**: one or two clean foreign front IPs, many exits; the exit
   is chosen by UUID route bytes (Reality/TLS), port (HTTP-obfs) or path (CDN). Xray >= 25.x.
2. **TLS + Vision on Hetzner rDNS names with Let’s Encrypt** as the lead transport, HTTP header +
   VLESS Encryption (ML-KEM) second, Reality on a random high port third.
3. **Per-user stable pick** (sha256(user_id|row|slot)) over several names/IPs per row.
4. **DNS failover** of disposable names, driven by probes from inside Iran (Afrows already has the
   Iran VM and home routers as vantages; the observatory can feed it).
5. **Subscription polish**: Jalali usage title, usage info row, 6 h interval, gzip, 503 instead of
   an empty list, User-Agent specific formats (PasarGuard code is a good reference).
6. **Measured ordering**: block order from real connect-success telemetry; unhealthy rows sink.
