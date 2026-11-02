# Hexogate reference architecture and the Afrows egress roadmap

Written 2026-11-02. Sources:
- a live Hexogate subscription, decoded (no user ids recorded here);
- the public `ipinfo` ASN data for every entry IP;
- read-only inspection of the Hexogate panel host (container list, file layout, doc headings and setting **names** only; no secrets, database or configs read);
- Afrows' own measurements from 2026-10-20 to 2026-11-02 (`.claude/skills/iran-dpi-playbook/SKILL.md`, `scripts/observatory/`).

The operator reports that Hexogate links work on every Iranian ISP and are faster than Afrows. This document explains why, and what Afrows should change.

## 1. How Hexogate is built

### 1.1 Control plane and data plane are separate

| Layer | Where | What |
|---|---|---|
| Panel (control plane) | OVH Frankfurt (162.19.253.235), Docker | PasarGuard (open-source Marzban fork), customized `hexogatepanel` images; MySQL; Caddy (TLS, `panel.hexogate.com`); `hexo-sub-signer` (signed subscription tokens); `pasarguard-sub-renderer` (custom subscription output); Telegram sales bot (`/opt/hexogate-bot`, FastAPI + Postgres + Redis, SvelteKit web app) |
| Nodes (data plane) | Hetzner Nuremberg (91.107.150.62, 91.107.151.253, 91.107.254.41, 5.75.207.110), Leaseweb Frankfurt (109.70.74.95) | Xray cores managed by the panel; customers connect to them **directly** |
| CDN entry | Fastly (199.232.x) | XHTTP behind domain fronting |

The panel never carries customer traffic. Losing it stops sales and new subscriptions, but nothing that is already connected.

### 1.2 The subscription (one URL, 28 links)

- **Token:** `base64("v3,<userId>,<expiry>")` + `.` + signature. It is versioned, signed and **expires**, and is issued by `hexo-sub-signer`.
- **Headers:**
  - `Profile-Title`: "✅ <user> · 400.94 MB · 1405-08-12", i.e. data left and expiry in the Persian calendar, shown by the app;
  - `Profile-Update-Interval: 6` (hours);
  - `Profile-Web-Page-Url` (a button that opens the user panel);
  - `Announce` and `Support-Url` (empty today);
  - `Content-Disposition` filename = user code;
  - standard `subscription-userinfo`.
- **First link** = a working link whose *name* is the usage readout ("👤 user ▸ 📅 date ▸ 💠 99 MB / 500 MB"), so every client shows usage.
- **Ordering:** `pasarguard-sub-renderer` reads `SUB_LOAD_SCORES_PATH` and a group presentation policy, so links are ordered by live node load and health, and clients that pick the first entry get the healthiest node.

### 1.3 Exits × transports

There are 7 exit countries (NL, NL2, DE, TR, SE, US, CA, RO). Each is reachable by **several independent transports**; the client tests them and uses whichever passes on that ISP that day.

| Transport | Shape | Why Iranian DPI passes it |
|---|---|---|
| A. HTTP-obfuscated VLESS + VLESS Encryption | `tcp`, `headerType=http`, Host `dynu.com`, no TLS, `encryption=mlkem768x25519plus…`; **one entry IP, one port per exit country** (2091–2096) | No TLS ClientHello to fingerprint; looks like plain HTTP; the payload is post-quantum encrypted |
| B. TLS with a decoy Host | SNI = own `.ir` name, Host `play-fe.googleapis.com`, `fp=chrome` | Ordinary HTTPS |
| C. REALITY | SNI `firmwaresign.partners.nvidia.com`, port **8080**, `fp=chrome` | Borrows a real certificate; non-443 works because the entry is a foreign DC reached from residential ISPs |
| D. Fastly-fronted XHTTP | connect to Fastly, SNI `cdn.fastly.steamstatic.com`, Host = own `*.global.ssl.fastly.net` service, XHTTP `mode=auto`, `ed=2048`, `xPaddingBytes 100-1000`, ALPN h2 | **Domain fronting** (Fastly permits SNI ≠ Host; Cloudflare does not). Blocking it means blocking Steam's CDN. XHTTP splits flows (see §2) |
| E. Shadowsocks | random high ports per exit | Simple fallback |

- **Fingerprints** are mixed (chrome, firefox).
- **Entry names** are random subdomains on several `.ir` domains (salzivo, valzema, welzora, tanzora). DNS looks domestic, names are disposable, and one blocked domain does not take the rest down.

## 2. Afrows today, and where it breaks

```
customer --(Shatel link)--> Iran DC entry 185.252.30.123 (Artak, Mashhad)
        --XHTTP / CF->DE backup--> USA exit 93.127.140.50 (Database Mart, Kansas City, 195 ms)
customer --(Germany/USA links)--> Cloudflare --> DE exit (OVH, shared with the Hexogate panel) / USA exit
```

| # | Bottleneck | Evidence | Hexogate's answer |
|---|---|---|---|
| B1 | **Foreign traffic from customers on the Shatel link crosses an Iranian datacenter first.** Since Oct 2026, Iranian DCs police international flows: per-flow upload drop after ~40 packets, frozen REALITY flows, Cloudflare blocked | upload 0.03–0.23 MB/s until XHTTP; `iran-dpi-playbook` | Customers connect from residential ISPs **straight to foreign nodes**; DC→abroad policing never applies |
| B2 | **The Iran entry is one VM at one provider.** It also hosts the bot, the subscriptions, the dashboard and the database | 2026-11-02: the provider froze the VM for 11.5 h and everything died | Panel and nodes are separate; several nodes at two providers |
| B3 | **One far exit at one provider** that applies 20-min outbound blocks | 8+ blocks 2026-10-27..11-02 (`infra/usa/README.md`) | 7 exits; Hetzner/Leaseweb (Europe, ~60–80 ms from Iran) |
| B4 | **One transport per link**, so if DPI flags it, the link is dead until we change code | chrome fp blocked on Shatel, REALITY freezes, WireGuard blocked | 5 transport families per exit; the client picks |
| B5 | **The CDN path is Cloudflare only**, on afrows.com-family names, fingerprint-sensitive | Shatel blocked fp=chrome to CF; DC→CF blocked with chrome | Fastly domain fronting with a famous SNI |
| B6 | **The subscription, bot and dashboard are served from the Iran VM** | Subscription refresh failed during the freeze and during USA→Iran cuts | The panel is abroad, independent of the data plane |
| B7 | **Distance:** the USA exit is ~195 ms from Iran; TCP throughput falls with RTT under loss | measured RTT | European nodes ~3× closer |
| B8 | **Static subscription order**, so clients may sit on a degraded link | — | Load-score ordering |

Afrows strengths to keep: XHTTP one-POST-per-connection (the upload fix), the failover ladder with health probes, the observatory, the watchdog and Telegram alerts, the billing and bot product, and the Iranian entry for customers whose ISP blocks foreign IPs outright (keep it as **one** option, not the only path).

## 3. Roadmap

### Phase 0: no purchases (start now)
1. **Transport diversity on the existing exits.** On the USA box, add customer-facing inbounds and ship them as extra subscription links:
   - REALITY without Vision, fp ios, on a public port: tested 10/10 from Shatel on 2026-10-26;
   - VLESS + `headerType=http` + VLESS Encryption (Hexogate transport A);
   - XHTTP packet-up with one POST per connection (our proven upload fix) for direct client use.

   Note: these open public customer ports on the USA box, which needs firewall review.
2. **Subscription polish:**
   - usage and expiry in `Profile-Title`;
   - a usage-readout first link;
   - `Profile-Web-Page-Url` pointing to the customer panel;
   - refresh every 6 h;
   - optional expiring tokens.
3. **Health-ordered subscription:** order links by the observatory's current per-path success rate, Hexogate-style load scores.

### Phase 1: European nodes (needs the operator)
4. Buy **2 Hetzner VPS** (e.g. Nuremberg and Helsinki; CX22 is enough to start). Each one becomes a **node**: Xray with transports A–E and its own exit. Customers connect directly. The Iran entry stays as the "Shatel" fallback only.
5. Node provisioning and user sync reuse the existing XrayProvisioningService pattern (the backend already pushes users to the USA and Germany inbounds).
6. Per-node health in the observatory, plus Telegram alerts (watchdog pattern).

### Phase 2: CDN fronting (needs the operator)
7. A **Fastly account** + one service whose origin is a node's XHTTP inbound. Ship Hexogate-style transport D (SNI of a large Fastly customer, Host = our service).

### Phase 3: control plane off the Iran VM
8. Move the **subscription endpoint** (at minimum a read-through cache), the **bot** and the **dashboard** to a foreign host, so an Iran-DC freeze no longer stops sales, refresh or support. The Iran VM keeps only the Iran entry.
9. Optional: entry names on cheap rotating **`.ir` domains**, which needs `.ir` domain registration.

### What the operator needs to provide
| Item | For | Priority |
|---|---|---|
| 2× Hetzner VPS (root SSH key access) | Phase 1, the biggest win | **High** |
| Database Mart ticket about the 20-min outbound blocks | stop current USA outages | **High** |
| زیرساخت account check (balance, auto-renew) | prevent another VM freeze | **High** |
| Fastly account | Phase 2 | Medium |
| A foreign host for the control plane (can be one of the Hetzner VPS) | Phase 3 | Medium |
| `.ir` domain(s) | Phase 3, optional | Low |

## 4. Rules carried over
- Hexogate and Afrows stay separate: read-only learning only, no shared infrastructure changes (operator, 2026-10-20).
- Never use Borjino.
- Key-based SSH only.
- No secrets, tokens or user ids in the repo.
