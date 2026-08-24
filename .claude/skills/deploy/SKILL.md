---
name: deploy
description: Afrows deployer — ship the committed tree to the VPS and verify each egress phase is live. Multi-path (direct → MikroTik/jump fallback), key-based SSH only, human-gated. Use when the user asks to deploy/ship/release Afrows, or to check whether a phase is live on the box.
---

# /deploy — Afrows deployer

Afrows' own deployment system. Nothing here is linked to any other project.

## Rules
- **Human-gated.** Never deploy without an explicit ask. Deploying changes live customer egress.
- **Key-based SSH only** — never a password; never extract or print server secrets.
- **Fast-forward pushes only** to `origin/main`; CI + remote CodeQL are the final arbiter — never claim "live"
  until the on-box checks pass.
- Never stage/deploy `scripts/mikrotik/village-wan-failover-recursive.rsc`.

## Preconditions
1. The change is committed and CI is green on `origin/main` (deploy ships the committed tree via `git archive`).
2. You are on a machine that can reach the VPS. Configure paths once:
   ```bash
   cp scripts/deploy/deploy.env.example scripts/deploy/deploy.env    # then edit + ~/.ssh/config
   ```
   `deploy.env` is gitignored; targets are SSH aliases (direct first, then a MikroTik/jump fallback).

## Deploy
```bash
bash scripts/deploy/afrows-deploy.sh --check     # which paths reach the VPS?
bash scripts/deploy/afrows-deploy.sh             # git archive → scp → update-afrows.sh (build → migrate → restart → reconcilers) → health
```
The engine tries each path in order and deploys over the first that connects. If none connect it stops and says so
(it never uses a password). `update-afrows.sh` runs DB migrations **before** the restart, so schema-dependent
backend changes are safe.

## Verify (per phase, on the box)
Run the checks in `scripts/deploy/DEPLOY-VERIFY.md` — backend health, migration columns, egress-health breaker keys,
reconciler journalctl (no import crash / no traceback), pool-sync membership. Also, for the egress data plane, the
reconcilers keep their last-known-good config on any `xray -test` failure, so a bad deploy stops updating rather than
taking egress down.

## Rollback
`update-afrows.sh` keeps built trees + `.bak-<ts>` xray configs; redeploy the prior commit
(`git checkout <prev> && bash scripts/deploy/afrows-deploy.sh`). Additive migrations are safe to leave in place.

## Decide the next step
Hand the deploy result (and the reachability probe, if run) to the **`release-orchestrator`** agent — it reads the
output and returns STATE → DECISION (proceed / retry the next path / hold-for-human / rollback) → NEXT → GATE, then
drives the loop. That is how "read this result and choose best and continue" happens without a human relaying every step.

## Report
State: which path was used, git SHA deployed, migration/restart result, and each phase's verification evidence.
If the VPS is unreachable (village/uplink degraded), report that and stop — do not force a deploy through an
untrusted/intercepted path.
