# Afrows deploy + verification runbook (egress P0–P3)

Everything through `origin/main` @ current HEAD is **merged and CI-green but NOT live**
until the VPS is updated. This is how to deploy it and confirm each phase took effect.

## 1. Deploy

From a machine that can reach the VPS (directly, or via a MikroTik/jump path):

```bash
# one-time: define your SSH paths
cp scripts/deploy/deploy.env.example scripts/deploy/deploy.env   # then edit + ~/.ssh/config

bash scripts/deploy/afrows-deploy.sh --check    # which paths are reachable?
bash scripts/deploy/afrows-deploy.sh            # ship HEAD -> build -> migrate -> restart
```

The engine tries each path in `AFROWS_DEPLOY_TARGETS` in order (direct first, then the
MikroTik/jump fallback) and deploys over the first that connects. Key-based SSH only.
If none connect it stops and tells you — it never uses a password.

> The legacy `sync.ps1` (laptop-local) still works for the direct path; the engine adds
> the multi-path fallback and the same `update-afrows.sh` on-box steps.

## 2. Verify — run each on the VPS after deploy

### Backend up (P0/P1 land with the backend rebuild + migration)
```bash
curl -fsS http://127.0.0.1:7000/api/health && echo OK
systemctl is-active afrows-backend
```

### P1 — migration 0055 columns exist (P0/P1 refresh code depends on them)
```bash
sudo -u postgres psql afrows -c '\d outbound_subscriptions' \
  | grep -E 'consecutive_failures|last_success_at|last_failure_reason'
# expect all three rows present
```

### P0/P1 — refresh safety + causal state is live
```bash
# after the refresher has run at least once (~5 min), inspect state per subscription:
sudo -u postgres psql afrows -c \
  "select name, last_status, last_failure_reason, consecutive_failures, last_success_at
   from outbound_subscriptions;"
# healthy sub: last_status=ok, consecutive_failures=0, last_success_at recent.
# a rejected/failing sub shows a typed last_failure_reason (SUBSCRIPTION_*) and a
# climbing consecutive_failures — the reserve is PRESERVED (children not pruned).
journalctl -u afrows-backend --since '10 min ago' | grep -iE 'subscription refresh (rejected|failed)' | tail
```

### P1 — the consecutive-failure / stale alerts are wired
```bash
sudo -u postgres psql afrows -c \
  "select severity,status,title,message from alerts
   where source_type='subscription' order by last_seen_at desc limit 5;"
# only present if a sub is actually failing/stale; absence when all healthy is correct.
```

### P2 — the egress state machine is live (self-contained, no import crash)
```bash
systemctl status afrows-egress-mode-sync.timer --no-pager | head -3
journalctl -u afrows-egress-mode-sync --since '5 min ago' | tail -20
# MUST NOT contain: ModuleNotFoundError / Traceback  (would mean the applier is dead)
# SHOULD contain a failover line, e.g.:  failover: via-germany=up pool=... -> catch-all=... (pending=.. count=..)
python3 -m json.tool < /var/lib/afrows/egress-health.json
# NEW keys present => P2 live:  "catchAllBreaker": {"tripped":false,"recent":N},
#                               "gamingBreaker":   {"tripped":false,"recent":N}
```
Anti-flap behavior to expect: fail-OUT of a failing path in ~2 ticks (unchanged),
fail-BACK to a recovered path in ~3 ticks (slower); `breaker.tripped=true` only under
sustained flapping. Watch it settle; it should not oscillate.

### P3 — the pool stability scoring is live
```bash
systemctl status afrows-uplink-pool-sync.timer --no-pager | head -3
journalctl -u afrows-uplink-pool-sync --since '15 min ago' | tail -20
# MUST NOT contain a Traceback. SHOULD contain one of:
#   pool updated (basis=speed|health-fallback) -> N relays: ...
#   no change (N relays): ...
#   SAFETY: 0 eligible relays ... leaving pool unchanged     (pool is never emptied)
```

### Reachability probe (feeds the P4 decision) — now shipped
```bash
bash /opt/afrows/scripts/drills/egress-reachability-probe.sh
# read the Q3 tally: how many bought VLESS exits are reachable over the DIRECT uplink.
```

## 3. Rollback (if a phase misbehaves)
- **Backend (P0/P1):** `update-afrows.sh` keeps the built tree; redeploy the prior commit
  (`git checkout <prev> && bash scripts/deploy/afrows-deploy.sh`). Migration 0055 is
  additive (nullable/defaulted) — safe to leave in place on rollback.
- **Reconcilers (P2/P3):** each `update-afrows.sh` writes a `.bak-<ts>` of the xray
  configs; the timers self-heal on the next tick once the prior `.py` is restored.
- The egress engines keep their last-known-good config on any `xray -test` failure, so a
  bad reconciler never takes egress down — it just stops updating until fixed.

## 4. What this does NOT fix
Deploying P0–P3 makes the reserve safe, observable, and the failover explicit/stable —
but **VLESS is still reached through the village**, so a full village/MikroTik outage can
still cut egress. That is **P4** (VLESS primary + independent MikroTik-direct fallback),
gated on the reachability probe's Q3 result above.
