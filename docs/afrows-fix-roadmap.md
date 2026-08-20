# Afrows Fix Roadmap — 4 reported issues

Diagnosed + implemented 2026-07-24 by the parallel `.claude/agents/` team. Owners map to those specs.

## Status (2026-07-24)
| # | Issue | Status |
|---|-------|--------|
| ① | Outbound dies on power loss | **Failover fixed + UPS pending.** Root cause was a wiring gap, not just power: the operator's added Exit-page VLESS exits are village-independent (VPS-side) but the relay pool that uses them was disabled at deploy, and `apply_target` never guaranteed the `proxy` outbound (so failover silently aborted). Fixed: `proxy` outbound guaranteed, gaming gets a `proxy` reserve, pool-sync re-enabled as reserve. Deploy + Test the exits so pool-sync admits them. UPS on the MikroTik + primary LTE modem still recommended for the *primary* path. |
| ② | Mobile customer table actions | **Fixed.** `DataTable` extended with expandable detail rows; Edit/Config open inline under each row. Dashboard typecheck clean. Human 390px eyeball pending. |
| ③ | 20 GB plan → ~26 GB usable | **Fixed.** Decimal-GB (`1e9`) + tighter metering poll. Backend typecheck + quota tests pass. Open: DB backfill decision. |
| ④ | Weather won't open over VLESS | **Fixed.** Trusted DNS block in `afrows-egress-mode-sync.py` (idempotent). |

Not yet committed / version-bumped — pending operator approval. `stash@{0}` retained as a recovery safety net.

---

## ① Outbound VLESS dies on power loss — *physical, not code*
**Owner:** `network-infra-engineer` · **Type:** hardware/topology (in-repo hardening optional)

**Root cause:** The Xray host holding the VLESS outbound is the always-powered VPS. What loses power is the **village site**, and *every* clean-exit path (Starlink + 3 LTE modems + `wg-germany`) runs through the village **MikroTik hAP ax³**, all on one wall circuit with **no UPS**. So the built-in uplink redundancy (netwatch failover, 2-strike health failover in `afrows-egress-mode-sync.py`) protects against *one leg* failing but gives zero protection when the shared power feed drops and everything dies at once. Reconnection logic is sound: `wg-afrows` has `persistent-keepalive≈25s` and the village re-initiates on power-return.

**Fixes (ordered):**
1. **H1 (biggest win, cheap):** small UPS (400–650VA) on the **MikroTik + primary LTE modem (Irelandcell-228)**. Both are low-draw; this keeps `via-germany` (normal traffic rides LTE) alive with no config change. *(Hardware)*
2. **H2:** add the other two LTE modems to the UPS so netwatch/3-modem failover works on battery. *(Hardware)*
3. **H3:** only if gaming must survive outages, size a UPS/inverter big enough for Starlink (~50–100W). Else let the sync script fail gaming `via-village → via-germany` (already does). *(Hardware)*
4. **C1 (in-repo):** `xray.service` — `Restart=on-failure` → `Restart=always`, add `StartLimitIntervalSec=0`, `Wants=/After=network-online.target`. Hardening only.
5. **C2:** verify `persistent-keepalive=25` on `wg-afrows` and all village tunnels.
6. **C4 (optional, architecture):** give the gaming tier a village-independent reserve exit.

**Files:** `xray.service`, `scripts/afrows-egress-mode-sync.py`, `docs/village-implementation.md`, `docs/village-cpe-modems.md`.

---

## ② Customer table unusable on mobile — Edit/Config off-screen
**Owner:** `senior-frontend-designer` (Fable 5) · **Verify:** `qa-tester`

**Root cause:** `apps/dashboard/src/pages/CustomersPage.tsx:1317` renders the shared `DataTable` with `minWidth="900px"` inside an `overflow-x-auto` div. The `actions` column (Edit/Config) is the **last, `alignRight` column** (`CustomersPage.tsx:773-798`) → sits at ~x=900px, off-screen on a ~390px phone. No card fallback, no sticky column.

**Fix:** Reuse the proven expandable-row pattern from `OutboundsPage.tsx:714-772` (`React.Fragment` per row + chevron toggle + full-width `colSpan` detail row + `expanded` state map). Move Edit/Config into an **inline detail row that opens under each user's row** (exactly the requested behavior). Since `CustomersPage` uses the shared `DataTable` primitive (which has **no** detail-row slot), either:
- **(preferred)** extend `DataTable` in `primitives.tsx:298-340` with an optional `renderDetail(row)` + `expandedRowKey` prop (benefits every table), or
- hand-roll the customers table like Outbounds.
Add a chevron/tap-to-expand affordance; ensure tap targets ≥44px; keep copy in the multilingual layer.

**Files:** `apps/dashboard/src/pages/CustomersPage.tsx`, `apps/dashboard/src/components/primitives.tsx`, pattern ref `apps/dashboard/src/pages/OutboundsPage.tsx`, types `apps/dashboard/src/dashboard-types.ts:36-50`.
**Acceptance:** on 390px viewport, every user's Edit + Config reachable without horizontal scroll; opens inline under the row; collapses correctly.

---

## ③ 20 GB plan lets user consume ~26 GB
**Owner:** `senior-backend-engineer` (Opus) · **Verify:** `qa-tester`

**Root cause (compound — NOT a 1.3× factor):**
1. **Deterministic +7.4%:** `apps/backend/src/billing/quota-math.ts:49` `BYTES_PER_GB = 1024 ** 3` treats **GB as GiB**. "20 GB" is stored as `20 × 1024³ = 21.47` decimal GB, while usage is *displayed* in decimal GB (`/1e9`). Dashboard mirrors the same bug: `CustomersPage.tsx:31,382`.
2. **Variable remainder:** enforcement is **purely polled** with no inline data-plane cap. Xray meter+cutoff loop = 60s (`xray-usage-metering.service.ts:36,204`); WG pipeline trails 10s→30s→next pass (`wireguard-metering.service.ts:26,107`). A fast client keeps flowing at full line rate for 1–2 intervals past the (already-inflated) threshold → several extra GB. Cutoff comparison itself is exact `used_bytes >= quota_limit_bytes` (no grace).

**Fix:**
1. Pick one unit and make **definition + enforcement + display** consistent. If plans are decimal GB, set `quota-math.ts:49` → `1_000_000_000` and match `CustomersPage.tsx:31`. (Decide with `cto-architect` — GB vs GiB is a product decision; whichever, kill the inconsistency.)
2. Bound the overshoot: lower `AFROWS_XRAY_METERING_INTERVAL_SECONDS` and the WG interval, and/or push a hard per-user cap into Xray/WireGuard so enforcement doesn't depend on the poll loop.

**Files:** `apps/backend/src/billing/quota-math.ts:49`, `apps/dashboard/src/pages/CustomersPage.tsx:31`, `apps/backend/src/client/xray-usage-metering.service.ts:204`, `apps/backend/src/client/wireguard-metering.service.ts:26`.
**Acceptance:** a 20 GB plan disconnects at ≤ ~20 GB + one small poll interval, in the chosen unit, with dashboard display matching.

---

## ④ Weather sites won't open over VLESS
**Owner:** `network-infra-engineer` · **Verify:** `qa-tester`

**Root cause:** In `scripts/afrows-egress-mode-sync.py`, `smart` mode (the default) emits `geoip:ir → direct` (line 34) and sets `domainStrategy: "IPIfNonMatch"` (line 346) with **no `dns` block**. So weather CDNs/APIs (Apple WeatherKit, weather.com, AccuWeather, qweather, Android weather) get resolved by the *local filtered resolver* into Iranian IP space → matched by `geoip:ir` → sent out the **censored `direct` uplink** → dead. Ordinary sites resolve to foreign IPs and fall through to the clean `proxy` catch-all, so only geo-localized services break. Not a dead-outbound issue.

**Fix:**
1. **Primary:** in `apply_target()` (near line 346), add a trusted `dns` block, e.g.
   `cfg["dns"] = {"servers": ["https://1.1.1.1/dns-query", "8.8.8.8"], "queryStrategy": "UseIP"}` — so `IPIfNonMatch` resolves against a clean resolver, keeping weather hosts out of `geoip:ir`.
2. **Belt-and-suspenders:** switch `domainStrategy` to `"AsIs"` (route on domain only, no IP re-resolution) or narrow `GEOIP_DIRECT` (line 34) so it doesn't blanket every Iranian-resolved CDN edge to the filtered uplink.

**Files:** `scripts/afrows-egress-mode-sync.py:34,296-321,345-346`.
**Acceptance:** weather apps/sites load over a `smart`-mode VLESS session; `geoip:category-ir` domestic sites still go `direct`.

---

## Parallelization plan
| Track | Owner | Depends on | Parallel? |
|-------|-------|-----------|-----------|
| ② mobile table | senior-frontend-designer | — | ✅ |
| ③ quota unit + poll | senior-backend-engineer + cto (unit decision) | GB-vs-GiB decision | ✅ |
| ④ weather DNS/routing | network-infra-engineer | — | ✅ |
| ① power UPS | operator (hardware) + network-infra-engineer (C1/C2) | UPS purchase | ✅ (in-repo C1/C2 anytime) |

②③④ code fixes are independent → run in parallel, each verified by `qa-tester`, reviewed by `cto-architect`, then scrum-master bumps version + `CHANGELOG.md` + `.claude/progress.md`.
