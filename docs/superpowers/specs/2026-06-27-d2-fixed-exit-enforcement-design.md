# Per-customer fixed-exit enforcement (D2) — design

**Date:** 2026-06-27
**Status:** Approved (brainstorm) → ready for implementation plan
**Part of:** the dashboard UX overhaul. **D2** makes D1's per-config Exit selector actually route (D1 stored it but did not enforce). Decision: "fixed" pins to a **stable path** (not an individual relay).

## Problem

D1 added a per-client-config **Exit** selector (Auto vs a fixed choice) but it only *stores* `route_preference` — the egress reconciler ignores it. So "fixed exit" does nothing. D2 enforces it, scoped to **pin-to-path** (the lowest-risk option, mirroring the existing gaming-tier per-account routing).

## Decision / model

"Fixed exit" = route that customer's foreign traffic out a **stable path tag**, not the rotating relay pool:
- **germany** → `via-germany` (free VIP via village→Germany)
- **village** → `via-village` (Starlink; note: this is what the existing `egress_tier='gaming'` already does)
- **direct** → `direct` (Ireland uplink; limited)
- **auto** (default) → today's free-first health-ordered failover (unchanged)

Stored per **client-config** (matches D1's per-config selector) in `client_route_preferences`.

## Design

### Data model
- Migration: add `preferred_egress_path text` to `client_route_preferences`, `CHECK (preferred_egress_path IS NULL OR preferred_egress_path IN ('germany','village','direct'))`. `NULL` = auto.
- (Leaves the existing `mode`/`preferred_outbound_id` columns alone; D2 uses the new column so it doesn't fight the DB-outbound validation.)

### Backend (route-preference admin endpoint)
- `UpsertClientRoutePreferenceDto` gains `preferredEgressPath?: 'germany'|'village'|'direct'|null`.
- `upsertClientRoutePreference` persists it; `getClientRoutePreference` returns it. Shared `AdminClientRoutePreferenceSummary` gains `preferredEgressPath`.
- No change to the DB-outbound validation path (we're not using `preferredOutboundId` for D2).

### Reconciler (`afrows-egress-mode-sync.py`) — the enforcement
Mirror the gaming-tier pattern, generalized per path. For each path `p` in (germany→`via-germany`, village→`via-village`, direct→`direct`):
- **VLESS users:** `SELECT 'cc_'||cc.id||'@afrows' FROM client_configs cc JOIN client_route_preferences rp ON rp.client_config_id=cc.id JOIN customer_accounts ca ON ca.id=cc.customer_account_id WHERE rp.preferred_egress_path=<p> AND cc.status<>'disabled' AND ca.status='active'` → rule `{user:[…], outboundTag:<tag>}`.
- **WireGuard sources:** same join to `wireguard_peers wp` (desired_state='present') → `{source:[wp.client_address…], outboundTag:<tag>}`.
- These per-account rules are emitted **before** the catch-all (like gaming). Precedence: gaming-tier rules first (existing), then fixed-path rules, then catch-all — first match wins; a customer who is both gaming and has a fixed path is an edge case (gaming wins, acceptable).
- `desired_rules` extends to take the fixed-path rule sets; ordering stays deterministic (sorted) to preserve the anti-spurious-restart property (existing `test_egress_mode_sync.py` guards this).

### Dashboard (D1 Exit selector update)
- The per-config Exit control changes from "Auto / Fixed:\<DB outbound\>" to **Auto / Germany / Starlink / Direct** (a single select writing `preferredEgressPath`).
- Drop the `fetchAdminOutbounds`-populated relay dropdown for this control. Update the wrapper `updateAdminClientRoutePreference` to send `preferredEgressPath`. Relabel the "saved, not enforced" note → it IS enforced now (applies within ~1–2 reconciler cycles).

## Risk + test plan (data-plane)
- Additive per-account rules mirroring the proven gaming mechanism; the catch-all/auto behavior is unchanged for everyone not pinned.
- **Pure test:** extend `scripts/test_egress_mode_sync.py` — given fixed-path user/source sets, `desired_rules` emits the right `{user|source → tag}` rules, ordering-insensitive, before the catch-all.
- **On-box validation:** after deploy, set one test config to `germany`, confirm the reconciler emits its rule + the user routes via Germany (xray config rule present; exit IP check); set to `direct`, confirm; set back to auto, confirm the rule disappears. Revert = clear the column / restore the reconciler (kept in repo, shipped by `update-afrows.sh`).
- Reconciler ships via `update-afrows.sh` (step 5c). Backend migration is idempotent.

## Non-goals
- Pinning to an individual relay IP (rejected in brainstorm; needs dynamic per-relay outbounds).
- Changing Auto/failover behavior.
- `mode='country'` routing (unused).

## Rollout
Migration + backend + dashboard via normal deploy; reconciler via `update-afrows.sh`. Reversible (column nullable; reconciler ignores null = auto). Test on one config before relying on it.
