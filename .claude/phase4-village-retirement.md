# Phase 4 — Legacy retirement runbook (Village AX3 + 94.74 + 162.19 Afrows role)

Prepared 2026-11-26. READ-ONLY investigation done; **all execution owner-gated.** Builds on consolidation Phases 1–3 (memory `afrows-server-consolidation`).

## Scope + verdict
- **Village MikroTik AX3** → power off — IF owner confirms it serves no live village LAN/DHCP/DNS/internet-gateway role (see Gate A).
- **94.74.145.199** (old Iran VPS) → power off — IF owner confirms nothing else runs on it (Gate B). Its only live role is forwarding the village WG UDP to PROD.
- **162.19.253.235** → **NEVER powered off.** It runs the owner's **Hexogate** (preserve completely). Only the **Afrows role** on it is retired (entry already disabled; mgmt to be disabled).

## Evidence: what the legacy components carry NOW (post Phase 1–3)
| Component | Current role | Live traffic | Verdict |
|---|---|---|---|
| `wg-village` (→94.74) | gaming outbound `via-village` | **0 sources / 0 users** (reconciler: `xray-user=0 wg-src=0`); ~239MB cumulative, ~flat | unused by customers |
| `wg-village-de` (→94.74) | legacy: Telegram raw-IP routes + (inactive) 162.19 route + unused relay-1..5 dialer | ~19MB trickle this session; backend Telegram now uses de-socks SOCKS (hostname), not these raw-IP routes | legacy |
| `94.74.145.199` | DNAT forwarder for the two village WG tunnels | only the above | retire after tunnels removed |
| `162.19.253.235` Afrows | old "Afrows Germany" entry (DISABLED Phase 3) + de-relay/de-route mgmt (currently failing: all Afrows keys rejected) | none customer-facing | retire Afrows role; keep Hexogate |

## Confirmed INDEPENDENT of all legacy components (evidence)
- **Customer catch-all egress** `via-germany` → `46.249.98.221:8449` **DIRECT** (not via village). ✓
- **Newyork / Germany Fast 2×** → `46.249:8443` direct REALITY. ✓
- **"Germany" entry** (iran/Shatel) → PROD → via-germany (46.249) direct. ✓
- **USA fallback** `via-backup` → `93.127.140.50:8448` **DIRECT**. ✓ (`backupUp=true`)
- **Telegram** → `afrows-de-socks` SOCKS `127.0.0.1:1091` → `46.249` direct. ✓ (0 fails)
None traverse the village, 94.74, or 162.19.

## The one lingering legacy dependency + elimination
The backend still **attempts to manage 162.19** (`afrows-de-relay` = activating/retry; GermanyMgmt sweeps) and the village route to it (`afrows-de-route`). Gate: `AFROWS_DE_MGMT_SSH` (set → backend sweeps 162.19; `xray-provisioning.service.ts:459` + `germany-mgmt.service.ts:15`).
**Elimination (not reroute — the target is being retired):** clear `AFROWS_DE_MGMT_SSH`, then `systemctl disable --now afrows-de-relay.service afrows-de-route.service`. Nothing left to manage on 162.19 for Afrows, so no independent path is needed. (If the owner ever wants a live DE entry again, the independent path is de-relay via USA with a re-added key — out of scope here.)

## GATES — owner must confirm before execution
- **Gate A (AX3 local role):** I have NO access to the AX3 (no creds). Owner must confirm the AX3 is NOT the village site's live internet router / LAN / DHCP / DNS for any people or devices there. (Owner already stated its purpose was modems→Starlink→tunnel and "Starlink is gone, remove this structure" — this gate just makes it explicit.)
- **Gate B (94.74 contents):** I cannot SSH into 94.74 (publickey denied). Owner confirms nothing else runs on it (it's the owner's box) before power-off.
- **Gate C (162.19 Afrows components):** I cannot access 162.19 (Hexogate, harness-blocked). Owner optionally stops the Afrows-only units there (`cloudflared-afrows`, `afrows-xray-de` — names to verify) while leaving **Hexogate Docker + firewall untouched**. Leaving them running is harmless (unused) if preferred.

## EXECUTION STATUS (2026-11-26) — Steps 1–3 DONE on PROD; power-off pending
- **✅ Step 1** — 162.19 Afrows mgmt eliminated: `AFROWS_DE_MGMT_SSH` cleared, `afrows-de-relay` + `afrows-de-route` disabled. Discovered `GermanyMgmtService` was hardcoded `enabled:()=>true` (empty SSH fell back to the 162.19 default and kept probing) → fixed in code (**0.134.1**, gate on `AFROWS_DE_MGMT_SSH`); **pending owner deploy** to fully silence the residual probe (harmless meanwhile: direct, fails, 5-min backoff). env backup `afrows.env.bak-phase4s1-*`.
- **✅ Step 2** — N/A as a manual step: gaming preference is hardcoded in `choose_gaming()` (`via-village` while `iface_alive(wg-village)`, else `via-germany`). Removing the tunnel auto-fails it over. (A GAMING_ORDER edit was tried + reverted.)
- **✅ Step 3** — village WG tunnels removed: `wg-quick@wg-village` + `wg-quick@wg-village-de` disabled --now. `wg show` = wg0/wg-home/wg-routers only. Gaming converged to via-germany; Telegram 0 fails; catch-all exit still 46.249; lineup Newyork+Germany. (Optional later: drop the dormant relay-1..5 from `xray.service`, which dialed via wg-village-de.)
- **⏳ Steps 4–5 PENDING (owner):** grace period, then power off AX3 + 94.74 (keep a 94.74 snapshot). 162.19 stays up (Hexogate). Also pending: deploy 0.134.1.

## Execution plan (owner-gated; each step reversible)
**Step 1 — eliminate 162.19 Afrows mgmt (PROD, no customer impact):**
- Backup env. Clear `AFROWS_DE_MGMT_SSH=`. `systemctl disable --now afrows-de-relay.service afrows-de-route.service`.
- Verify: backend logs show no more GermanyMgmt probe churn; `/api/health` ok; lineup unchanged (Newyork+Germany); egress via-germany + via-backup healthy.
- Rollback: restore env + `systemctl enable --now` the two services.

**Step 2 — repoint gaming off the village (PROD):**
- Gaming (`via-village`) has 0 users. Edit `/usr/local/bin/afrows-egress-mode-sync.py` `GAMING_ORDER` → `["via-germany","proxy"]` (drop `via-village`), run the reconciler.
- Verify: reconciler applies gaming→via-germany; no errors. (Optional — if skipped, the reconciler auto-fails-over gaming to via-germany once wg-village is down anyway.)
- Rollback: restore GAMING_ORDER.

**Step 3 — remove the village WG tunnels (PROD):**
- `systemctl disable --now wg-quick@wg-village.service wg-quick@wg-village-de.service` (the Telegram raw-IP routes vanish with the interface; they are unused — backend Telegram rides the SOCKS).
- Optional cleanup: remove the now-dangling `relay-1..5` from `xray.service` config (unused since Phase 2; the `proxy` catch-all fallback retires with the village, leaving the ladder via-germany → via-backup(USA) → direct).
- Verify: Telegram still 0 fails; catch-all exit still 46.249; `wg show` no longer lists the village peers; no backend errors.
- Rollback: `systemctl enable --now` the two wg-quick units.

**Step 4 — grace period (24–48h):** leave AX3 + 94.74 powered ON but idle (tunnels gone). Monitor customer egress, Telegram, Newyork/Germany entries, egress-health. Nothing should reference the legacy path.

**Step 5 — power off (owner, after Gates A/B):** power off the **AX3**, then **94.74.145.199**. Keep a snapshot/image of 94.74 for a while before any delete. **Do NOT power off 162.19** (Hexogate).

**Step 6 — (optional) 162.19 Afrows cleanup (owner, Gate C):** stop Afrows-only units on 162.19, keep Hexogate. Not required for retirement.

## Post-retirement end state
- Entries: **Newyork** (46.249, 2×) + **Germany** (Shatel entry → 46.249 egress).
- Egress ladder: via-germany (46.249) → via-backup (USA) → direct. Telegram via 46.249 SOCKS.
- Boxes live: PROD 185, Germany 46.249, USA 93.127.140.50 (mgmt + fallback), 162.19 (Hexogate only).
- Retired/off: AX3, 94.74. wg-home (separate, currently down) untouched.
