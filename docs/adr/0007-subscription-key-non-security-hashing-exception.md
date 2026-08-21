# ADR-0007 — `outbounds.subscription_key` uses SHA-1 as a non-security identity hash (risk-accepted exception)

- **Status:** accepted (risk-accepted exception)
- **Date:** 2026-08-21
- **Relates to:** CodeQL alert #8 · rule `js/weak-cryptographic-algorithm` (severity: high) ·
  `apps/backend/src/operations/outbound-subscription-parser.ts:106`
- **Supersedes/duplicates:** nothing. Machine layer: `docs/decisions.json` (`INV-15`).

## Context

`parseSubscriptionBody` derives a 16-hex de-duplication/identity key for each parsed
VLESS endpoint:

```
apps/backend/src/operations/outbound-subscription-parser.ts:104
  const key = createHash('sha1')
    .update([c.address, c.port, c.uuid, c.network??'tcp', c.security??'none', c.path??'', c.host??'']
      .map(v=>String(v??'')).join('|'))
    .digest('hex').slice(0, 16);
```

CodeQL flags SHA-1 because "sensitive data" (`uuid`, `username`) flows into a weak
algorithm. Read-only architectural review established the role of the output:

- It is persisted as `outbounds.subscription_key` (`text`), unique on
  `(subscription_id, subscription_key)` — `apps/backend/src/database/schema.ts:438,448`,
  `infra/postgres/migrations/0032_outbound_subscriptions.sql:25,28`.
- It is used ONLY for de-duplication, the `ON CONFLICT (subscription_id, subscription_key)`
  upsert, and the prune `DELETE … WHERE subscription_key NOT = ANY(...)` —
  `apps/backend/src/operations/operations.service.ts:1686,1691,1706,1713`.
- Sole consumer: `OperationsService.syncSubscriptionChildren` (grep-verified — no other).
- It is **not** returned to any client (0 references in `packages/shared`,
  `apps/dashboard`, `apps/web`, `apps/client` — verified).

## Decision

**SHA-1 here is intentional non-security hashing; accept the finding as a risk-accepted
exception rather than change the algorithm now.**

Rationale (evidence-backed):
1. The value is a **deterministic identity / synchronization / idempotent-upsert key**,
   not a secret, token, or credential.
2. SHA-1's weakness is **collision resistance**, which is not a security boundary here:
   forging a collision to merge two subscription children yields no attacker advantage,
   and the input is admin-supplied subscription content.
3. Nothing authenticates or authorizes off this value; it is never exposed to clients.
4. A naive algorithm swap would break persisted identity: the refresh path is
   delete-not-in-keys + upsert-by-key, so new keys ⇒ every child row is **deleted and
   re-inserted** → `enabled` overrides reset, `speed_test_requested_at` reset, and a
   temporary gap in the **village-reserve egress pool** (which only admits exits
   speed-tested in the last ~90 min) — the operator's blackout-failover reserve.
   The remediation risk exceeds the ~0 security benefit.

## Consequences

- CodeQL #8 is dismissed as **"won't fix"** (used as a non-security identity key). See the
  dismissal procedure recorded with this decision.
- If stronger hashing is ever required by policy, it MUST be done as a **CRITICAL**,
  human-approved migration: SHA-256 + a recompute-and-backfill of existing
  `outbounds.subscription_key` from the stored `outbounds.config` + an atomic code cutover,
  so no child churn occurs (never a naive swap).

## Conditions that invalidate this exception

- `subscription_key` becomes exposed to a client/API, or starts being used for
  authentication/authorization/access-control, or as any security token/secret.
- The hash input stops being admin-controlled and becomes attacker-controlled in a way
  that makes a chosen-collision meaningful.
- A compliance/policy requirement mandates no SHA-1 anywhere regardless of use.

## Review

Re-evaluate on the next security-policy review, or immediately if any invalidating
condition above becomes true.
