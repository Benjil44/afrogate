# Stage-1 money-maker bundle: ordered deploy runbook (v0.131.1)

Bundle: 0.126 receipt+grace (0068), 0.127 referral 1.5 GB (0069), 0.128 levers (0070), 0.129 DE edge agent,
0.130 Germany Fast x2 (0071), 0.131 copy. HUMAN-GATED: deploy only on explicit owner "go". Never touch
Hexogate/Borjino. No customer broadcast; the only Telegram test target is the owner chat.

## 0. Pre-flight (dev PC)
1. `cd apps/backend && npm run typecheck && npm test` (1118 pass) and `npm run version:check` (0.131.1).
2. Back up the prod DB first (`/var/backups/afrows/` job or `pg_dump`); note the pre-deploy
   `SELECT count(*) FROM customer_accounts WHERE grace_until > now();` (expect 0 or few).
3. NOTE the runner (`apps/backend/scripts/migrate.mjs`) re-applies EVERY .sql on every deploy. 0070's
   one-time backfills are now first-run guarded (0.131.1); do not hand-edit them back.

## 1. Germany-Fast box (46.249.98.221), BEFORE the backend flags
(This is the box the backend will manage. Backend flags stay OFF until step 4.)
1. Rename the live 8443 REALITY inbound tag to `afrows-def-reality`. Keep the existing key (do NOT let
   `infra/germany-fast/install.sh` regenerate it). Values to keep: PBK `CcIXp3SwniLcFlxxSzY-5qUqB1TSSJIGee_xDohILGQ`,
   SID `6d9f7568c8a0d4c0`, SNI `www.speedtest.net`, fp `chrome` (ios fp FAILS on xray 26.11.9).
2. Install the forced-command wrapper `afrows-def-mgmt-cmd` + usage recorder -> `/var/lib/afrows/def-usage.json`
   (see `infra/germany-fast/README.md`). Open tcp/8443 world-wide; API 127.0.0.1:10086 stays loopback.
3. Pin the mgmt key in authorized_keys with `from="185.252.30.123"` + the forced command.
4. Backend host: add `/etc/afrows/def_mgmt_key`, `def_mgmt_known_hosts`, ssh alias `afrows-def-mgmt`
   (`infra/germany-fast/afrows-def-mgmt.conf`). Verify from the backend host: `ssh afrows-def-mgmt read-usage`
   returns JSON (backend -> :22 direct).

## 2. Backend: migrations then code (185.252.30.123)
1. Ship the tree (project `deploy` skill / `sync.ps1`), then `npm --workspace @afrows/backend run db:migrate`
   (update-afrows.sh does this). Expect `Applying 0068..0071` and `Database migrations completed.`
2. Verify: `\d customer_accounts` shows grace_until, grace_cap_bytes, renewal_notice_mask, lapsed_at, cycle_start_used_bytes;
   tables `referral_rewards`, `bonus_grants`, `client_usage_def_baseline` exist;
   `SELECT count(*) FROM customer_accounts WHERE renewal_notice_mask = 0 AND used_bytes*100 >= quota_limit_bytes*80;` = 0
   (proves the no-blast pre-arm ran).
3. Env: lever kill-switches default ON (documented in `.env.example` / `afrows.env.sample`). No change needed.
   Leave `AFROWS_DEF_*` flags OFF for this restart. Restart the backend; expect clean boot, health 200.

## 3. Staged enablement of Germany Fast x2 (meter first, link second)
1. Set `AFROWS_DEF_MGMT_ENABLED=true` (+ `AFROWS_DEF_USAGE_MULTIPLIER=2`, `AFROWS_DEF_MGMT_SSH=afrows-def-mgmt`)
   and keep `AFROWS_DEF_DIRECT_ENABLED=false`. Restart. This provisions all customers onto the box and meters x2 but
   advertises nothing (no free-traffic window). Check logs for DEF provisioning success, no breaker trips.
2. OWNER CANARY (see sample checklist): hand-build the owner's own link from his entry uuid:
   `vless://<ENTRY_UUID>@46.249.98.221:8443?encryption=none&security=reality&type=tcp&sni=www.speedtest.net&fp=chrome&pbk=<PBK>&sid=<SID>#Germany%20Fast%20x2`
   (copy the exact query shape from a USA direct REALITY link; add flow only if USA links carry one). Pull ~100 MB and
   confirm usage rises ~200 MB within ~2 min (x2).

## 4. Subscription curation (only after the canary passes)
Set together, then restart:
- `AFROWS_DEF_DIRECT_ENABLED=true`, `AFROWS_DEF_DIRECT_HOST=46.249.98.221`, `..._REALITY_PORT=8443`,
  `..._REALITY_SNI=www.speedtest.net`, `..._PBK=` / `..._SID=` (values above, from the LIVE box), `..._FP=chrome`
  (BILLING-CRITICAL: never with `AFROWS_DEF_MGMT_ENABLED` off).
- `AFROWS_US_DIRECT_ENABLED=false`, `AFROWS_US_ENTRY_ENABLED=false`, `AFROWS_HEXO_ENTRY_ENABLED=false`.
- KEEP `AFROWS_US_MGMT_ENABLED=true` (still meters/cuts USA users already connected and rmu's over-quota ones).
  Do not set it false until you decide to retire the USA box.
- Expected lineup per entitled customer: Afrows Germany, Germany Fast x2, Afrows Shatel (iran). Gating = access_germany
  (Fast x2) / access_iran. Usa/Hexo links vanish on next subscription refresh (clients refresh on their own cadence).

## 5. Verify (read-only)
- Test account `/sub/<token>` lists `Germany Fast x2`, no `USA*` / `Afro <CC>`.
- `SELECT source, count(*) FROM client_usage_events WHERE source='de-fast-xray' GROUP BY 1;` increasing;
  `client_usage_def_baseline` rows growing; no `germany-xray` row corruption.
- Owner-chat-only: trigger/receive one usage receipt + one renewal notice (Persian copy). NO broadcast.
- `journalctl -u afrows-backend` clean of renewal-ladder/usage-receipt errors; first ladder tick sends nothing
  unexpected (pre-armed masks).

## Rollback
- Flags: `AFROWS_DEF_DIRECT_ENABLED=false` first (link gone), then `AFROWS_DEF_MGMT_ENABLED=false`.
- Levers: set the relevant `AFROWS_*_ENABLED=0` and restart. Migrations are additive and backward compatible; no down step.
- Restore USA/Hexo by flipping their ENTRY flags back on.
