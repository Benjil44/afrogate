# Afrows migration plan: Hexogate-style data plane, Afrows product

Written 2026-11-03 by the CTO / principal architect role. Status: **proposal for operator decision**.
Nothing here has been built, bought or deployed.

Inputs: `01-data-plane-and-subscription.md` (authoritative where it disagrees with the first pass),
`02-product-bot-and-ui.md`, `../hexogate-reference-and-afrows-roadmap.md` (B1-B8), `.claude/memory.md`,
`docs/invariants.md`, `infra/usa/README.md`, `infra/ubuntu/relay/README.md`, the `iran-dpi-playbook`
skill, `scripts/afrows-egress-mode-sync.py`, `scripts/afrows-de-edge-agent.py`,
`apps/backend/src/client/*` (link builder, provisioning, subscription token), `apps/backend/src/edge/`,
`apps/backend/src/telegram/*`.

Rules carried into every phase:
- Hexogate and Afrows share **nothing**: no host, account, firewall, DNS zone, certificate, key or code
  copy. Hexogate was read-only reference material.
- The Germany exit on the OVH box (162.19.253.235) is shared with the Hexogate panel. Afrows **leaves it**
  as part of this plan (Phases 1-2), without touching anything Hexogate owns.
- Never use Borjino. Key-based SSH only. No secrets, tokens, customer ids or IPs of customers in the repo.
- Privacy and human rights: the plan reduces what lives in Iranian jurisdiction (today the whole
  customer DB sits on an Iranian DC VM) and never adds customer-level tracking.
- Low-resource VPS: every new box is small, every new daemon is a stdlib Python timer or Xray itself.

---

## 0. Decision summary

| # | Decision |
|---|---|
| D1 | Customers connect **directly from their residential/mobile ISP to foreign front nodes**. The Iranian DC stops being the default entry (fixes B1, the root cause of the slow, frozen Shatel link). |
| D2 | **Front/exit split with `vlessRoute`**: a few clean front IPs take the Iranian handshake; the exit country is selected by UUID route bytes (TLS/REALITY/XHTTP), port (HTTP-obfs) or path (CDN). One UUID per client config, unchanged. |
| D3 | **Five transport blocks per front**, lead = VLESS+TLS+Vision on a provider reverse-DNS name with a Let's Encrypt certificate. Plus HTTP-header + VLESS Encryption, REALITY on a random high port, XHTTP packet-up (Afrows' own measured upload fix), Shadowsocks-2022. |
| D4 | **Control plane (backend, DB, bot, dashboard, subscriptions) moves off the Iran VM** to a foreign host at a provider that is not the fronts' provider and not OVH. The Iran VM becomes a data-plane node (relay tier, router/WireGuard customers, Iranian probe vantage). |
| D5 | **Node agent pull model** (generalising `scripts/afrows-de-edge-agent.py`): nodes pull their desired user list and push usage. No node management API port is ever exposed. Users are persisted on the node, so an Xray restart never drops them. |
| D6 | **Subscription engine rebuilt as a typed row model**: block/country static ordering, per-user stable sharding, `vlessRoute` rendering, User-Agent formats, usage readout, 6 h refresh, gzip, 503 instead of a partial list. Afrows' HMAC token and PII-free bodies stay. |
| D7 | **DNS autoheal** of disposable entry names, driven only by **residential** Iranian vantages, implemented with the same pure `decide()` pattern as INV-17 (hysteresis, breaker, budgets). |
| D8 | Product parity follows the 02 build order; Afrows keeps bilingual typed copy, volume billing, gems, route control and its privacy posture. |

Target in five lines:
1. Iranian residential client -> disposable name -> foreign **front** (Hetzner DE/FI, plus one other provider) -> **exit** chosen by `vlessRoute`/port/path.
2. Each front serves 5 transport blocks; per-user sharding spreads users over names/IPs/ports so one block hits a slice.
3. The Iran VM is only an optional relay tier (kept where measurement shows it helps), router endpoint and probe vantage.
4. Backend, DB, bot and subscriptions run on a foreign control host; nodes pull state and keep serving if it is down.
5. Residential probes feed row health, DNS autoheal and rotation; Telegram alerts on every node, row and name.

---

## 1. Target architecture

```
                         Control host (foreign, provider X, not OVH, not the fronts' provider)
                         nginx + backend + Postgres + bot (direct Telegram, no proxy)
                         /sub/<token> (app.afrows.com via Cloudflare + a direct rDNS host)
                         /api/edge/nodes/:id/{clients,usage,health}  (per-node token)
                         dns-autoheal timer, watchdog, encrypted backups -> provider Y
                                   ^  pull desired users / push usage (HTTPS, DC to DC)
            +----------------------+-----------------------+-------------------------+
            |                      |                       |                         |
   Front+exit DE (Hetzner)  Front+exit FI (Hetzner)  Exit USA (Database Mart)  Iran VM 185.252.30.123
   TLS+Vision :443 rDNS/LE  same 5 blocks            exit only (+ CF row       relay tier ("Shatel" rows,
   HTTP+VLESSenc :20xx      own exit = FI            while it measures well)   XHTTP chain to an exit),
   REALITY :3xxxx           vlessRoute -> DE/US      WireGuard from fronts      router/WG customers,
   XHTTP+VLESSenc :20xx                                                         village gaming path,
   SS-2022 :3xxxx                                                               Iranian probe vantage
            |  WireGuard DC-to-DC (front -> exit), freedom outbound bound to wg-<exit>
            +---------------------------> exits (DE, FI, US, later NL/TR)

 Iranian residential client --(.ir / gTLD / rDNS name, sharded per user)--> front
 Old Iran server 94.74.145.199: DNAT forwarder ("Shatel 2"), kept only while it measures better
 OVH 162.19.253.235 (Hexogate): no Afrows traffic after Phase 1, no Afrows files after Phase 2
```

### 1.1 Element by element

| Element | Verdict | How Afrows does it | Why |
|---|---|---|---|
| Fronts and exits on foreign providers | **Adopt** | 2 Hetzner boxes (DE Falkenstein/Nuremberg, FI Helsinki), each **front and exit** for its own country; USA stays an exit; a third provider added in Phase 1b for diversity | Hexogate's speed and ISP coverage come from residential -> foreign DC with no Iranian DC on the path (01 section 5.1). Afrows' measured DC-to-abroad policing (per-flow upload cut after ~40 packets, frozen REALITY) disappears on this path. Front=exit on day one keeps the box count at 2 |
| Customers connect directly | **Adopt** | Direct rows are the default blocks; the Iran-entry rows move below them | B1. 01 section 1.3: Economy rows are direct for every ISP |
| Optional Iranian relay tier | **Adapt** | Keep the Iran VM `afrows-in` rows ("Shatel", "Shatel 2") as a relay block **only for ISPs where it measurably wins** (relay success >= best direct row + 10 points over 7 days, per ISP). The relay's upstream chain is the existing XHTTP packet-up chain, retargeted from the USA to a front's exit | Hexogate uses Iranian relays only for VIP. Afrows' Iran DC is policed for flows abroad, so the relay is a fallback for ISPs that block foreign IPs, not a speed path |
| Control plane off the Iran VM | **Adopt (stronger than Hexogate)** | Foreign control host; Iran VM keeps no DB, no customer list, no backups | B2/B6: the 11.5 h freeze on 11-02 stopped sales, refresh and support. Also a human-rights issue: the customer DB (Telegram ids, phone hashes, usage) is in Iranian jurisdiction today |
| Panel "Iran front" (Hexogate fronts its panel via an Iranian host + Fastly) | **Skip for now** | Subscriptions via Cloudflare (`app.afrows.com`, body fits one flight) plus a second direct host; an Iran-side read-through cache only if measurement shows ISPs that reach neither | Afrows' measured Shatel freeze on CF with afrows SNI starts after ~64 KB; a gzipped subscription is far below that. Adds an Iranian component we are removing |
| Per-user sharding | **Adopt as Hexogate does it** | `sha256("<clientConfigId>|<pickKey>|<slot>")` mod `len(sorted(values))`, independent slots for address, SNI, host, port, short-id; `pickKey` is a stable row key, never the remark | One blocked IP hits a slice, not everyone; deterministic across refreshes and devices (01 section 2.4) |
| `vless_route`-style routing | **Adopt** | Renderer rewrites the 3rd UUID group with the row's route id; fronts route by Xray `vlessRoute`. Priced exits (USA 2x) get their **own front inbound and email suffix** so per-user stats still separate them | One user, one UUID, many exits through one clean IP. Xray stats are per user, not per user per outbound, so the multiplier needs a separate email (see 1.3) |
| Front -> exit transport | **Adapt** | WireGuard between DC boxes (kernel, near-zero CPU), Xray `freedom` outbound with `sockopt.interface wg-<exit>`; optional per-row balancer to a fallback exit | DC-to-DC abroad is not censored; WireGuard avoids double TLS on 1-2 vCPU boxes. Hexogate's chain transport is unknown (01 section 7) |
| `.ir` / rDNS names with DNS autoheal | **Adapt** | rDNS + LE first (free, no domain); disposable zones second (`.ir` only if the operator accepts the nic.ir registrant exposure, otherwise cheap gTLDs); DNS-only provider with API and TTL 60; autoheal from residential vantages only | deSEC (afrows.com) enforces TTL >= 3600, useless for failover. A DC vantage misjudges residential reachability. Many zones, not many labels in one zone (01 section 2.3) |
| TLS+Vision on rDNS/LE certs | **Adopt** (lead block) | Xray TLS inbound :443 with the box's rDNS name and an LE cert (HTTP-01 on :80), `fallbacks` to a local decoy page, fp default `ios` | Hexogate's newest lead block (01 section 2.5). Afrows measured on Shatel: `chrome` fp blocked, `ios` passes, so fp is a per-row field |
| REALITY on random ports | **Adopt** | No Vision, fp `ios`, random port in 30000-39999 per front, per-row short-ids, SNI chosen by measurement | 67-76 % in Hexogate's app data; Afrows' REALITY freezes were DC-to-abroad, not residential-to-abroad |
| HTTP header + VLESS Encryption | **Adopt** | `tcp` + `headerType=http`, `security=none` **only with** `mlkem768x25519plus` VLESS Encryption; port = exit selector | Hexogate's best measured block (76-82 %); no TLS ClientHello to fingerprint |
| XHTTP packet-up + VLESS Encryption | **Afrows strength, keep** | One POST per connection (`xmux` all fields set), offered direct to fronts and as the relay chain | Afrows' measured 15x upload fix (playbook); not in Hexogate's set |
| Fastly fronting | **Adapt, defer (Phase 3, optional)** | One service, one row block, flag-gated, after the operator accepts the ToS/account risk | 59-64 % success, second lowest; Hexogate removed it for the sample user on 11-03; card required; proxying breaks ToS |
| Gcore free CDN | **Adapt, optional (Phase 3)** | Backup CDN row for one exit | Free 1 TB; ranges may be filtered like Cloudflare; measure first |
| Cloudflare rows | **Adapt (shrink)** | Keep "USA CF" at the bottom while it measures well; retire "Germany CF" (it lands on the shared OVH box) | Hexogate retired CF on 10-16; Afrows still has users whose ISP passes it with fp ios |
| Shadowsocks | **Adopt, but SS-2022** | `2022-blake3-aes-128-gcm` multi-user, per-client key derived server-side from a node secret | Hexogate uses legacy `chacha20-ietf-poly1305` (weaker against replay/active probing) |
| Hysteria2, WireGuard as customer entries | **Skip** | - | Measured: Hysteria2 never handshook from Shatel; WireGuard blackholed after handshake |
| UA-aware rendering with stable ordering | **Adopt** | links (base64) default; sing-box JSON for HiddifyNext; Clash-Meta YAML for clash/mihomo; per-format capability table drops rows a format cannot express; same order in every format | 01 section 3.7 |
| Live-score ordering | **Adapt, default off** | Static order: block, then country, then row id. A light scorer may sink unhealthy rows inside their block, behind a flag | Hexogate itself turned auto ordering off on 10-31; Afrows' route-stability rules prefer predictability |
| Subscription token | **Keep Afrows** | HMAC-derived, only sha256 stored, rotatable by version | Better than Hexogate's v3 (user id in clear base64) |
| Body signatures (hexo-sub-signer) | **Skip** | - | Only needed for a tenant app; revisit with `apps/native-client` |
| Observability | **Adopt + adapt** | Row doctor (real-client probes from residential vantages), node serve-watch inside the node agent, light scorer, watchdog moved to the control host, Telegram alerts; extend `scripts/observatory/` | Afrows already has the observatory, watchdog and alert engine; what is missing is per-row, per-ISP truth |
| Datacenter-ASN enforcement, client telemetry | **Skip** (see section 4) | Aggregate counters only | Requires per-account client IP/ASN processing |

### 1.2 Data model (new tables, all Drizzle entities per INV-8, raw-SQL runtime per INV-9)

| Table | Purpose | Key columns |
|---|---|---|
| `dataplane_nodes` | One row per Afrows box that serves or forwards customer traffic | `id`, `server_id` (FK `servers`, reuses agent/access profile), `role` (`front_exit`, `exit`, `relay`), `country_code`, `provider_label`, `public_ipv4`, `rdns_name`, `enabled`, `maintenance`, `desired_version`, `applied_version`, `last_pull_at` |
| `subscription_rows` | One rendered link shape (a Hexogate "host row") | `id`, `pick_key` (stable), `block` (`tls`,`http`,`reality`,`xhttp`,`relay`,`cdn`,`ss`), `front_node_id`, `exit_node_id`, `selector` (`vless_route`,`port`,`path`,`none`), `route_id`, `inbound_tag`, `addresses text[]`, `ports int[]`, `snis text[]`, `hosts text[]`, `path`, `fp`, `alpn`, `flow`, `vless_encryption_client` (public), `reality_pbk`, `reality_short_ids text[]`, `access_kind` (maps to customer server access), `usage_multiplier`, `enabled`, `sort_country` |
| `row_probe_hourly` | Compact per-row health from vantages | `row_id`, `vantage_class` (e.g. `res-shatel`, `mobile-irancell`, `dc-zirsakht`; never a person), `hour`, `attempts`, `successes`, `p50_connect_ms`, `p50_down_kbps`, `p50_up_kbps` |
| `dns_names` (Phase 3) | Disposable entry names | `fqdn`, `zone`, `row_id`, `home_ip`, `current_ip`, `alternates inet[]`, `state`, `last_change_at` |
| `dns_change_events` (Phase 3) | Audit of every DNS move | `fqdn`, `from_ip`, `to_ip`, `reason_code`, `vantages_dead`, `at` |

No table stores customer IPs, destinations, ASNs or device inventories.

### 1.3 Metering, quota and the USA multiplier under `vlessRoute`

- Today exits meter users (`remote-exit-usage-metering.service.ts`, Germany/USA recorders). With fronts, the **front** sees every user's bytes; exits see only WireGuard tunnel bytes. Metering moves to the front node agent, which pushes per-email deltas with a monotonic `seq` (idempotent `client_usage_events`, source `node:<id>`).
- Xray stats have no per-user-per-outbound counter. A priced exit (USA 2x) therefore gets a **dedicated front inbound** (its own port or path) whose client entries use email `cc_<id>+us@afrows`; the backend maps the suffix to the multiplier. Unpriced exits share `vlessRoute` inbounds. `provisioningEmail()` in `xray-provisioning.ts` gains an optional suffix; the existing `cc_<id>@afrows` stays valid.
- Quota cut: the desired-user list excludes over-quota/blocked users; nodes pull every 30-60 s, so overshoot stays bounded by the pull interval (same order as today's 15 s poll + rmu). The `TODO(quota-cap)` inline cap stays a follow-up.
- Device limits: access logs stay **off** on every node. If enforcement is wanted, the node agent counts distinct source IPs per user in memory over the window and reports **counts only**.

### 1.4 Subscription contract (all formats)

- Order: block rank (initial `tls, http, reality, xhttp, relay, cdn, ss`; re-ranked by Afrows' own 7-day per-ISP data, operator-approved), then country order (operator setting, initial DE, FI, US), then row id. Deterministic; same in every format.
- First row: a real, working copy of the top row whose remark is the usage readout, e.g. `Afrows 12.3/25 GB 1405-08-30`. No customer name anywhere in body or headers.
- Headers: `Profile-Title` = `base64:` of `Afrows <left> GB <Jalali expiry>` with a status word; `Profile-Update-Interval: 6`; `Profile-Web-Page-Url` = customer panel; `Support-Url` = bot deep link; `Subscription-Userinfo` (existing app-display scaling kept); `Content-Disposition` filename `afrows`; `Cache-Control: no-store`.
- gzip at nginx; compressed body budget 48 KB (test-enforced). Internal failure -> 503 (client keeps its old list); unknown/disabled token -> the existing uniform 404.
- User-Agent is length-capped (256) before matching; unknown UA -> base64 links.

---

## 2. Phased plan

Versioning: each phase ships as one or more minor versions (`npm run version:minor`, CHANGELOG,
`npm run version:check`). Migration numbers below are indicative (last applied: `0066`).
High-risk areas (AGENTS.md section 10: billing, `customer_accounts`, Telegram, auth) run their linked
tests from `graphify-out/test_links.json` before and after each change.

### Phase 0: no purchases, existing boxes

**Goal.** Build everything that does not need a new box: the row-model subscription engine, the
`vlessRoute` and sharding code paths, residential measurement, and quick resilience fixes. Learn which
transports pass from residential ISPs to a foreign DC using the USA box.

| Id | Work item | Files / modules |
|---|---|---|
| P0.1 | **Residential row probe.** Extend the observatory with a `row-probe` mode: takes a list of rows rendered for a dedicated **probe client config** (not a customer), runs a throwaway Xray client per row, measures google 204 x10, 1 MB down, 256 KB up, connect ms; writes jsonl; interleaved rounds per the playbook. Runs on the operator's home Linux/PC on direct Shatel, on any Linux device at the village (Irancell/Mobinnet), and on the Iran VM (labelled `dc-zirsakht`) | `scripts/observatory/afrows-observatory-probe.py` (new mode), `scripts/observatory/analyze.py` (per-row/per-ISP table), `scripts/observatory/README.md` |
| P0.2 | **Subscription module extraction** (no output change): move `resolvePublicSubscription` out of the 8.5k-line `billing.service.ts` into a `SubscriptionService`; introduce the typed `SubscriptionRow` and an **env adapter** that yields today's 4 rows from `afrows-entry-link.ts` | new `apps/backend/src/subscription/{subscription.module,subscription.service,rows,env-rows}.ts`; `apps/backend/src/client/subscription.controller.ts`, `apps/backend/src/billing/billing.service.ts` (delegate), `apps/backend/src/app.module.ts` |
| P0.3 | **Ordering, headers, usage row, 6 h, 503, gzip** | `apps/backend/src/subscription/{order,headers,usage-row,jalali}.ts`; `apps/backend/src/client/subscription-token.ts` (interval 12 -> 6, title builder moves out); nginx sample `infra/ubuntu/nginx.conf.sample` (`gzip on` for `/sub/`, `gzip_types text/plain application/json application/yaml`) |
| P0.4 | **UA formats**: base64 links, sing-box JSON, Clash-Meta YAML; capability table per format | `apps/backend/src/subscription/{select-format,render-links,render-singbox,render-clash}.ts` |
| P0.5 | **`vlessRoute` and sharding as pure, tested code**, unused until Phase 1 | `apps/backend/src/subscription/{vless-route,shard}.ts`; `packages/shared/src/index.ts` (`SubscriptionRowBlock`, `SubscriptionRowSummary`) |
| P0.6 | **USA direct-entry experiment** (operator approval: opens public ports on the USA box): REALITY no-Vision fp ios on a random high port; VLESS TCP+HTTP header + VLESS Encryption on one port; XHTTP packet-up + VLESS Encryption on one port. Probe-only first (P0.1), shipped as rows only if they pass the gate below | `infra/usa/xray-config.template.json`, `scripts/afrows-add-tcp-inbound.py` / `scripts/afrows-chain-xhttp-add.py` patterns, `infra/usa/README.md` (firewall, rollback) |
| P0.7 | **Off-box encrypted DB backups** from the Iran VM every 6 h to the USA box and the operator PC (pull) | `scripts/drills/*`, backup units under `infra/ubuntu/` |
| P0.8 | **Known USA debt**: persist the runtime-only `afrows-us-ss` inbound into `config.json`; set `config.json` to `root:nogroup 0640` | `infra/usa/README.md`, `scripts/afrows-chain-reality-add.py` pattern |
| P0.9 | **Operator actions**: Database Mart ticket about the 20-min outbound blocks; زیرساخت auto-renew and balance | none |
| P0.10 | ADRs: 0013 front/exit data plane + `vlessRoute`; 0014 control-plane location; 0015 subscription contract. Invariants INV-20..23 (section 4.3) | `docs/adr/`, `docs/invariants.md`, `docs/decisions.json` |

- **Migrations/contracts:** none in the DB. Shared types added (additive). Subscription output changes
  (order, headers, first usage row, interval) are a customer-visible contract change: one bot broadcast.
- **Tests:** `node --test` units for `order`, `headers` (Jalali, no PII: assert no display name or
  Telegram id can reach the body/headers), `usage-row`, `select-format` (UA table incl. oversized UA),
  each renderer (golden files per format), `vless-route` (3rd group rewrite, route range 0-65535,
  version nibble untouched by Xray matching), `shard` (deterministic, uniform over 10k ids, renames do not
  move users), body-size budget. Existing `subscription-token` and billing tests unchanged and green.
  Python: unit test for the probe's verdict logic.
- **Rollout/rollback:** feature flag `AFROWS_SUBSCRIPTION_V2=true`; off = byte-identical legacy output
  (golden test). USA inbounds added live via `xray api adi` and persisted; rollback = `rmi` + restore
  config backup, as in `infra/usa/README.md`.
- **Risks:** USA outbound blocks also hit any direct USA row (entry is fine, egress is not), so P0.6
  proves transports, not reliability. Opening public ports on the USA invites scans: fail2ban is already
  strict; Xray inbounds only. The village vantage is often offline.
- **Acceptance (measured, 3 interleaved rounds, playbook method):**
  - With the flag on, every current customer's subscription renders in all three formats; compressed
    body <= 48 KB; 0 PII fields (test).
  - Row-probe data exists for >= 2 residential ISPs (Shatel + one mobile) for >= 3 days.
  - P0.6 gate: a direct USA row ships only if google 204 >= 9/10 on >= 2 residential ISPs and median
    upload >= 1.5 MB/s.
  - A 6-hourly encrypted backup restores into a scratch DB on the operator PC (row-count parity).

### Phase 1: first foreign front and exit nodes

**Goal.** Customers on every ISP get direct rows to Afrows-owned foreign fronts; the USA becomes one exit
among several; Afrows customer traffic leaves the shared OVH box.

| Id | Work item | Files / modules |
|---|---|---|
| P1.1 | **Node kit**: Xray (as `nobody` with `AmbientCapabilities=CAP_NET_BIND_SERVICE`, no 443 NAT hack), front template with the 5 blocks, nft firewall (only listed ports; SSH from the control host and operator only), LE cert for the rDNS name via HTTP-01 on :80 (port 80 answers ACME + a static page only), TLS `fallbacks` to a local decoy page, BBR+fq, MSS clamp, access log `none`, bittorrent and `geoip:private` blocked, journald retention 3 days | new `infra/node/{install.sh,xray-front.template.json,nftables.conf,afrows-node-agent.service,afrows-node-agent.timer,README.md}` |
| P1.2 | **Node agent** (generalised `afrows-de-edge-agent.py`): pull desired users + row/inbound config version, reconcile via local Xray API, persist to `config.json` under a lock; push usage deltas (`seq`); push health (xray serving, cpu, steal, load, bandwidth, tcp count); device counts only | new `scripts/afrows-node-agent.py` (stdlib only) + `scripts/test_node_agent.py`; keep `afrows-de-edge-agent.py` until OVH is retired |
| P1.3 | **Backend edge API per node**: `GET /api/edge/nodes/:id/clients`, `POST .../usage`, `POST .../health`; per-node token in `agent_tokens` with scopes `node:read`, `node:usage:write`; `/api/edge/de/*` kept as an alias until Phase 2 | `apps/backend/src/edge/{edge.controller,edge.service}.ts`, `apps/backend/src/agents/*` (token scopes) |
| P1.4 | **DB rows instead of env**: `dataplane_nodes`, `subscription_rows`, `row_probe_hourly`; the env adapter stays as fallback when no DB rows exist | `infra/postgres/migrations/0067_dataplane_nodes.sql`, `0068_subscription_rows.sql`, `0069_row_probe_hourly.sql`; `apps/backend/src/database/schema.ts`; `apps/backend/src/subscription/db-rows.ts` |
| P1.5 | **Front -> exit**: WireGuard DE<->FI and DE/FI -> USA; Xray routing rules on `vlessRoute` and inbound tag -> `freedom` bound to `wg-<exit>`; optional `balancer` with fallback exit per row (`strict` vs `fallback`, honouring route locks) | `infra/node/xray-front.template.json`, `infra/node/wg-*.conf.example`, USA side in `infra/usa/` |
| P1.6 | **Metering + multiplier**: usage source `node:<id>`, email suffix `+us` -> multiplier; quota exclusion through the pulled list | `apps/backend/src/client/{xray-provisioning.ts,usage-accounting.ts,remote-exit-usage-metering.service.ts}` (generalise to N nodes), `apps/backend/src/edge/` |
| P1.7 | **Customer server access mapping**: `access_germany` -> EU exits, `access_usa` -> US exit, `access_iran` -> relay rows; `ClientEntryLinkKind` widened additively (`'eu' | 'relay' | ...`) with the old values aliased | `packages/shared/src/index.ts`, `apps/backend/src/client/customer-server-access.ts` |
| P1.8 | **Probe ingestion**: vantages push row results (`POST /api/agents/row-probes`, scope `probes:write`) into `row_probe_hourly` | `apps/backend/src/agents/*`, `scripts/observatory/*` |
| P1.9 | **Dashboard**: Exits page tabs `?tab=nodes` (health, pull age, version) and `?tab=rows` (enable/disable, order, per-ISP success), en/fa in the typed layer | `apps/dashboard/src/pages/ExitsPage.tsx`, `apps/dashboard/src/nav-views.ts`, `apps/dashboard/src/i18n.ts` |
| P1.10 | **Leave the OVH box for traffic**: disable the "Germany CF" row; repoint `via-backup` (Iran VM chain) from Cloudflare->Germany to the Hetzner DE exit (XHTTP, measured from the Iran VM first) | `/etc/afrows/afrows.env` (`AFROWS_BACKUP_CHAIN_*`), `infra/ubuntu/relay/README.md` |
| P1.11 | **Relay tier verdict**: per-ISP comparison of "Shatel"/"Shatel 2" vs direct rows; relay rows kept only where they win (section 1.1) | data from P1.8 |

- **Migrations/contracts:** `0067`-`0069`; new edge API contract (versioned `v1` in the path or a header);
  shared types `DataplaneNodeSummary`, `SubscriptionRowSummary`, widened `ClientEntryLinkKind`.
- **Tests:** backend units for edge auth (wrong node token cannot read another node's list; revoked token
  401), idempotent usage (`seq` replay does not double count), multiplier mapping, quota exclusion,
  db-rows -> rendered rows golden files, access mapping. Python: agent reconcile (add/remove diff,
  persist under lock, survives a missing API), WireGuard/xray template `xray run -test` in CI where
  available. Billing/`customer_accounts` linked tests before/after. Dashboard Playwright for the two tabs
  + render-check at 390/1440, en/fa.
- **Rollout:** one front first (DE) with the probe client and the operator's own account; then 10 % of
  customers by hash (rows hidden for others via `pick_key` gate); then everyone. Existing 4 rows stay in
  the subscription below the new blocks during the whole phase.
- **Rollback:** disable rows (subscription refresh within 6 h; raw links keep working because old inbounds
  are untouched); node agent stop leaves the last user list serving; DB migrations are additive.
- **Risks:** Hetzner KYC may refuse the account (open question); LE rate limits on the shared
  `your-server.de` domain (fallback: set a custom rDNS on an Afrows-owned throwaway domain, or ZeroSSL);
  Iran filtering Hetzner ranges wholesale (mitigation: third provider in Phase 1b); abuse complaints
  (bittorrent blocked, privacy-safe abuse contact); front CPU at Vision + TLS for many users on 2 vCPU
  (watch `cpu+steal`, scale up the plan, not out).
- **Acceptance:**
  - On each measured residential ISP (>= Shatel FTTH, one mobile; MCI/TCI when a vantage exists), >= 2
    direct rows at >= 95 % google 204 success over 7 days.
  - Median download through the best direct row >= 2x the current "Shatel" link on the same line;
    median upload >= 2 MB/s.
  - A 20-min USA outbound block leaves every non-US row unaffected (observatory evidence).
  - 0 bytes of Afrows customer traffic through 162.19.253.235 for 7 days.
  - Usage parity: node-reported bytes vs the user's app counter within 2 % on the probe account.

### Phase 2: control-plane move

**Goal.** Sales, bot, subscriptions and dashboard survive any Iran VM outage; no customer data in Iranian
jurisdiction; the OVH box holds nothing of Afrows.

| Id | Work item | Files / modules |
|---|---|---|
| P2.1 | **Control host** per `docs/enterprise-deployment-guide.md`: native systemd, nginx, private Postgres (least-privilege roles), backend on 127.0.0.1:7000, UFW 22/80/443 | `infra/ubuntu/*`, `scripts/deploy/*` (target alias), `deploy.env` (ignored) |
| P2.2 | **Cutover**: restore drill first; then write-freeze (backend stopped on Iran), final encrypted dump, restore, Cloudflare tunnel ingress for `app.afrows.com` and `afrows.com` moved to `cloudflared` on the control host, Telegram polling direct (drop `AFROWS_OUTBOUND_PROXY_URL`), node agents' URL switched | `infra/ubuntu/tls/*`, `infra/usa/README.md` (web-origin retired), `apps/backend/.env.example` |
| P2.3 | **Iran VM becomes a node**: node agent for `afrows-in` users/usage; WireGuard peer sync and metering through the agent; MikroTik/router jobs pulled from a job queue (no inbound path from abroad needed) | `scripts/afrows-node-agent.py` (wg + router job plugins), `apps/backend/src/client/{afrows-wireguard.ts,wireguard-metering.service.ts,xray-provisioning.service.ts}`, `apps/backend/src/routers/routers.service.ts` (executor split) |
| P2.4 | **Egress renderer without psql**: `afrows-egress-mode-sync.py` reads a pulled, last-known-good state file (mode, gaming ips/emails, bypass, path users) instead of `psql1(...)`; `decide()`, ladders and hysteresis unchanged (INV-17) | `scripts/afrows-egress-mode-sync.py` (input layer only), `scripts/test_egress_mode_sync.py` |
| P2.5 | **Subscription delivery**: `app.afrows.com` via Cloudflare plus a direct second host on the control host's rDNS name (LE); `Profile-Web-Page-Url` to the panel; Iran-side read-through cache only if P1.8 data shows ISPs that reach neither | nginx sample, `apps/backend/src/subscription/headers.ts` |
| P2.6 | **Wipe the Iran VM** of DB, backups, env secrets not needed by the node, dashboard/web builds | runbook in `docs/` |
| P2.7 | **Remove Afrows from the OVH box** (operator approval, Hexogate untouched, backups first): Afrows ws/xhttp inbounds and users, `afrows-allow.conf`, `afrows-maxstartups.conf`, `afrows-maxsessions.conf`, de-relay key line; on the Afrows side `afrows-de-relay`, `/api/edge/de` alias, `germany-mgmt*` services | `infra/ubuntu/relay/README.md`, `apps/backend/src/client/germany-*.ts` (delete) |
| P2.8 | **Watchdog** moves to the control host (watches every node and the Iran VM from outside); USA keeps only exit duties | `infra/usa/*` -> `infra/control/*` |
| P2.9 | **Backups**: hourly encrypted dump to a second provider; monthly restore drill | `scripts/drills/*` |

- **Migrations/contracts:** no schema change required; new edge endpoints `.../state` (egress inputs) and
  `.../jobs` (router tasks), node-token scoped. The admin dashboard URL stays `app.afrows.com`.
- **Tests:** egress renderer golden test proves identical output from the state file vs the old psql
  inputs; agent job queue (at-most-once, audited, timeout); routers service tests for the executor split
  (MikroTik is a high-risk area: before/after runs); full backend suite; Playwright smoke against the new
  host.
- **Rollout:** rehearse on a copy (restore drill, smoke with the backend unable to reach real nodes, as in
  the 10-20 migration); cutover in a low-traffic window; Iran VM backend kept stopped but intact for 7
  days, then wiped.
- **Rollback:** within 7 days: stop control backend, restore its latest dump to the Iran VM, point the
  tunnel and agents back. After the wipe: restore from the hourly backup to any host.
- **Risks:** router management is the most coupled piece (WireGuard to MikroTiks terminates on the Iran
  VM); a pulled-job design adds latency to admin actions (accept seconds). Control host provider
  suspension: backups at provider Y, documented 1 h rebuild. Cloudflare tunnel token moves hosts.
- **Acceptance:**
  - Iran VM power-off drill for 1 h: bot answers, a test purchase completes, every subscription returns
    200, dashboard login works, direct-row customers see no change.
  - Restore drill: RTO <= 60 min, RPO <= 1 h.
  - `grep`-level audit: no Postgres, no dumps, no `AFROWS_SECRETS_KEY` on the Iran VM.
  - OVH box: `ls`/`systemctl`/`nft` audit shows no Afrows object; Hexogate manifest checksum unchanged.

### Phase 3: DNS autoheal and rotation

**Goal.** A blocked IP or name heals without operator action; transports, ports and certificates rotate on
a schedule without breaking customers.

| Id | Work item | Files / modules |
|---|---|---|
| P3.1 | Disposable zones (3+) on a DNS-only provider with API and TTL 60; names attached to rows (`addresses` hold names, sharded) | `infra/postgres/migrations/0070_dns_names.sql`, `0071_dns_change_events.sql`; `schema.ts` |
| P3.2 | **Autoheal decider**: single-file stdlib timer on the control host (fast 2 min, slow 5 min), pure `decide()` with confirm ticks 2, min dead vantages 2 (residential only; `dc-*` vantages advisory), per-tick change budget (8, 24 during an entry outage), failback after 36 clean ticks and >= 3 h, breaker; DNS API token in `/etc/afrows` root 0600; audit row + Telegram per change | new `scripts/afrows-dns-autoheal.py`, `scripts/test_dns_autoheal.py`, `infra/control/afrows-dns-autoheal.{service,timer}` |
| P3.3 | **Rotation**: REALITY port/short-id/SNI, HTTP-row ports, rDNS cert renew; plan generated by the backend, approved (dashboard, owner role) or auto within policy, applied by the node agent; **old values stay served >= 48 h** after the subscription switches (6 h refresh, many clients refresh late) | `apps/backend/src/subscription/rotation.ts`, `scripts/afrows-node-agent.py`, dashboard rows tab |
| P3.4 | **Front IP rotation** (provider API: new primary IP or rebuild) as a manual, audited runbook first; automation only after 3 clean manual runs | `infra/node/README.md` |
| P3.5 | **Optional CDN rows**: Gcore free CDN for one exit; Fastly only after operator sign-off on ToS risk | `infra/node/*`, rows |
| P3.6 | **Scorer-lite** (flag, default off): row score = 1 - worst utilisation on its path, EWMA, hysteresis; unhealthy rows sink within their block; renderer ignores scores older than 10 min | `apps/backend/src/subscription/score.ts` |
| P3.7 | Dashboard DNS tab (names, state, last change, reason), en/fa | dashboard Exits page `?tab=dns` |

- **Migrations/contracts:** `0070`, `0071`; rotation plan contract in shared types.
- **Tests:** `test_dns_autoheal.py` (budgets, confirm ticks, failback timing, breaker, a DC-only failure
  never moves a name, every vantage failing at once = vantage outage, no move); rotation overlap
  (old port served until `switch_at + 48 h`); scorer hysteresis; renderer ignores stale scores.
- **Rollout:** autoheal in **dry-run** mode for 7 days (logs intended moves), then live with budget 2,
  then the target budgets.
- **Rollback:** `AFROWS_DNS_AUTOHEAL_MODE=dry-run`; DNS records reset to `home_ip` from the table.
- **Risks:** a whole zone SNI-filtered (spread rows across zones); registrar seizure of `.ir` zones;
  vantage failure looking like a block (residential quorum + "all vantages dead = no move").
- **Acceptance:**
  - Drill: drop a front IP for the vantages (node-side blackhole of the vantage source ranges) -> its names
    move within <= 6 min, within budget, no flap for 24 h, failback after >= 3 h clean.
  - One weekly rotation cycle with row success unchanged (+-5 points) and 0 support tickets attributed.
  - Dry-run week: 0 intended moves caused by a single vantage.

### Phase 4: product, bot and UI parity (02 doc target and build order)

**Goal.** Hexogate's structural UX wins (computed next action, resume, service hub, delivery check,
guided support, pair-code login) on top of Afrows' bilingual typed copy, volume billing, gems and route
control.

| Step (02 section 5.5) | Work items | Files / modules |
|---|---|---|
| 4.1 Bot: smart home + buy wizard + delivery | Split `telegram-bot.service.ts` (3.1k lines) into screen modules first (no behaviour change); smart home with server-computed `nextAction`; 4-button persistent reply keyboard; step indicator; `copy_text` card button; PDF receipts; pending-action resume (from open top-up/payment rows); delivery panel with QR + subscription copy + setup menu + "connected / not connected" check; **subscription-first delivery** (raw links behind "more") so customers get rows and rotations | `apps/backend/src/telegram/screens/{home,buy,delivery}.ts`, `telegram-bot.service.ts` (router only), `telegram-i18n.ts`, `telegram-format.ts`, `telegram-topup.ts`; `packages/shared` (`AccountNextAction`) |
| 4.2 Bot: services hub, support, downloads | Per-config card (connect / add data / more); support wizard (5 categories, diagnostics prompt: device, app, ISP, city, error; no free-form location tracking beyond what the user types); tickets to the admin chat and a dashboard page; shared downloads/tutorials table | `telegram/screens/{services,support,downloads}.ts`; `infra/postgres/migrations/0072_support_tickets.sql`, `0073_support_ticket_messages.sql`; `packages/shared/src/client-apps.ts` |
| 4.3 Client: pair-code login + shell + Home/Services/Buy | `auth/pair/request|status|consume` (code hashed, 5 min TTL, single use, rate-limited, approved in the bot); bottom-nav shell; route tab inside Services | `apps/backend/src/client/client-auth.controller.ts`, `0074_client_pair_codes.sql`; `apps/client/src/*` |
| 4.4 Client: Wallet + Support + PWA | gems, redeem, rewarded ads, ledger; tickets; manifest + offline page; reduced-motion | `apps/client/src/*` |
| 4.5 Web subpages, admin Queues, Tickets | `/pricing`, `/guides`, `/status`, `/terms`, `/privacy` (en/fa); dashboard Queues landing (pending top-ups, open tickets, failed deliveries) with sidebar badges; Tickets page | `apps/web/src/*`, `apps/dashboard/src/pages/*`, `nav-views.ts`, `i18n.ts` |
| 4.6 Later / skip | Tenant bots, toman wallet for end users, time-only plans, 3D hero, dark-only theme | - |

- **Migrations/contracts:** `0072`-`0074`; shared `AccountNextAction`, `SupportTicket*`, pair-auth DTOs.
- **Tests:** keyboard enumeration test (every bot screen has Home; stateful screens have Back + Cancel;
  Home clears FSM state); i18n completeness (en/fa keys equal, no literal user copy in screen modules);
  pair-code expiry/replay/rate limit; ticket scoping (a customer reads only own tickets; support role
  cannot see secrets); existing 989 backend tests; client e2e; dashboard Playwright + render-check.
- **Rollout:** each step behind a bot setting toggle; release per step.
- **Rollback:** toggle off; screen modules keep the old handlers until the step is accepted.
- **Risks:** the bot service refactor touches a high-risk Telegram area; do the split as a pure move with
  the existing tests green before any UX change.
- **Acceptance:**
  - Returning buyer with balance <= 5 taps; new buyer <= 6 taps + 1 photo (scripted bot test).
  - 100 % of screens pass the Home/Back/Cancel test; 0 untranslated strings.
  - "Not connected" -> ticket with diagnostics prefilled, visible in the dashboard Tickets page.
  - Pair-code login end to end on a phone at 390 px; render-check 0 overflow, 0 console errors.
  - Aggregate (not per-user) funnel counts for buy start -> receipt -> delivery visible to the owner.

---

## 3. Operator shopping list

| # | Item | Count | For | Cost tier | Notes |
|---|---|---|---|---|---|
| 1 | **Hetzner Cloud account**, Afrows-only (not linked to anything Hexogate) | 1 | Phase 1 | free | KYC may ask for ID; payment by a non-Iranian card or PayPal. If refused, use item 4 for both fronts |
| 2 | **Hetzner shared-vCPU VPS**, 2 vCPU / 4 GB / 40 GB (CX22 class), one in **Falkenstein or Nuremberg (DE)**, one in **Helsinki (FI)**, primary IPv4 each | 2 | Phase 1 fronts + exits | ~4-6 EUR/month each | 20 TB traffic included; scale the plan up if `cpu+steal` stays > 60 % |
| 3 | rDNS name + Let's Encrypt certificate on each front | 2 | TLS+Vision lead block | **free** | Set in the Hetzner console; check LE rate limits on `your-server.de` before relying on it |
| 4 | **Second-provider VPS**, same size, EU (e.g. NL or SE) at a provider other than Hetzner and OVH | 1 | Phase 1b: provider diversity, exit + backup front | ~5-10 EUR/month | Linode/Akamai, Leaseweb or Netcup class; not Oracle |
| 5 | **Control host**, 2 vCPU / 4 GB / 60 GB disk, at a provider that is neither the fronts' nor OVH | 1 | Phase 2 | ~5-8 EUR/month | Can be the same provider as item 4 but a different box |
| 6 | **Off-site backup storage** (e.g. Backblaze B2 or a storage box at a third provider) | 1 | Phase 0 (USA/PC) then Phase 2 | < 1-4 USD/month | Encrypted dumps only |
| 7 | **DNS-only provider with API and TTL 60** (e.g. Cloudflare DNS, grey cloud, free plan; separate from the afrows.com zone at deSEC) | 1 account | Phase 3 | **free** | DNS only, no proxying, so no proxy-ToS issue |
| 8 | **Disposable zones**: 3-5 cheap domains, not Afrows-branded. `.ir` (~1-2 USD/year, needs an Iranian registrant at nic.ir) **or** gTLDs (~1-3 USD first year, privacy registrar) | 3-5 | Phase 3 | ~5-15 USD/year | Operator decides `.ir` vs gTLD (open question 2) |
| 9 | **Gcore free CDN** account | 1 | Phase 3, optional | **free** (1 TB/month) | Backup CDN row |
| 10 | **Fastly developer account** | 1 | Phase 3, optional | free allowance, card required | Only after accepting ToS/account-ban risk |
| 11 | **Residential probe vantages**: an old Android phone or Raspberry Pi with prepaid **MCI** and **Irancell** SIMs (plus the existing Shatel home line) | 1-2 devices, 2 SIMs | Phase 0-3 measurement and autoheal | low one-off + SIM data | Synthetic probes only; nothing about the household is collected |
| 12 | Database Mart support ticket (20-min outbound blocks) | - | now | free | |
| 13 | زیرساخت auto-renew and balance check | - | now | - | Prevents another freeze |

Monthly run-rate after Phase 2: about 25-40 EUR (items 2, 4, 5, 6), plus the existing USA and Iran VM.
Free building blocks: rDNS + Let's Encrypt, Cloudflare DNS-only, Gcore free tier, the existing boxes.

Excluded: **Oracle Cloud Free Tier** (export terms bar Iranian nationals; idle reclaim), **Cloudflare
Workers** as a proxy (ToS, SNI-blocked within ~24 h), any Hexogate box, account, zone or certificate,
**Borjino**, and any further use of the OVH box after Phase 2.

---

## 4. What NOT to copy

### 4.1 From the product and UI
- **Hardcoded Persian-only copy** in handlers and components. Afrows copy stays in `telegram-i18n.ts`,
  `apps/client/src/i18n.ts`, `apps/dashboard/src/i18n.ts`, Persian written first, English second.
- **Forced channel join** before use: it discloses channel membership and gates access to connectivity.
- 7-row reply keyboards, emoji-heavy labels, premium custom emoji, the 3.1k-line management component,
  the 3D hero, dark-only glass theme, Hexogate's tokens.
- Tenant bots and a toman end-user wallet (later, if ever).

### 4.2 From the data plane and operations
- **Customer names in subscriptions**: Hexogate puts the username in `Profile-Title` and the info row.
  Afrows bodies and headers stay PII-free.
- **Token with the user id in clear** (`base64("v3,<user_id>,<ts>")`). Keep Afrows' HMAC-derived token.
- **Datacenter-ASN enforcement / attack-ASN observer** that tie accounts to client ASNs or IPs, and
  **in-app telemetry** posted from customer devices. Afrows may only use opt-in, aggregate, IP-free
  counters.
- **UX ActivityLog per user** for funnels: aggregate counts only.
- **Legacy Shadowsocks** (`chacha20-ietf-poly1305`); use SS-2022.
- `security=none` without VLESS Encryption.
- **Live auto-reordering** of the subscription by default.
- **Ad-hoc rotation scripts in `/root`** (`claude-cellswap` style). Rotation is audited code with an
  overlap window and a rollback.
- **Copying PasarGuard/Hexogate source code.** Learn the behaviour, reimplement it in Afrows' typed code;
  the upstream (Marzban lineage) license terms make code copying a legal question, and Afrows does not
  need it.
- **47 boxes**. Start at 2-3 nodes and add only on measured need.
- **Cloudflare/Fastly as the primary path**; they are bottom-of-list rows with explicit ToS risk.

### 4.3 Proposed invariants (to add with Phase 0 ADRs)
- **INV-20** Afrows shares no host, account, DNS zone, certificate, key or firewall with Hexogate. Afrows
  objects on the OVH box are removed in Phase 2 and none are added.
- **INV-21** Data-plane nodes run with access logs off and send the control plane only per-user byte
  deltas, health and counts; never client IPs, destinations or ASNs.
- **INV-22** Public subscription bodies and headers contain no customer name, Telegram id, phone or
  account id; usage numbers and expiry only.
- **INV-23** Subscription order is static (block, country, row id) unless a flag enables score sinking
  inside a block; rows never jump blocks automatically.

---

## 5. Open questions for the operator

### Decisions so far (operator, 2026-11-03)
- **Q1 accounts:** an employee opens the Hetzner and second-provider accounts.
- **Q2 domains:** no `.ir` domains. Use neutral gTLDs plus the servers' own rDNS names.
- **Q4 USA:** keep the USA exit at **2x**, and name it **"USA AI Support"** (live in code from 0.123.1). Phase 1
  needs dedicated USA inbounds on the fronts so the multiplier keeps working.
- **Direction:** Afrows and Hexogate stay separate systems, but Afrows copies Hexogate's data-plane design
  (direct foreign fronts, several transports per exit, no Iran-DC hop), because it is faster and does not drop.
- Still open: Q3, Q5-Q12.


1. **Accounts and payment:** who opens the Hetzner and second-provider accounts, and with which payment
   method? If Hetzner KYC refuses, is a non-Hetzner EU provider acceptable for both fronts?
2. **`.ir` zones:** accept registering 3-5 `.ir` domains (Iranian registrant identity at nic.ir, seizure
   risk), or use non-Afrows gTLDs only? rDNS names work without either.
3. **Relay tier:** keep the Iran VM and the old server 94.74.145.199 as relay entries if Phase 1 data
   shows they win on some ISPs, or retire them (and when does the old server's contract end)?
4. **USA 2x pricing:** keep the multiplier (needs dedicated USA inbounds on the fronts) or drop it once
   the USA is one exit among several?
5. **Exit countries:** besides DE, FI, US, which countries do customers ask for (NL, TR, SE)? Each is a
   small exit box or a second-provider box.
6. **Fastly:** accept the ToS/account risk for a CDN row, or stop at Gcore?
7. **Probe vantages:** can a device with MCI and Irancell SIMs be placed at the operator's home or the
   village, and is the village's Linux availability good enough to count as a vantage?
8. **Control host provider and country:** any preference (e.g. NL vs DE vs FI) given travel and legal
   comfort? It must not be OVH (Hexogate) or the fronts' provider.
9. **Device limits:** enforce on the new nodes (counts only, in memory) or stay in `observe` mode?
10. **Customer communication:** may the bot broadcast once per phase ("refresh your subscription") and
    switch delivery to subscription-first, with raw links behind "more"?
11. **Germany exit on OVH:** confirm that Afrows should leave the shared box entirely (Phase 1 traffic,
    Phase 2 files), with Hexogate untouched.
12. **Budget ceiling:** is ~25-40 EUR/month (plus existing boxes) acceptable for Phases 1-2?

---

## Appendix A. Measurement protocol for every acceptance gate

Per the `iran-dpi-playbook` skill: interleaved rounds (A B C, A B C, ...; >= 3 rounds), throwaway socks
ports, upload and download measured separately, per-flow retransmits, ICMP vs TCP loss, test sizes
<= 20 MB with 10 s gaps, stop on RTT jump or > 50 % loss (protect production IPs). Record date, vantage
class, ISP, row id, block, fingerprint, port, median and range. Results land in `row_probe_hourly`
(Phase 1+) and durable findings in the playbook's section 2.

## Appendix B. Mapping to the first-pass bottlenecks

| Bottleneck | Fixed by |
|---|---|
| B1 Iranian DC on the customer path | Phase 1 direct rows; relay tier only where it wins |
| B2 single Iran VM | Phase 1 (data plane) + Phase 2 (control plane) |
| B3 single far exit with provider blocks | Phase 1 DE/FI exits, per-row fallback balancer |
| B4 one transport per link | Phase 1 five blocks per front, Phase 3 rotation |
| B5 Cloudflare-only CDN | Phase 3 Gcore/Fastly optional; CDN demoted to a fallback block |
| B6 subscription/bot/dashboard on the Iran VM | Phase 2 |
| B7 distance (USA ~195 ms) | Phase 1 EU fronts/exits (~60-80 ms from Iran) |
| B8 static order on a degraded link | Phase 0 measured static order, Phase 3 scorer-lite (flag) |
